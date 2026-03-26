# dl_model.py

import numpy as np
from tensorflow.keras.models import load_model
import os

class DLModel:
    def __init__(self):
        self.model = None
        self.model_path = "pickle/dl_model.h5"

        if os.path.exists(self.model_path):
            self.model = load_model(self.model_path)
            print("✅ DL Model Loaded Successfully!")
        else:
            print("⚠️ DL Model not found!")

    def predict(self, features):
        if self.model is None:
            return 0.0

        features = np.array(features).reshape(1, -1)
        prediction = self.model.predict(features)[0][0]

        return float(prediction * 100)