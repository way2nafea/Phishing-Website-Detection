# app.py

from flask import Flask, render_template, request
import os

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
from phishing_engine.google_check import check_google_safe_browsing  # ✅ Google API

app = Flask(__name__)

# Load ML Model
model = PhishingModel()


@app.route("/", methods=["GET", "POST"])
def index():

    if request.method == "POST":

        raw_url = request.form.get("url")
        url = normalize_url(raw_url)
        domain = get_domain(url)

        # =============================
        # HARD SECURITY CHECKS
        # =============================

        # 🚨 IP address detection
        if contains_ip(domain):
            prediction = "⚠️ Website uses IP address instead of domain (High Risk)"
            xx = -1

        # 🚨 DNS validation
        elif not dns_lookup(domain):
            prediction = "⚠️ Domain does NOT exist (DNS validation failed)"
            xx = -1

        # 🚨 Google Safe Browsing (REAL-TIME THREAT INTEL)
        elif check_google_safe_browsing(url):
            prediction = "🚨 Google Safe Browsing flagged this URL as dangerous"
            xx = -1

        # 🚨 New domain detection
        elif get_domain_age(domain) is not None and get_domain_age(domain) < 30:
            age = get_domain_age(domain)
            prediction = f"⚠️ Domain is very new ({age} days old) - High Risk"
            xx = -1

        # 🚨 SSL validation
        elif not check_ssl(domain):
            prediction = "⚠️ Invalid or missing SSL certificate"
            xx = 0

        # ✅ Trusted whitelist
        elif domain in TRUSTED_DOMAINS:
            prediction = "Website appears SAFE (99.00% confidence)"
            xx = 1

        # ⚠️ Look-alike detection
        elif is_similar_to_trusted(domain):
            prediction = "⚠️ Domain looks similar to trusted site (Possible Spoofing)"
            xx = 0

        # ⚠️ Suspicious structure
        elif suspicious_structure(domain):
            prediction = "⚠️ URL contains suspicious keywords or structure"
            xx = 0

        # =============================
        # MACHINE LEARNING PREDICTION
        # =============================
        else:
            phishing_prob, legit_prob = model.predict(url)

            if legit_prob >= 70:
                prediction = f"Website appears SAFE ({legit_prob:.2f}% confidence)"
                xx = 1

            elif 50 <= legit_prob < 70:
                prediction = f"Website looks SUSPICIOUS ({legit_prob:.2f}% confidence)"
                xx = 0

            else:
                prediction = f"Website is likely PHISHING ({phishing_prob:.2f}% risk)"
                xx = -1

        return render_template(
            "index.html",
            prediction=prediction,
            url=raw_url,
            xx=xx
        )

    return render_template("index.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)