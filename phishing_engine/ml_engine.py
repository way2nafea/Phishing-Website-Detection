# ml_engine.py
import pickle
import numpy as np
from phishing_engine.feature import FeatureExtraction


class PhishingModel:

    def __init__(self, model_path="pickle/model.pkl"):
        with open(model_path, "rb") as f:
            self.model = pickle.load(f)

    def predict(self, url):
        extractor = FeatureExtraction(url)
        features = np.array(
            extractor.getFeaturesList()
        ).reshape(1, -1)

        proba = self.model.predict_proba(features)[0]

        phishing_prob = proba[0] * 100
        legit_prob = proba[1] * 100

        return phishing_prob, legit_prob