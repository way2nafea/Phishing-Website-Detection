# =============================
# IMPORTS
# =============================
from flask import Flask, render_template, request, redirect, url_for, flash, send_from_directory
import os
import json
import datetime
import numpy as np

from flask_login import (
    LoginManager,
    login_user,
    login_required,
    logout_user,
    current_user
)

from flask_bcrypt import Bcrypt

# OAuth support
from flask_dance.contrib.google import make_google_blueprint, google
from flask_dance.contrib.facebook import make_facebook_blueprint, facebook

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

from database import db
from models import Scan, User

# In-memory report cache for user-reported phishing URLs
reported_phishes = []


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
    db.create_all()
    inspector = inspect(db.engine)
    if "scan" in inspector.get_table_names():
        scan_columns = [c['name'] for c in inspector.get_columns('scan')]
        with db.engine.begin() as conn:
            if 'risk_score' not in scan_columns:
                conn.execute(text("ALTER TABLE scan ADD COLUMN risk_score FLOAT"))
            if 'created_at' not in scan_columns:
                conn.execute(text("ALTER TABLE scan ADD COLUMN created_at DATETIME"))

login_manager = LoginManager(app)
login_manager.login_view = "login"

# Allow local dev over http for OAuth (remove in production)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

# OAuth configuration (set these in env vars)
google_blueprint = make_google_blueprint(
    client_id=os.environ.get('GOOGLE_OAUTH_CLIENT_ID', ''),
    client_secret=os.environ.get('GOOGLE_OAUTH_CLIENT_SECRET', ''),
    scope=['profile', 'email'],
    redirect_url='/login/google/callback'
)
facebook_blueprint = make_facebook_blueprint(
    client_id=os.environ.get('FACEBOOK_OAUTH_CLIENT_ID', ''),
    client_secret=os.environ.get('FACEBOOK_OAUTH_CLIENT_SECRET', ''),
    scope=['email'],
    redirect_url='/login/facebook/callback'
)

app.register_blueprint(google_blueprint, url_prefix='/login')
app.register_blueprint(facebook_blueprint, url_prefix='/login')


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


def get_top_phishing_examples():
    return [
        {
            "url": "http://secure-paypal.com",
            "reason": "PayPal typosquatting impersonation",
            "source": "phishfeed-light",
            "last_seen": "2026-03-26",
        },
        {
            "url": "http://appleid.apple.com-login.com",
            "reason": "Fake Apple ID credential capture",
            "source": "phishwatch",
            "last_seen": "2026-03-25",
        },
        {
            "url": "http://dropboxlogin-verify.com",
            "reason": "Cloud storage credential theft",
            "source": "threatintel-db",
            "last_seen": "2026-03-24",
        },
        {
            "url": "http://facebook-account-upgrade.com",
            "reason": "Social media account takeover",
            "source": "rapid7-radar",
            "last_seen": "2026-03-26",
        },
        {
            "url": "http://netflix.support-account.com",
            "reason": "Subscription offer phishing",
            "source": "openphish",
            "last_seen": "2026-03-26",
        },
        {
            "url": "http://amazon-order-alert.com",
            "reason": "Purchase invoice scam",
            "source": "phishalert",
            "last_seen": "2026-03-24",
        },
        {
            "url": "http://google-docs-share-509.com",
            "reason": "Document sharing credential harvest",
            "source": "phishfeed-light",
            "last_seen": "2026-03-23",
        },
        {
            "url": "http://microsoft-office-update.com",
            "reason": "Office 365 account phishing",
            "source": "threatstream",
            "last_seen": "2026-03-22",
        },
        {
            "url": "http://paypal-verified-login.com",
            "reason": "Fake verification page",
            "source": "phishtank",
            "last_seen": "2026-03-26",
        },
        {
            "url": "http://bankofamerica.security-update.com",
            "reason": "Bank account data steal",
            "source": "openphish",
            "last_seen": "2026-03-25",
        },
    ]


def get_threat_feed():
    return [
        {
            "title": "New state tax refund phishing wave",
            "impact": "high",
            "flagged_on": "2026-03-27",
            "recommendation": "Avoid clicking claims of immediate refunds, use official tax portal.",
        },
        {
            "title": "Email with fake delivery status from logistics provider",
            "impact": "medium",
            "flagged_on": "2026-03-26",
            "recommendation": "Verify tracking link via official carrier website.",
        },
        {
            "title": "Credential reuse phishing campaign (new crypto exchange)",
            "impact": "high",
            "flagged_on": "2026-03-24",
            "recommendation": "Enforce 2FA, check domain name carefully.",
        },
    ]


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
    report = {
        "apk_url": apk_url,
        "status": "NOT_SCANNED",
        "risk_score": 0,
        "details": [],
    }

    if apk_file and apk_file.filename:
        report["status"] = "UNSUPPORTED"
        report["details"].append("APK upload scanning is not implemented in this MVP.")
    elif apk_url:
        report["status"] = "UNSUPPORTED"
        report["details"].append("APK URL scanning integration can be added with VirusTotal API.")
    else:
        report["status"] = "INVALID"
        report["details"].append("No APK file or URL provided.")

    return report


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

    top_phishing = get_top_phishing_examples()
    threat_feed = get_threat_feed()
    return render_template(
        "assistant.html",
        suggestion=suggestion,
        popular_suggestions=popular_suggestions,
        top_phishing=top_phishing,
        threat_feed=threat_feed,
        reported_phishes=reported_phishes,
    )


# =============================
# REPORT PHISHING URL
@app.route("/assistant/report", methods=["POST"])
@login_required
def assistant_report():
    report_url = request.form.get("report_url", "").strip()
    report_reason = request.form.get("report_reason", "User submitted phishing report").strip()

    if report_url:
        reported_phishes.insert(0, {
            "url": report_url,
            "reason": report_reason,
            "user": current_user.username,
            "reported_on": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        })
        flash("Thanks! URL reported for review.", "success")
    else:
        flash("Please provide a URL to report.", "danger")

    return redirect(url_for("assistant"))


# =============================
# SECURITY SUITE ROUTES
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

    # Save scan result to history with risk score
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

    # Legacy checker logic below is skipped by early return.

    assistant_hint = None
    query_url = request.args.get("url")
    if request.method == "GET" and query_url:
        assistant_hint = assistant_suggestion(query_url)

    if request.method == "POST":

        raw_url = request.form.get("url")
        url = normalize_url(raw_url)
        domain = get_domain(url)

        risk_score = 0
        prediction = ""
        xx = 0

        # =============================
        # HARD SECURITY CHECKS
        # =============================

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
                # =============================
                # ML PREDICTION
                # =============================
                phishing_prob, legit_prob = model.predict(url)

                # If ML confidence weak → use DL (optional)
                if 40 <= legit_prob <= 60 and dl_model:
                    print("🔬 ML Confidence Weak → Using DL Model")
                    # NOTE: Only works if you extract numeric features properly
                    # For now we skip DL unless you build feature extractor
                    # dl_result = dl_predict(features)

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

        # =============================
        # SAVE SCAN
        # =============================
        new_scan = Scan(
            url=raw_url,
            risk_score=risk_score,
            result=prediction,
            user_id=current_user.id
        )

        db.session.add(new_scan)
        db.session.commit()

        return render_template(
            "index.html",
            prediction=prediction,
            url=raw_url,
            xx=xx,
            risk_score=risk_score,
            assistant_hint=assistant_hint
        )

    return render_template("index.html", assistant_hint=assistant_hint)


# =============================
# REGISTER
# =============================
@app.route("/register", methods=["GET", "POST"])
def register():

    if request.method == "POST":

        username = request.form.get("username")
        email = request.form.get("email")
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

    if request.method == "POST":

        email = request.form.get("email")
        password = request.form.get("password")

        user = User.query.filter_by(email=email).first()

        if user and bcrypt.check_password_hash(user.password, password):
            login_user(user)
            flash("Login successful!", "success")
            return redirect(url_for("assistant"))

        flash("Invalid email or password.", "danger")

    return render_template("login.html")


@app.route('/login/google')
def login_google():
    if not google.authorized:
        return redirect(url_for('google.login'))

    resp = google.get('/oauth2/v2/userinfo')
    if not resp.ok:
        flash('Google login failed. Please try again.', 'danger')
        return redirect(url_for('login'))

    info = resp.json()
    email = info.get('email')
    name = info.get('name') or email.split('@')[0]

    if not email:
        flash('Google account does not provide an email address.', 'danger')
        return redirect(url_for('login'))

    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(username=name, email=email, password=bcrypt.generate_password_hash(os.urandom(24)).decode('utf-8'))
        db.session.add(user)
        db.session.commit()

    login_user(user)
    flash('Logged in with Google successfully.', 'success')
    return redirect(url_for('assistant'))


@app.route('/login/facebook')
def login_facebook():
    if not facebook.authorized:
        return redirect(url_for('facebook.login'))

    resp = facebook.get('/me?fields=id,name,email')
    if not resp.ok:
        flash('Facebook login failed. Please try again.', 'danger')
        return redirect(url_for('login'))

    info = resp.json()
    email = info.get('email')
    name = info.get('name') or email.split('@')[0] if email else 'FacebookUser'

    if not email:
        flash('Facebook account does not provide an email address.', 'danger')
        return redirect(url_for('login'))

    user = User.query.filter_by(email=email).first()
    if not user:
        user = User(username=name, email=email, password=bcrypt.generate_password_hash(os.urandom(24)).decode('utf-8'))
        db.session.add(user)
        db.session.commit()

    login_user(user)
    flash('Logged in with Facebook successfully.', 'success')
    return redirect(url_for('assistant'))


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
@app.route('/reset-password', methods=['GET', 'POST'])
def reset_password():
    if request.method == 'POST':
        email = request.form.get('email', '').strip()
        if not email:
            flash('Please enter your email address.', 'danger')
            return redirect(url_for('reset_password'))

        # In a real app you would generate and send a reset link to the email.
        flash('If this email exists in our system, a password reset link has been sent.', 'success')
        return redirect(url_for('login'))

    return render_template('reset-password.html')


# =============================
# SOCIAL LOGIN PLACEHOLDER
@app.route('/auth/<provider>')
def social_login(provider):
    provider_name = provider.capitalize()
    if provider not in ['google', 'facebook']:
        flash('Unsupported social login provider', 'danger')
        return redirect(url_for('login'))

    flash(f'{provider_name} login is currently a placeholder in this demo. Integration with OAuth is required.', 'info')
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