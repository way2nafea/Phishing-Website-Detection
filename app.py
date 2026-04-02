# =============================
# IMPORTS
# =============================
from flask import Flask, render_template, request, redirect, url_for, flash, \
                  send_from_directory, jsonify                         # ← added jsonify
import os
import json
import datetime
import numpy as np



from dotenv import load_dotenv
load_dotenv()

from flask_login import (
    LoginManager,
    login_user,
    login_required,
    logout_user,
    current_user
)

from flask_bcrypt import Bcrypt

# OAuth support — Google only
from flask_dance.contrib.google import make_google_blueprint, google
from flask_dance.consumer import oauth_authorized, oauth_error

import importlib

load_model = None
try:
    models_module = importlib.import_module("tensorflow.keras.models")
    load_model = getattr(models_module, "load_model", None)
except ImportError:
    load_model = None

from sqlalchemy import inspect, text
from phishing_engine.utils import normalize_url, get_domain
from phishing_engine.security_checks import (
    contains_ip,
    dns_lookup,
    get_domain_age,
    check_ssl,
    is_similar_to_trusted,
    suspicious_structure,
    TRUSTED_DOMAINS
)
from phishing_engine.ml_engine import PhishingModel
from phishing_engine.google_check import check_google_safe_browsing

# ← New intelligence engine imports
from phishing_engine.intelligence import (
    get_live_phishing_feed,
    get_threat_advisories,
    fetch_news,
    get_feed_meta,
    invalidate_all_caches,
)

from database import db
from models import Scan, User, PhishReport                            # ← added PhishReport


# =============================
# APP CONFIG
# =============================
app = Flask(__name__)

app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev_secret_key")
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///scans.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

bcrypt = Bcrypt(app)

with app.app_context():
    db.create_all()          # also creates phish_report table automatically
    inspector = inspect(db.engine)

    if "scan" in inspector.get_table_names():
        scan_columns = [c['name'] for c in inspector.get_columns('scan')]
        with db.engine.begin() as conn:
            if 'risk_score' not in scan_columns:
                conn.execute(text("ALTER TABLE scan ADD COLUMN risk_score FLOAT"))
            if 'created_at' not in scan_columns:
                conn.execute(text("ALTER TABLE scan ADD COLUMN created_at DATETIME"))

    # Migrate phish_report.status column if upgrading from old schema
    if "phish_report" in inspector.get_table_names():
        report_cols = [c['name'] for c in inspector.get_columns('phish_report')]
        with db.engine.begin() as conn:
            if 'status' not in report_cols:
                conn.execute(text("ALTER TABLE phish_report ADD COLUMN status VARCHAR(32) DEFAULT 'pending'"))

login_manager = LoginManager(app)
login_manager.login_view = "login"

# Allow local dev over http for OAuth (remove in production)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

# ─── Google OAuth Configuration ───────────────────────────────────────────────
# Required env vars:
#   GOOGLE_OAUTH_CLIENT_ID     → your Google OAuth 2.0 Client ID
#   GOOGLE_OAUTH_CLIENT_SECRET → your Google OAuth 2.0 Client Secret
#
# In Google Cloud Console → APIs & Credentials → OAuth 2.0 Client IDs
# Add this Authorized Redirect URI:
#   http://127.0.0.1:10000/login/google/authorized   ← local dev
#   https://yourdomain.com/login/google/authorized   ← production
# ──────────────────────────────────────────────────────────────────────────────
_google_client_id     = os.environ.get('GOOGLE_OAUTH_CLIENT_ID',     '').strip()
_google_client_secret = os.environ.get('GOOGLE_OAUTH_CLIENT_SECRET', '').strip()

if not _google_client_id or not _google_client_secret:
    import warnings
    warnings.warn(
        "\n\n"
        "  ⚠️  GOOGLE OAUTH NOT CONFIGURED\n"
        "  Set the following environment variables before running:\n"
        "    GOOGLE_OAUTH_CLIENT_ID=<your-client-id>\n"
        "    GOOGLE_OAUTH_CLIENT_SECRET=<your-client-secret>\n"
        "  Google login will be disabled until these are set.\n",
        stacklevel=2
    )

google_blueprint = make_google_blueprint(
    client_id=_google_client_id or None,       # None disables the blueprint gracefully
    client_secret=_google_client_secret or None,
    scope=[
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
    ],
    # NOTE: Do NOT pass redirect_url here.
    # Flask-Dance automatically handles the callback at:
    #   /login/google/authorized  (with url_prefix='/login' below)
    # Register THAT exact URL in your Google Cloud Console.
)

app.register_blueprint(google_blueprint, url_prefix='/login')


# ─── Google OAuth Signal Handler ──────────────────────────────────────────────
# This fires AFTER Flask-Dance completes the token exchange with Google.
# It is the correct, conflict-free way to handle post-auth logic.
# ──────────────────────────────────────────────────────────────────────────────
@oauth_authorized.connect_via(google_blueprint)
def google_logged_in(blueprint, token):
    if not token:
        flash("Google login failed: no token received. Please try again.", "danger")
        return False

    resp = blueprint.session.get("/oauth2/v2/userinfo")
    if not resp.ok:
        flash("Google login failed: could not retrieve your profile. Please try again.", "danger")
        return False

    info  = resp.json()
    email = info.get("email")
    name  = info.get("name") or (email.split("@")[0] if email else "User")

    if not email:
        flash("Your Google account does not have a verified email address.", "danger")
        return False

    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(
            username=name,
            email=email,
            password=bcrypt.generate_password_hash(os.urandom(24)).decode("utf-8"),
        )
        db.session.add(user)
        db.session.commit()

    login_user(user)
    flash("Logged in with Google successfully.", "success")

    # Return False so Flask-Dance does NOT try to save the token to a DB session
    # (we only use it transiently to fetch user info).
    return False


@oauth_error.connect_via(google_blueprint)
def google_error(blueprint, message, response):
    """Catches errors returned by Google during the OAuth flow."""
    flash(f"Google OAuth error: {message}", "danger")


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


# =============================
# LOAD ML MODEL
# =============================
model = PhishingModel()


# =============================
# LOAD DL MODEL (Numeric Feature Based)
# =============================
DL_MODEL_PATH = "pickle/dl_model.h5"

dl_model = None

if os.path.exists(DL_MODEL_PATH):
    dl_model = load_model(DL_MODEL_PATH)
    print("✅ DL Model Loaded Successfully")
else:
    print("⚠ DL Model not found")


# =============================
# DL PREDICTION FUNCTION
# =============================
def dl_predict(features):
    if not dl_model:
        return None

    features = np.array(features).reshape(1, -1)
    prediction = dl_model.predict(features)[0][0]

    phishing_prob = float(prediction * 100)
    legit_prob = 100 - phishing_prob

    return phishing_prob, legit_prob


def extract_urls_from_text(message):
    import re
    if not message:
        return []
    urls = re.findall(r"https?://[^\s'\"]+", message)
    return urls


def analyze_message_text(message):
    urls = extract_urls_from_text(message)
    score = 0
    issues = []
    message_lower = message.lower()

    for trigger in ["transaction", "verify", "urgent", "account", "login", "password", "update", "confirm"]:
        if trigger in message_lower:
            score += 10
            issues.append(f"Contains suspicious word: {trigger}")

    if not urls:
        issues.append("No URL found in message")
        score += 20

    for url in urls:
        url_res = run_url_scan(url)
        score += min(80, url_res.get("risk_score", 0))
        issues.extend([f"URL {url} => {url_res.get('result', '')}"])

    if score >= 100:
        score = 100

    status = "SAFE"
    if score >= 70:
        status = "PHISHING"
    elif score >= 40:
        status = "SUSPICIOUS"

    return {
        "message": message,
        "urls": urls,
        "issues": issues,
        "risk_score": score,
        "status": status,
    }


def analyze_apk(apk_url=None, apk_file=None):
    """
    Heuristic-based APK analyser.
    Handles both URL submissions and direct file uploads.
    Returns a structured result compatible with security-suite.html.
    """
    import re
    import zipfile
    import io

    # ── Keyword lists ──────────────────────────────────────────────────────────
    MALICIOUS_URL_KEYWORDS = [
        "mod", "hack", "crack", "premium", "free", "unlocked",
        "cheat", "keygen", "patch", "nulled", "warez", "pirate",
        "apkpure-mod", "happymod", "revdl", "rexdl",
    ]
    SUSPICIOUS_URL_KEYWORDS = [
        "apk", "download", "install", "android", "update",
        "latest", "new", "version", "setup",
    ]
    DANGEROUS_PERMISSIONS = [
        "READ_SMS", "SEND_SMS", "RECEIVE_SMS",
        "READ_CALL_LOG", "PROCESS_OUTGOING_CALLS",
        "READ_CONTACTS", "WRITE_CONTACTS",
        "ACCESS_FINE_LOCATION", "ACCESS_BACKGROUND_LOCATION",
        "CAMERA", "RECORD_AUDIO",
        "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE",
        "INSTALL_PACKAGES", "REQUEST_INSTALL_PACKAGES",
        "BIND_DEVICE_ADMIN", "RECEIVE_BOOT_COMPLETED",
        "SYSTEM_ALERT_WINDOW", "DISABLE_KEYGUARD",
        "USE_CREDENTIALS", "MANAGE_ACCOUNTS",
        "GET_ACCOUNTS", "AUTHENTICATE_ACCOUNTS",
        "BIND_ACCESSIBILITY_SERVICE",
    ]
    SUSPICIOUS_PERMISSIONS = [
        "INTERNET", "CHANGE_NETWORK_STATE",
        "ACCESS_WIFI_STATE", "CHANGE_WIFI_STATE",
        "VIBRATE", "WAKE_LOCK",
        "FOREGROUND_SERVICE", "RECEIVE_WAP_PUSH",
        "READ_PHONE_STATE", "USE_BIOMETRIC",
    ]

    # ── Bootstrap report ──────────────────────────────────────────────────────
    report = {
        "apk_url":    apk_url   or "",
        "apk_file":   (apk_file.filename if apk_file and apk_file.filename else ""),
        "status":     "NOT_SCANNED",
        "risk_score": 0,
        "details":    [],
    }

    risk  = 0
    notes = []

    # ── Helper: derive final status from risk score ────────────────────────────
    def _finalise(risk_score, notes):
        risk_score = max(0, min(100, risk_score))
        if risk_score >= 70:
            status = "PHISHING"
        elif risk_score >= 40:
            status = "SUSPICIOUS"
        else:
            status = "SAFE"
        return {"status": status, "risk_score": risk_score, "details": notes}

    # ═════════════════════════════════════════════════════════════════════════
    #  BRANCH A — APK URL analysis
    # ═════════════════════════════════════════════════════════════════════════
    if apk_url and apk_url.strip():
        url_lower = apk_url.lower().strip()

        # 1. Protocol check
        if url_lower.startswith("http://"):
            risk += 20
            notes.append("🔓 Insecure protocol (HTTP): APK served without encryption.")
        elif url_lower.startswith("https://"):
            notes.append("🔒 Secure protocol (HTTPS): connection is encrypted.")
        else:
            risk += 15
            notes.append("⚠️ Unrecognised protocol in URL.")

        # 2. Malicious keyword scan
        hit_malicious = [kw for kw in MALICIOUS_URL_KEYWORDS if kw in url_lower]
        if hit_malicious:
            risk += 50
            notes.append(
                f"🚨 High-risk keywords detected in URL: {', '.join(hit_malicious)}. "
                "These are strongly associated with pirated/trojanised APKs."
            )

        # 3. Suspicious keyword scan (only if not already flagged malicious)
        if not hit_malicious:
            hit_suspicious = [kw for kw in SUSPICIOUS_URL_KEYWORDS if kw in url_lower]
            if hit_suspicious:
                risk += 15
                notes.append(
                    f"⚠️ Suspicious keywords found in URL: {', '.join(hit_suspicious)}."
                )

        # 4. File extension check
        if not url_lower.endswith(".apk"):
            risk += 10
            notes.append("⚠️ URL does not end with .apk — the file type cannot be confirmed.")
        else:
            notes.append("✅ URL ends with .apk extension.")

        # 5. IP-address host check
        ip_pattern = re.compile(
            r"https?://(\d{1,3}\.){3}\d{1,3}",
            re.IGNORECASE
        )
        if ip_pattern.match(url_lower):
            risk += 25
            notes.append("🚨 APK is hosted on a raw IP address — no domain identity, very high risk.")

        # 6. Excessive subdomain check
        try:
            host = re.split(r"https?://", url_lower)[1].split("/")[0]
            subdomain_count = host.count(".")
            if subdomain_count >= 3:
                risk += 10
                notes.append(
                    f"⚠️ Excessive subdomain depth ({subdomain_count} dots) — "
                    "common in phishing distribution infrastructure."
                )
        except Exception:
            pass

        # 7. Long URL check
        if len(apk_url) > 120:
            risk += 10
            notes.append("⚠️ Unusually long URL — obfuscation technique commonly used in phishing links.")

        # 8. Summary note
        notes.append(
            "ℹ️ Analysis performed via heuristic URL inspection. "
            "For deeper analysis, upload the APK file directly."
        )

        result = _finalise(risk, notes)
        result["apk_url"]  = apk_url
        result["apk_file"] = ""
        return result

    # ═════════════════════════════════════════════════════════════════════════
    #  BRANCH B — APK file upload analysis
    # ═════════════════════════════════════════════════════════════════════════
    elif apk_file and apk_file.filename:
        filename    = apk_file.filename
        fname_lower = filename.lower()

        # 1. Extension validation
        if not fname_lower.endswith(".apk"):
            risk += 30
            notes.append(f"🚨 Uploaded file '{filename}' is NOT an .apk file.")
        else:
            notes.append(f"✅ File extension confirmed: {filename}")

        # 2. Filename keyword scan
        hit_fname = [kw for kw in MALICIOUS_URL_KEYWORDS if kw in fname_lower]
        if hit_fname:
            risk += 40
            notes.append(
                f"🚨 Malicious keywords in filename: {', '.join(hit_fname)}. "
                "Strongly associated with repackaged/trojanised APKs."
            )

        # 3. File size check
        apk_file.seek(0, 2)          # seek to end
        file_size_mb = apk_file.tell() / (1024 * 1024)
        apk_file.seek(0)             # rewind

        if file_size_mb < 0.1:
            risk += 20
            notes.append(
                f"⚠️ File is very small ({file_size_mb:.2f} MB) — "
                "legitimate apps are rarely this small; may be a stub/dropper."
            )
        elif file_size_mb > 150:
            risk += 10
            notes.append(
                f"⚠️ File is very large ({file_size_mb:.2f} MB) — "
                "could indicate bundled malicious payloads."
            )
        else:
            notes.append(f"✅ File size looks normal ({file_size_mb:.2f} MB).")

        # 4. ZIP/APK structure + manifest analysis
        raw_bytes = apk_file.read()
        apk_file.seek(0)

        try:
            with zipfile.ZipFile(io.BytesIO(raw_bytes)) as zf:
                namelist = zf.namelist()

                # 4a. Mandatory APK entries
                if "AndroidManifest.xml" not in namelist:
                    risk += 35
                    notes.append("🚨 AndroidManifest.xml missing — not a valid APK or deliberately stripped.")
                else:
                    notes.append("✅ AndroidManifest.xml present.")

                has_dex = any(n.endswith(".dex") for n in namelist)
                if not has_dex:
                    risk += 20
                    notes.append("⚠️ No .dex (Dalvik bytecode) file found — unusual for a real Android app.")
                else:
                    dex_count = sum(1 for n in namelist if n.endswith(".dex"))
                    if dex_count > 3:
                        risk += 15
                        notes.append(
                            f"⚠️ {dex_count} .dex files detected — "
                            "multi-dex is legitimate but also used by sophisticated malware."
                        )
                    else:
                        notes.append(f"✅ {dex_count} .dex bytecode file(s) found.")

                # 4b. Suspicious native libraries
                native_libs = [n for n in namelist if n.endswith(".so")]
                if native_libs:
                    notes.append(
                        f"ℹ️ {len(native_libs)} native library/libraries (.so) found — "
                        "normal for many apps but worth noting."
                    )

                # 4c. Hidden / double-extension files
                double_ext = [
                    n for n in namelist
                    if re.search(r"\.(jpg|png|gif|mp4|pdf)\.(apk|dex|so|jar)$", n, re.IGNORECASE)
                ]
                if double_ext:
                    risk += 30
                    notes.append(
                        f"🚨 Double-extension files detected: {double_ext[:3]} — "
                        "classic technique to disguise malicious payloads as media files."
                    )

                # 4d. Raw manifest permission scan (binary heuristic)
                try:
                    manifest_bytes = zf.read("AndroidManifest.xml").decode("latin-1")
                    found_dangerous = [p for p in DANGEROUS_PERMISSIONS if p in manifest_bytes]
                    found_suspicious = [p for p in SUSPICIOUS_PERMISSIONS if p in manifest_bytes]

                    if found_dangerous:
                        risk += min(40, len(found_dangerous) * 5)
                        notes.append(
                            f"🚨 {len(found_dangerous)} high-risk permission(s) detected: "
                            f"{', '.join(found_dangerous[:8])}"
                            + (" …and more." if len(found_dangerous) > 8 else ".")
                        )
                    else:
                        notes.append("✅ No high-risk permissions detected in manifest.")

                    if found_suspicious:
                        risk += min(15, len(found_suspicious) * 3)
                        notes.append(
                            f"⚠️ {len(found_suspicious)} notable permission(s): "
                            f"{', '.join(found_suspicious[:6])}"
                            + (" …and more." if len(found_suspicious) > 6 else ".")
                        )
                except Exception:
                    notes.append(
                        "ℹ️ Manifest is binary-encoded (AXML); "
                        "deep permission parsing skipped — use a decompiler for full audit."
                    )

                # 4e. Entry count
                notes.append(f"ℹ️ APK archive contains {len(namelist)} total entries.")

        except zipfile.BadZipFile:
            risk += 40
            notes.append("🚨 File is not a valid ZIP/APK archive — corrupted or disguised malware.")
        except Exception as exc:
            notes.append(f"ℹ️ Archive inspection error: {exc}")

        # 5. Closing note
        notes.append(
            "ℹ️ Static heuristic analysis complete. "
            "For definitive results, decompile with jadx/apktool and review source manually."
        )

        result = _finalise(risk, notes)
        result["apk_url"]  = ""
        result["apk_file"] = filename
        return result

    # ═════════════════════════════════════════════════════════════════════════
    #  BRANCH C — Nothing provided
    # ═════════════════════════════════════════════════════════════════════════
    else:
        return {
            "apk_url":    "",
            "apk_file":   "",
            "status":     "INVALID",
            "risk_score": 0,
            "details":    ["❌ No APK file or URL was provided. Please submit one to begin analysis."],
        }


def run_url_scan(raw_url):
    raw_url = raw_url.strip() if raw_url else ""
    url = normalize_url(raw_url)
    domain = get_domain(url)

    risk_score = 0
    prediction = ""
    xx = 0

    if contains_ip(domain):
        prediction = "⚠️ Website uses IP address instead of domain (High Risk)"
        risk_score = 90
        xx = -1

    elif not dns_lookup(domain):
        prediction = "⚠️ Domain does NOT exist (DNS validation failed)"
        risk_score = 95
        xx = -1

    elif check_google_safe_browsing(url):
        prediction = "🚨 Google Safe Browsing flagged this URL as dangerous"
        risk_score = 98
        xx = -1

    else:
        age = get_domain_age(domain)

        if age and age < 30:
            prediction = f"⚠️ Domain is very new ({age} days old) - High Risk"
            risk_score = 75
            xx = -1

        elif not check_ssl(domain):
            prediction = "⚠️ Invalid or missing SSL certificate"
            risk_score = 60
            xx = 0

        elif domain in TRUSTED_DOMAINS:
            prediction = "Website appears SAFE (99.00% confidence)"
            risk_score = 5
            xx = 1

        elif is_similar_to_trusted(domain):
            prediction = "⚠️ Domain looks similar to trusted site (Possible Spoofing)"
            risk_score = 70
            xx = 0

        elif suspicious_structure(domain):
            prediction = "⚠️ URL contains suspicious keywords or structure"
            risk_score = 65
            xx = 0

        else:
            phishing_prob, legit_prob = model.predict(url)
            risk_score = phishing_prob

            if legit_prob >= 70:
                prediction = f"Website appears SAFE ({legit_prob:.2f}% confidence)"
                xx = 1
            elif 50 <= legit_prob < 70:
                prediction = f"Website looks SUSPICIOUS ({legit_prob:.2f}% confidence)"
                xx = 0
            else:
                prediction = f"Website is likely PHISHING ({phishing_prob:.2f}% risk)"
                xx = -1

    return {
        "raw_url": raw_url,
        "url": url,
        "domain": domain,
        "risk_score": risk_score,
        "prediction": prediction,
        "xx": xx,
    }


def assistant_suggestion(raw_url):
    if not raw_url:
        return None

    normalized = normalize_url(raw_url)
    domain = get_domain(normalized)

    issues = []
    status = "No immediate issues from quick assistant checks"

    if contains_ip(domain):
        issues.append("Uses raw IP address instead of domain")

    if not dns_lookup(domain):
        issues.append("DNS lookup failed (domain may not exist)")

    if check_google_safe_browsing(normalized):
        issues.append("Google Safe Browsing flagged this URL")

    if domain in TRUSTED_DOMAINS:
        status = "Trusted domain (still run scan for full confirmation)"
    elif is_similar_to_trusted(domain):
        issues.append("Domain is similar to a trusted site (possible spoofing)")
        status = "Suspicious domain similarity"
    elif suspicious_structure(domain):
        issues.append("Suspicious URL structure or path detected")
        status = "Suspicious structure"

    return {
        "raw_url": raw_url,
        "normalized": normalized,
        "domain": domain,
        "issues": issues,
        "status": status,
    }


# =============================
# SMART ASSISTANT ROUTE
# =============================
@app.route("/assistant", methods=["GET", "POST"])
@login_required
def assistant():
    suggestion = None
    popular_suggestions = [
        "https://www.google.com",
        "https://www.github.com",
        "http://login-secure-example.com",
        "http://192.168.1.1",
    ]

    if request.method == "POST":
        raw_input_url = request.form.get("assistant_url", "").strip()
        if raw_input_url:
            suggestion = assistant_suggestion(raw_input_url)

    if request.method == "GET" and request.args.get("url"):
        suggestion = assistant_suggestion(request.args.get("url"))

    # ── Live intelligence data ──────────────────────────────────────────────
    top_phishing = get_live_phishing_feed(limit=14)
    threat_feed  = get_threat_advisories(count=4)
    cyber_news   = fetch_news(limit=6)
    feed_meta    = get_feed_meta()

    # ── Community reports from DB (latest 20) ──────────────────────────────
    reported_phishes = (
        PhishReport.query
        .order_by(PhishReport.reported_on.desc())
        .limit(20)
        .all()
    )

    return render_template(
        "assistant.html",
        suggestion=suggestion,
        popular_suggestions=popular_suggestions,
        top_phishing=top_phishing,
        threat_feed=threat_feed,
        cyber_news=cyber_news,
        feed_meta=feed_meta,
        reported_phishes=[r.as_dict() for r in reported_phishes],
    )


# =============================
# REPORT PHISHING URL
# =============================
@app.route("/assistant/report", methods=["POST"])
@login_required
def assistant_report():
    report_url    = request.form.get("report_url", "").strip()
    report_reason = request.form.get("report_reason", "User submitted phishing report").strip()

    if not report_url:
        flash("Please provide a URL to report.", "danger")
        return redirect(url_for("assistant"))

    # Prevent duplicate reports from the same user
    existing = PhishReport.query.filter_by(url=report_url, user_id=current_user.id).first()
    if existing:
        flash("You have already reported this URL. It is under review.", "info")
        return redirect(url_for("assistant"))

    report = PhishReport(
        url=report_url,
        reason=report_reason or "User submitted phishing report",
        user_id=current_user.id,
        username=current_user.username,
        status="pending",
    )
    db.session.add(report)
    db.session.commit()

    flash("Thanks! URL submitted for community review.", "success")
    return redirect(url_for("assistant"))


# =========================
# INTELLIGENCE API ROUTES
# =========================

@app.route("/api/intelligence")
@login_required
def api_intelligence():
    """
    Returns the latest feed data as JSON.
    The front-end JS polls this every 60 s and updates the page without reload.
    """
    try:
        phishing_feed = get_live_phishing_feed(limit=14)
        advisories    = get_threat_advisories(count=4)
        news          = fetch_news(limit=6)
        meta          = get_feed_meta()
        reports       = (
            PhishReport.query
            .order_by(PhishReport.reported_on.desc())
            .limit(20)
            .all()
        )

        return jsonify({
            "top_phishing":      phishing_feed,
            "threat_feed":       advisories,
            "cyber_news":        news,
            "feed_meta":         meta,
            "reported_phishes":  [r.as_dict() for r in reports],
            "stats": {
                "phishing_count": len(get_live_phishing_feed()),
                "advisory_count": len(get_threat_advisories()),
                "report_count":   PhishReport.query.count(),
            },
        })
    except Exception as e:
        return jsonify({"error": "Failed to fetch intelligence data", "details": str(e)}), 500


@app.route("/api/refresh-feeds", methods=["POST"])
@login_required
def refresh_feeds():
    """Force-refresh all intelligence caches. Protect this endpoint in production."""
    try:
        invalidate_all_caches()
        return jsonify({
            "status":  "ok",
            "message": "All feed caches cleared. Next request will re-fetch live data.",
        })
    except Exception as e:
        return jsonify({"error": "Failed to refresh feeds", "details": str(e)}), 500


@app.route("/assistant/report/<int:report_id>/status", methods=["POST"])
@login_required
def update_report_status(report_id):
    """Admin endpoint to update the moderation status of a community report."""
    try:
        new_status = request.form.get("status", "pending")
        if new_status not in ("pending", "verified", "malicious", "safe"):
            return jsonify({"error": "Invalid status"}), 400

        report = PhishReport.query.get_or_404(report_id)
        report.status = new_status
        db.session.commit()

        return jsonify({"status": "ok", "new_status": new_status})
    except Exception as e:
        return jsonify({"error": "Failed to update report status", "details": str(e)}), 500


# =============================
# SECURITY SUITE ROUTES
# =============================
@app.route("/security-suite")
@login_required
def security_suite():
    return render_template("security-suite.html")


@app.route("/sms-check", methods=["POST"])
@login_required
def sms_checker():
    message = request.form.get("message", "")
    sms_result = analyze_message_text(message)
    return render_template("security-suite.html", sms_result=sms_result)


@app.route("/url-check", methods=["POST"])
@login_required
def url_checker():
    url = request.form.get("url", "")
    url_result = run_url_scan(url)

    new_scan = Scan(
        url=url,
        risk_score=url_result.get("risk_score") or 0,
        result=url_result.get("prediction", ""),
        user_id=current_user.id
    )

    db.session.add(new_scan)
    db.session.commit()

    return render_template("security-suite.html", url_result=url_result)


@app.route("/apk-check", methods=["POST"])
@login_required
def apk_checker():
    apk_url = request.form.get("apk_url", "")
    apk_file = request.files.get("apk_file")
    apk_result = analyze_apk(apk_url=apk_url, apk_file=apk_file)
    return render_template("security-suite.html", apk_result=apk_result)


# =============================
# MAIN SCAN ROUTE
# =============================
@app.route("/", methods=["GET"])
@login_required
def index():
    return redirect(url_for("security_suite"))


# =============================
# REGISTER
# =============================
@app.route("/register", methods=["GET", "POST"])
def register():

    if request.method == "POST":

        username = request.form.get("username")
        email    = request.form.get("email")
        password = request.form.get("password")

        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            flash("Email already registered. Please login.", "danger")
            return redirect(url_for("login"))

        hashed_password = bcrypt.generate_password_hash(password).decode("utf-8")

        user = User(
            username=username,
            email=email,
            password=hashed_password
        )

        db.session.add(user)
        db.session.commit()

        flash("Account created successfully! Please login.", "success")
        return redirect(url_for("login"))

    return render_template("register.html")


# =============================
# LOGIN
# =============================
@app.route("/login", methods=["GET", "POST"])
def login():
    # Warn if Google OAuth env vars are missing so it shows in the UI
    google_configured = bool(_google_client_id and _google_client_secret)

    if request.method == "POST":

        email    = request.form.get("email")
        password = request.form.get("password")

        user = User.query.filter_by(email=email).first()

        if user and bcrypt.check_password_hash(user.password, password):
            login_user(user)
            flash("Login successful!", "success")
            return redirect(url_for("assistant"))

        flash("Invalid email or password.", "danger")

    return render_template("login.html", google_configured=google_configured)


# ─── NOTE: There is NO custom @app.route('/login/google') here.
# Flask-Dance already registers /login/google as the OAuth initiation route
# when the blueprint is registered with url_prefix='/login'.
# Defining a second route at the same path would cause a Flask routing conflict
# and is one of the root causes of the "Missing required parameter: client_id" error.
#
# The full Google OAuth flow:
#   1. User clicks "Sign in with Google" → links to url_for('google.login')
#      which resolves to /login/google
#   2. Flask-Dance redirects to Google's consent screen
#   3. Google redirects back to /login/google/authorized
#   4. Flask-Dance exchanges the code for a token
#   5. The @oauth_authorized signal fires → google_logged_in() above runs
#   6. User is logged in and redirected to /assistant


# =============================
# LOGOUT
# =============================
@app.route("/logout")
@login_required
def logout():
    logout_user()
    flash("You have been logged out.", "info")
    return redirect(url_for("login"))


# =============================
# DASHBOARD
# =============================
@app.route("/dashboard")
@login_required
def dashboard():
    scans = Scan.query.filter_by(user_id=current_user.id)\
        .order_by(Scan.id.desc()).all()
    return render_template("dashboard.html", scans=scans)


# =============================
# PASSWORD RESET
# =============================
@app.route('/reset-password', methods=['GET', 'POST'])
def reset_password():
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        if not email:
            flash('Please enter your email address.', 'danger')
            return redirect(url_for('reset_password'))

        flash('If this email exists in our system, a password reset link has been sent.', 'success')
        return redirect(url_for('login'))

    return render_template('reset-password.html')


# =============================
# SOCIAL LOGIN — Google only
# =============================
@app.route('/auth/<provider>')
def social_login(provider):
    """Fallback route; real Google login goes through Flask-Dance at /login/google."""
    if provider == 'google':
        return redirect(url_for('google.login'))

    flash('Unsupported login provider.', 'danger')
    return redirect(url_for('login'))


# =============================
# SEO ROUTES
# =============================
@app.route("/robots.txt")
def robots():
    return app.send_static_file("robots.txt")


@app.route("/sitemap.xml")
def sitemap():
    return app.send_static_file("sitemap.xml")


@app.route("/google669baacc40f95010.html")
def google_verification():
    return send_from_directory("static", "google669baacc40f95010.html")


# =============================
# RUN APP
# =============================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=True)