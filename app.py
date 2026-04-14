# =============================
# IMPORTS
# =============================
from flask import Flask, render_template, request, redirect, url_for, flash, \
                  send_from_directory, jsonify
from flask_cors import CORS
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

from phishing_engine.intelligence import (
    get_live_phishing_feed,
    get_threat_advisories,
    fetch_news,
    get_feed_meta,
    invalidate_all_caches,
)

from database import db
from models import Scan, User, PhishReport


# =============================
# APP CONFIG
# =============================
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev_secret_key")
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///scans.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

bcrypt = Bcrypt(app)

with app.app_context():
    db.create_all()
    inspector = inspect(db.engine)

    if "scan" in inspector.get_table_names():
        scan_columns = [c['name'] for c in inspector.get_columns('scan')]
        with db.engine.begin() as conn:
            if 'risk_score' not in scan_columns:
                conn.execute(text("ALTER TABLE scan ADD COLUMN risk_score FLOAT"))
            if 'created_at' not in scan_columns:
                conn.execute(text("ALTER TABLE scan ADD COLUMN created_at DATETIME"))

    if "phish_report" in inspector.get_table_names():
        report_cols = [c['name'] for c in inspector.get_columns('phish_report')]
        with db.engine.begin() as conn:
            if 'status' not in report_cols:
                conn.execute(text("ALTER TABLE phish_report ADD COLUMN status VARCHAR(32) DEFAULT 'pending'"))

login_manager = LoginManager(app)
login_manager.login_view = "login"

# Allow local dev over http for OAuth (remove in production)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

# ─── Google OAuth Configuration ────────────────────────────────────────────────
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
    client_id=_google_client_id or None,
    client_secret=_google_client_secret or None,
    scope=[
        "openid",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
    ],
)

app.register_blueprint(google_blueprint, url_prefix='/login')



# ─── Google OAuth Signal Handler ───────────────────────────────────────────────
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
    return False


@oauth_error.connect_via(google_blueprint)
def google_error(blueprint, message, response):
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


    return {
        "message": message,
        "urls": urls,
        "issues": issues,
        "risk_score": score,
        "status": status,
    }


def analyze_apk(apk_url=None, apk_file=None):
    import re
    import zipfile
    import io

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

    report = {
        "apk_url":    apk_url   or "",
        "apk_file":   (apk_file.filename if apk_file and apk_file.filename else ""),
        "status":     "NOT_SCANNED",
        "risk_score": 0,
        "details":    [],
    }

    risk  = 0
    notes = []

    def _finalise(risk_score, notes):
        risk_score = max(0, min(100, risk_score))
        if risk_score >= 70:
            status = "PHISHING"
        elif risk_score >= 40:
            status = "SUSPICIOUS"
        else:
            status = "SAFE"
        return {"status": status, "risk_score": risk_score, "details": notes}

    if apk_url and apk_url.strip():
        url_lower = apk_url.lower().strip()

        if url_lower.startswith("http://"):
            risk += 20
            notes.append("🔓 Insecure protocol (HTTP): APK served without encryption.")
        elif url_lower.startswith("https://"):
            notes.append("🔒 Secure protocol (HTTPS): connection is encrypted.")
        else:
            risk += 15
            notes.append("⚠️ Unrecognised protocol in URL.")

        hit_malicious = [kw for kw in MALICIOUS_URL_KEYWORDS if kw in url_lower]
        if hit_malicious:
            risk += 50
            notes.append(
                f"🚨 High-risk keywords detected in URL: {', '.join(hit_malicious)}. "
                "These are strongly associated with pirated/trojanised APKs."
            )

        if not hit_malicious:
            hit_suspicious = [kw for kw in SUSPICIOUS_URL_KEYWORDS if kw in url_lower]
            if hit_suspicious:
                risk += 15
                notes.append(f"⚠️ Suspicious keywords found in URL: {', '.join(hit_suspicious)}.")

        if not url_lower.endswith(".apk"):
            risk += 10
            notes.append("⚠️ URL does not end with .apk — the file type cannot be confirmed.")
        else:
            notes.append("✅ URL ends with .apk extension.")

        ip_pattern = re.compile(r"https?://(\d{1,3}\.){3}\d{1,3}", re.IGNORECASE)
        if ip_pattern.match(url_lower):
            risk += 25
            notes.append("🚨 APK is hosted on a raw IP address — no domain identity, very high risk.")

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

        if len(apk_url) > 120:
            risk += 10
            notes.append("⚠️ Unusually long URL — obfuscation technique commonly used in phishing links.")

        notes.append(
            "ℹ️ Analysis performed via heuristic URL inspection. "
            "For deeper analysis, upload the APK file directly."
        )

        result = _finalise(risk, notes)
        result["apk_url"]  = apk_url
        result["apk_file"] = ""
        return result

    elif apk_file and apk_file.filename:
        filename    = apk_file.filename
        fname_lower = filename.lower()

        if not fname_lower.endswith(".apk"):
            risk += 30
            notes.append(f"🚨 Uploaded file '{filename}' is NOT an .apk file.")
        else:
            notes.append(f"✅ File extension confirmed: {filename}")

        hit_fname = [kw for kw in MALICIOUS_URL_KEYWORDS if kw in fname_lower]
        if hit_fname:
            risk += 40
            notes.append(
                f"🚨 Malicious keywords in filename: {', '.join(hit_fname)}. "
                "Strongly associated with repackaged/trojanised APKs."
            )

        apk_file.seek(0, 2)
        file_size_mb = apk_file.tell() / (1024 * 1024)
        apk_file.seek(0)

        if file_size_mb < 0.1:
            risk += 20
            notes.append(f"⚠️ File is very small ({file_size_mb:.2f} MB) — may be a stub/dropper.")
        elif file_size_mb > 150:
            risk += 10
            notes.append(f"⚠️ File is very large ({file_size_mb:.2f} MB) — could indicate bundled malicious payloads.")
        else:
            notes.append(f"✅ File size looks normal ({file_size_mb:.2f} MB).")

        raw_bytes = apk_file.read()
        apk_file.seek(0)

        try:
            import zipfile as zf_module
            with zf_module.ZipFile(io.BytesIO(raw_bytes)) as zf:
                namelist = zf.namelist()

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
                        notes.append(f"⚠️ {dex_count} .dex files detected.")
                    else:
                        notes.append(f"✅ {dex_count} .dex bytecode file(s) found.")

                native_libs = [n for n in namelist if n.endswith(".so")]
                if native_libs:
                    notes.append(f"ℹ️ {len(native_libs)} native library/libraries (.so) found.")

                double_ext = [
                    n for n in namelist
                    if re.search(r"\.(jpg|png|gif|mp4|pdf)\.(apk|dex|so|jar)$", n, re.IGNORECASE)
                ]
                if double_ext:
                    risk += 30
                    notes.append(f"🚨 Double-extension files detected: {double_ext[:3]}.")

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
                    notes.append("ℹ️ Manifest is binary-encoded (AXML); deep permission parsing skipped.")

                notes.append(f"ℹ️ APK archive contains {len(namelist)} total entries.")

        except Exception as exc:
            risk += 40
            notes.append(f"🚨 Archive inspection error: {exc}")

        notes.append("ℹ️ Static heuristic analysis complete.")

        result = _finalise(risk, notes)
        result["apk_url"]  = ""
        result["apk_file"] = filename
        return result

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
# LANDING PAGE (PUBLIC)
# =============================
@app.route("/", methods=["GET"])
def index():
    """
    NEXUS landing page.
    - Logged in  → redirect to /dashboard
    - Logged out → show landing page (index.html)
    """
    if current_user.is_authenticated:
        return redirect(url_for("dashboard"))
    return render_template("index.html")


# =============================
# URL SCANNER PAGE
# =============================
@app.route("/url-scanner", methods=["GET", "POST"])
@login_required
def url_scanner():
    """
    URL Scanner page — handles both GET (show form) and POST (scan & show result).
    Renders url_scanner.html.
    """
    if request.method == "POST":
        raw_url = request.form.get("url", "").strip()
        if raw_url:
            result = run_url_scan(raw_url)

            new_scan = Scan(
                url=raw_url,
                risk_score=result.get("risk_score") or 0,
                result=result.get("prediction", ""),
                user_id=current_user.id
            )
            db.session.add(new_scan)
            db.session.commit()

            return render_template(
                "url_scanner.html",
                url=result["url"],
                prediction=result["prediction"],
                xx=result["xx"],
                risk_score=result["risk_score"],
                assistant_hint=None,
            )

    return render_template("url_scanner.html")


# =============================
# SMART ASSISTANT ROUTE
# =============================
@app.route("/assistant")
@login_required
def assistant():
    """Backward-compat alias — redirect to the renamed /ai-assistant route."""
    return redirect(url_for("ai_assistant"))


@app.route("/ai-assistant", methods=["GET", "POST"])
@login_required
def ai_assistant():
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

    top_phishing = get_live_phishing_feed(limit=14)
    threat_feed  = get_threat_advisories(count=4)
    cyber_news   = fetch_news(limit=6)
    feed_meta    = get_feed_meta()

    reported_phishes = (
        PhishReport.query
        .order_by(PhishReport.reported_on.desc())
        .limit(20)
        .all()
    )

    return render_template(
        "ai_assistant.html",
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
        return redirect(url_for("ai_assistant"))

    existing = PhishReport.query.filter_by(url=report_url, user_id=current_user.id).first()
    if existing:
        flash("You have already reported this URL. It is under review.", "info")
        return redirect(url_for("ai_assistant"))

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
    return redirect(url_for("ai_assistant"))


# =========================
# INTELLIGENCE API ROUTES
# =========================

@app.route("/api/intelligence")
@login_required
def api_intelligence():
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
# REACT FRONTEND API ROUTES (PUBLIC)
# =============================

@app.route("/scan-url", methods=["POST"])
def api_scan_url():
    """Public JSON endpoint for React frontend to scan a URL"""
    try:
        data = request.get_json() or {}
        url = data.get("url") or request.form.get("url", "")
        if not url:
            return jsonify({"error": "URL is required"}), 400
            
        result = run_url_scan(url)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/scan-email", methods=["POST"])
def api_scan_email():
    """Public JSON endpoint for React frontend to scan an email/message"""
    try:
        data = request.get_json() or {}
        message = data.get("message") or request.form.get("message", "")
        if not message:
            return jsonify({"error": "Message is required"}), 400
            
        result = analyze_message_text(message)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/get-threat-data", methods=["GET"])
def api_get_threat_data():
    """Public JSON endpoint returning threat intelligence data for the landing page"""
    try:
        phishing_feed = get_live_phishing_feed(limit=5)
        advisories    = get_threat_advisories(count=3)
        return jsonify({
            "top_phishing": phishing_feed,
            "threat_feed": advisories,
            "stats": {
                "phishing_count": len(get_live_phishing_feed()),
                "advisory_count": len(get_threat_advisories()),
                "report_count": PhishReport.query.count(),
            }
        })
    except Exception as e:
        return jsonify({"error": "Failed to fetch threat data", "details": str(e)}), 500


# =============================
# SECURITY SUITE ROUTES
# =============================
@app.route("/security-suite")
@login_required
def security_suite():
    return render_template("security_suite.html")


@app.route("/sms-check", methods=["POST"])
@login_required
def sms_checker():
    message = request.form.get("message", "")
    sms_result = analyze_message_text(message)
    return render_template("security_suite.html", sms_result=sms_result)


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

    return render_template("security_suite.html", url_result=url_result)


@app.route("/apk-check", methods=["POST"])
@login_required
def apk_checker():
    apk_url = request.form.get("apk_url", "")
    apk_file = request.files.get("apk_file")
    apk_result = analyze_apk(apk_url=apk_url, apk_file=apk_file)
    return render_template("security_suite.html", apk_result=apk_result)


# =============================
# REGISTER
# =============================
@app.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("dashboard"))

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
    # Already logged in → send to dashboard
    if current_user.is_authenticated:
        return redirect(url_for("dashboard"))

    google_configured = bool(_google_client_id and _google_client_secret)

    if request.method == "POST":
        email    = request.form.get("email")
        password = request.form.get("password")

        user = User.query.filter_by(email=email).first()

        if user and bcrypt.check_password_hash(user.password, password):
            login_user(user)
            flash("Welcome back to NEXUS!", "success")
            # Redirect to the page they tried to access, or dashboard
            next_page = request.args.get("next")
            return redirect(next_page or url_for("dashboard"))

        flash("Invalid email or password.", "danger")

    return render_template("login.html", google_configured=google_configured)


# =============================
# LOGOUT
# =============================
@app.route("/logout")
@login_required
def logout():
    logout_user()
    flash("You have been logged out of NEXUS.", "info")
    return redirect(url_for("index"))


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
# THREAT MAP PAGE
# =============================
@app.route("/threat-map")
@login_required
def threat_map():
    return render_template("threat_map.html")


# =============================
# 3D GLOBE PAGE
# =============================
@app.route("/globe")
@login_required
def globe():
    return render_template("globe.html")


# =============================
# LOCATION SEARCH API
# =============================
@app.route("/search_location")
@login_required
def search_location():
    import json as _json
    import os as _os

    query = request.args.get("q", "").strip().lower()
    if not query:
        return jsonify({"error": "Query parameter q is required"}), 400

    locations_path = _os.path.join(app.static_folder, "data", "locations.json")
    try:
        with open(locations_path, "r", encoding="utf-8") as f:
            loc_data = _json.load(f)
    except (FileNotFoundError, _json.JSONDecodeError):
        return jsonify({"error": "Location database not available"}), 503

    results = []

    for city in loc_data.get("cities", []):
        name    = city.get("name", "")
        country = city.get("country", "")
        if query in name.lower() or query in country.lower():
            score = 20 if name.lower() == query else (15 if name.lower().startswith(query) else 8)
            results.append({
                "name": name, "country": country,
                "continent": city.get("continent", ""),
                "lat": city["lat"], "lng": city["lng"],
                "type": "city", "_score": score,
            })

    for country in loc_data.get("countries", []):
        name = country.get("name", "")
        if query in name.lower():
            score = 20 if name.lower() == query else (15 if name.lower().startswith(query) else 8)
            results.append({
                "name": name, "country": name,
                "continent": country.get("continent", ""),
                "lat": country["lat"], "lng": country["lng"],
                "type": "country", "_score": score,
            })

    for continent in loc_data.get("continents", []):
        name = continent.get("name", "")
        if query in name.lower():
            score = 20 if name.lower() == query else 10
            results.append({
                "name": name, "country": "",
                "continent": name,
                "lat": continent["lat"], "lng": continent["lng"],
                "type": "continent", "_score": score,
            })

    if not results:
        return jsonify({"error": "Location not found", "query": query}), 404

    results.sort(key=lambda x: -x.pop("_score", 0))
    best = results[0]
    return jsonify({
        "name":      best["name"],
        "country":   best.get("country", ""),
        "continent": best.get("continent", ""),
        "lat":       best["lat"],
        "lng":       best["lng"],
        "type":      best["type"],
        "all":       results[:10],
    })


# =============================
# THREAT MAP API
# =============================
@app.route("/api/threat-map")
@login_required
def api_threat_map():
    import random
    from datetime import datetime, timedelta

    SIMULATED_THREATS = [
        {"country": "India",          "city": "Mumbai",      "lat": 19.0760,  "lng": 72.8777,   "threat": "Phishing URL",          "severity": "HIGH"},
        {"country": "United States",  "city": "New York",    "lat": 40.7128,  "lng": -74.0060,  "threat": "Credential Harvesting",  "severity": "HIGH"},
        {"country": "Russia",         "city": "Moscow",      "lat": 55.7558,  "lng": 37.6173,   "threat": "Malware Distribution",   "severity": "HIGH"},
        {"country": "China",          "city": "Beijing",     "lat": 39.9042,  "lng": 116.4074,  "threat": "Spear Phishing",         "severity": "HIGH"},
        {"country": "Brazil",         "city": "São Paulo",   "lat": -23.5505, "lng": -46.6333,  "threat": "Banking Trojan",         "severity": "HIGH"},
        {"country": "Nigeria",        "city": "Lagos",       "lat": 6.5244,   "lng": 3.3792,    "threat": "Advance Fee Fraud",      "severity": "HIGH"},
        {"country": "Germany",        "city": "Berlin",      "lat": 52.5200,  "lng": 13.4050,   "threat": "Phishing URL",           "severity": "MEDIUM"},
        {"country": "United Kingdom", "city": "London",      "lat": 51.5074,  "lng": -0.1278,   "threat": "CEO Fraud",              "severity": "MEDIUM"},
        {"country": "France",         "city": "Paris",       "lat": 48.8566,  "lng": 2.3522,    "threat": "Credential Harvesting",  "severity": "MEDIUM"},
        {"country": "Ukraine",        "city": "Kyiv",        "lat": 50.4501,  "lng": 30.5234,   "threat": "Ransomware C2",          "severity": "HIGH"},
        {"country": "South Korea",    "city": "Seoul",       "lat": 37.5665,  "lng": 126.9780,  "threat": "Phishing URL",           "severity": "MEDIUM"},
        {"country": "Japan",          "city": "Tokyo",       "lat": 35.6762,  "lng": 139.6503,  "threat": "Business Email Compromise","severity": "MEDIUM"},
        {"country": "Canada",         "city": "Toronto",     "lat": 43.6532,  "lng": -79.3832,  "threat": "Phishing URL",           "severity": "LOW"},
        {"country": "Australia",      "city": "Sydney",      "lat": -33.8688, "lng": 151.2093,  "threat": "Smishing Campaign",      "severity": "MEDIUM"},
        {"country": "Turkey",         "city": "Istanbul",    "lat": 41.0082,  "lng": 28.9784,   "threat": "Phishing URL",           "severity": "HIGH"},
        {"country": "Indonesia",      "city": "Jakarta",     "lat": -6.2088,  "lng": 106.8456,  "threat": "Malware Distribution",   "severity": "MEDIUM"},
        {"country": "Mexico",         "city": "Mexico City", "lat": 19.4326,  "lng": -99.1332,  "threat": "Credential Harvesting",  "severity": "MEDIUM"},
        {"country": "South Africa",   "city": "Johannesburg","lat": -26.2041, "lng": 28.0473,   "threat": "Phishing URL",           "severity": "LOW"},
        {"country": "Poland",         "city": "Warsaw",      "lat": 52.2297,  "lng": 21.0122,   "threat": "Phishing URL",           "severity": "LOW"},
        {"country": "Netherlands",    "city": "Amsterdam",   "lat": 52.3676,  "lng": 4.9041,    "threat": "Botnet C2",              "severity": "HIGH"},
        {"country": "Romania",        "city": "Bucharest",   "lat": 44.4268,  "lng": 26.1025,   "threat": "Phishing URL",           "severity": "MEDIUM"},
        {"country": "Vietnam",        "city": "Ho Chi Minh", "lat": 10.8231,  "lng": 106.6297,  "threat": "Credential Harvesting",  "severity": "MEDIUM"},
        {"country": "Pakistan",       "city": "Karachi",     "lat": 24.8607,  "lng": 67.0011,   "threat": "Phishing URL",           "severity": "LOW"},
        {"country": "Spain",          "city": "Madrid",      "lat": 40.4168,  "lng": -3.7038,   "threat": "Phishing URL",           "severity": "LOW"},
        {"country": "Italy",          "city": "Rome",        "lat": 41.9028,  "lng": 12.4964,   "threat": "Invoice Fraud",          "severity": "MEDIUM"},
        {"country": "Singapore",      "city": "Singapore",   "lat": 1.3521,   "lng": 103.8198,  "threat": "Phishing URL",           "severity": "LOW"},
        {"country": "Egypt",          "city": "Cairo",       "lat": 30.0444,  "lng": 31.2357,   "threat": "Phishing URL",           "severity": "LOW"},
        {"country": "Colombia",       "city": "Bogotá",      "lat": 4.7110,   "lng": -74.0721,  "threat": "Credential Harvesting",  "severity": "LOW"},
        {"country": "Thailand",       "city": "Bangkok",     "lat": 13.7563,  "lng": 100.5018,  "threat": "Phishing URL",           "severity": "MEDIUM"},
        {"country": "Argentina",      "city": "Buenos Aires","lat": -34.6037, "lng": -58.3816,  "threat": "Banking Trojan",         "severity": "MEDIUM"},
    ]

    try:
        results = []
        now = datetime.utcnow()

        real_scans = Scan.query.order_by(Scan.id.desc()).limit(50).all()

        real_entries = []
        for scan in real_scans:
            if not scan.url:
                continue

            score = scan.risk_score or 0
            if score >= 70:
                severity = "HIGH"
            elif score >= 40:
                severity = "MEDIUM"
            else:
                severity = "LOW"

            if severity == "LOW" and score < 20:
                continue

            result_text = (scan.result or "").lower()
            if "phishing" in result_text:
                threat_type = "Phishing URL"
            elif "suspicious" in result_text:
                threat_type = "Suspicious URL"
            elif "safe browsing" in result_text:
                threat_type = "Malware Distribution"
            elif "ssl" in result_text or "certificate" in result_text:
                threat_type = "SSL Anomaly"
            elif "ip address" in result_text:
                threat_type = "Raw IP Phishing"
            elif "new" in result_text and "domain" in result_text:
                threat_type = "New Domain Phishing"
            else:
                threat_type = "Phishing URL"

            loc = random.choice(SIMULATED_THREATS)
            ts  = now - datetime.timedelta(minutes=random.randint(1, 120))
            if hasattr(scan, 'created_at') and scan.created_at:
                ts = scan.created_at

            real_entries.append({
                "country":  loc["country"],
                "city":     loc["city"],
                "lat":      loc["lat"] + random.uniform(-0.5, 0.5),
                "lng":      loc["lng"] + random.uniform(-0.5, 0.5),
                "threat":   threat_type,
                "severity": severity,
                "time":     ts.isoformat() if hasattr(ts, 'isoformat') else str(ts),
            })

        results.extend(real_entries[:10])

        needed = max(0, 15 - len(results))
        if needed > 0:
            pool = random.sample(SIMULATED_THREATS, min(needed, len(SIMULATED_THREATS)))
            for item in pool:
                minutes_ago = random.randint(1, 180)
                ts = now - datetime.timedelta(minutes=minutes_ago)
                results.append({
                    "country":  item["country"],
                    "city":     item["city"],
                    "lat":      round(item["lat"] + random.uniform(-0.8, 0.8), 4),
                    "lng":      round(item["lng"] + random.uniform(-0.8, 0.8), 4),
                    "threat":   item["threat"],
                    "severity": item["severity"],
                    "time":     ts.isoformat(),
                })

        random.shuffle(results)
        results = results[:20]

        return jsonify(results)

    except Exception as e:
        return jsonify({"error": "Failed to fetch threat map data", "details": str(e)}), 500


# =============================
# RUN APP
# =============================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=True)