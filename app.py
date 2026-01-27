from flask import Flask, render_template, request
import numpy as np
import pickle
import os
from urllib.parse import urlparse
from feature import FeatureExtraction

app = Flask(__name__)

# ---------------------------------
# LOAD TRAINED MODEL
# ---------------------------------
with open("pickle/model.pkl", "rb") as f:
    gbc = pickle.load(f)

# ---------------------------------
# TRUSTED DOMAIN WHITELIST
# ---------------------------------
TRUSTED_DOMAINS = {
    "google.com",
    "www.google.com",
    "youtube.com",
    "www.youtube.com",
    "amazon.com",
    "www.amazon.com",
    "microsoft.com",
    "www.microsoft.com",
    "apple.com",
    "www.apple.com",
    "github.com",
    "www.github.com"
}

# ---------------------------------
# HELPER FUNCTION TO EXTRACT DOMAIN
# ---------------------------------
def get_domain(url):
    if not url.startswith("http"):
        url = "http://" + url
    parsed = urlparse(url)
    return parsed.netloc.lower()

# ---------------------------------
# MAIN ROUTE
# ---------------------------------
@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        url = request.form["url"]
        domain = get_domain(url)

        # ✅ LEVEL 0: WHITELIST CHECK
        if domain in TRUSTED_DOMAINS:
            confidence = 99.0
            pred = f"Website appears SAFE ({confidence:.2f}% confidence)"
            xx = 1

        else:
            # 🔍 FEATURE EXTRACTION
            obj = FeatureExtraction(url)
            x = np.array(obj.getFeaturesList()).reshape(1, 30)

            # 🤖 MODEL PREDICTION
            proba = gbc.predict_proba(x)[0]
            phishing_prob = proba[0] * 100
            legit_prob = proba[1] * 100

            confidence = legit_prob

            # 🔥 3-LEVEL DECISION LOGIC
            if confidence >= 80:
                pred = f"Website appears SAFE ({confidence:.2f}% confidence)"
                xx = 1

            elif 50 <= confidence < 80:
                pred = f"Website looks SUSPICIOUS ({confidence:.2f}% confidence)"
                xx = 0

            else:
                pred = f"Website is likely PHISHING ({phishing_prob:.2f}% risk)"
                xx = -1

        return render_template(
            "index.html",
            prediction=pred,
            url=url,
            xx=xx
        )

    return render_template("index.html")

# ---------------------------------
# RUN APP (Render Compatible)
# ---------------------------------
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)