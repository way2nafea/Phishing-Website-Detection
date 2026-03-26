import pandas as pd
import numpy as np
import os

from sklearn.model_selection import train_test_split
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping

# ======================
# LOAD DATA
# ======================
data = pd.read_csv("phishing.csv")

# Drop useless column if exists
if "index" in data.columns:
    data = data.drop("index", axis=1)

# ======================
# FEATURES & LABEL
# ======================
X = data.drop("Result", axis=1)
y = data["Result"]

# Convert -1 to 0 if needed
y = y.replace(-1, 0)

# ======================
# TRAIN TEST SPLIT
# ======================
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# ======================
# BUILD DL MODEL
# ======================
model = Sequential([
    Dense(64, activation="relu", input_shape=(X.shape[1],)),
    Dropout(0.3),
    Dense(32, activation="relu"),
    Dropout(0.3),
    Dense(1, activation="sigmoid")
])

model.compile(
    optimizer="adam",
    loss="binary_crossentropy",
    metrics=["accuracy"]
)

early_stop = EarlyStopping(patience=3)

# ======================
# TRAIN
# ======================
model.fit(
    X_train, y_train,
    validation_data=(X_test, y_test),
    epochs=20,
    batch_size=32,
    callbacks=[early_stop]
)

# =============================
# SAVE MODEL
# =============================
os.makedirs("pickle", exist_ok=True)

model.save("pickle/dl_model.h5")


print("✅ DL Model Saved Successfully!")