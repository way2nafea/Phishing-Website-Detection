from flask import Flask, render_template, request
import numpy as np
import pickle
from feature import FeatureExtraction

app = Flask(__name__)

# load model
with open("pickle/model.pkl", "rb") as f:
    gbc = pickle.load(f)

@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        url = request.form["url"]

        obj = FeatureExtraction(url)
        x = np.array(obj.getFeaturesList()).reshape(1, 30)

        # probabilities
        y_pro_phishing = gbc.predict_proba(x)[0][0]
        y_pro_non_phishing = gbc.predict_proba(x)[0][1]

        confidence = y_pro_non_phishing * 100

        if confidence >= 70:
            pred = f"Website appears SAFE ({confidence:.2f}% confidence)"
            xx = 1
        else:
            risk = 100 - confidence
            pred = f"Website may be PHISHING ({risk:.2f}% risk)"
            xx = -1

        return render_template(
            "index.html",
            prediction=pred,
            url=url,
            xx=xx
        )

    # GET request
    return render_template("index.html")

import os

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
