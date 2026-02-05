import pandas as pd
import pickle
import os
from sklearn.model_selection import train_test_split
from sklearn.ensemble import GradientBoostingClassifier

# Load dataset
data = pd.read_csv("phishing.csv")

# Drop index column if present
if 'index' in data.columns:
    data = data.drop(columns=['index'])

# Last column is label (Result / Class)
X = data.iloc[:, :-1]
y = data.iloc[:, -1]

# Train-test split
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# Train model
model = GradientBoostingClassifier(random_state=42)
model.fit(X_train, y_train)

# Save model
os.makedirs("pickle", exist_ok=True)
with open("pickle/model.pkl", "wb") as f:
    pickle.dump(model, f)

print("✅ Model trained successfully using pre-extracted features")