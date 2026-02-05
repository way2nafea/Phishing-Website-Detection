# app.py

from flask import Flask, render_template, request, redirect, url_for, flash
import os

from flask_login import (
    LoginManager,
    login_user,
    login_required,
    logout_user,
    current_user
)

from flask_bcrypt import Bcrypt

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


# =============================
# APP CONFIG
# =============================
app = Flask(__name__)

app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev_secret_key")
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///scans.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

bcrypt = Bcrypt(app)

login_manager = LoginManager(app)
login_manager.login_view = "login"


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


# =============================
# LOAD ML MODEL
# =============================
model = PhishingModel()


# =============================
# MAIN SCAN ROUTE
# =============================
@app.route("/", methods=["GET", "POST"])
@login_required
def index():

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

        elif get_domain_age(domain) and get_domain_age(domain) < 30:
            age = get_domain_age(domain)
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

        # =============================
        # SAVE SCAN WITH USER ID
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
            risk_score=risk_score
        )

    return render_template("index.html")


# =============================
# REGISTER
# =============================
@app.route("/register", methods=["GET", "POST"])
def register():

    if request.method == "POST":

        username = request.form.get("username")
        email = request.form.get("email")
        password = request.form.get("password")

        # Check if user already exists
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
            return redirect(url_for("index"))

        flash("Invalid email or password.", "danger")

    return render_template("login.html")


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
    scans = Scan.query.filter_by(user_id=current_user.id).order_by(Scan.id.desc()).all()
    return render_template("dashboard.html", scans=scans)


# =============================
# RUN APP
# =============================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=True)