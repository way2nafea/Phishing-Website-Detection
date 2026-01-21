🛡️ Phishing Website Detection System

A machine learning–based web application that detects phishing websites using URL-based features.
The system analyzes a user-provided URL and predicts whether it is phishing or legitimate using a trained ML model, deployed with a Flask web interface.

📌 Project Overview

Phishing attacks are a major cybersecurity threat where attackers trick users into revealing sensitive information via fake websites.
This project helps identify such malicious URLs by applying machine learning techniques on extracted URL features.

✨ Features

Detects phishing and legitimate websites using URL analysis

Machine learning–based prediction model

Simple and user-friendly web interface

Real-time URL classification

Deployed on a live server (Render)

🧠 Technology Stack

Programming Language: Python

Web Framework: Flask

Machine Learning: Scikit-learn

Frontend: HTML, CSS

Deployment: Render

Version Control: Git & GitHub

⚙️ System Architecture

User enters a website URL

URL features are extracted using predefined rules

Trained ML model analyzes the features

Website is classified as Phishing or Legitimate

Result is displayed on the web interface

📁 Project Structure
Phishing-Website-Detection/
│
├── app.py                  # Flask web application (main entry point)
├── feature.py              # URL feature extraction logic
├── train_model.py          # Machine learning model training script
├── phishing.csv             # Dataset (phishing & legitimate URLs)
├── requirements.txt        # Project dependencies
├── .gitignore              # Git ignored files
├── README.md               # Project documentation
│
├── pickle/
│   └── model.pkl           # Trained machine learning model
│
├── templates/
│   └── index.html          # Frontend HTML (Flask template)
│
└── static/
    └── style.css           # CSS styling

⚙️ Installation & Setup (Local)
🔹 Prerequisites

Python 3.8 or above

Git

pip (Python package manager)

🔹 Step-by-Step Installation
# 1. Clone the repository
git clone https://github.com/way2nafea/Phishing-Website-Detection.git

# 2. Navigate to project directory
cd Phishing-Website-Detection

# 3. Install required dependencies
pip install -r requirements.txt

# 4. Run the Flask application
python app.py

🔹 Access the Application

Open your browser and visit:

http://127.0.0.1:5000/

🌐 Live Deployment

The application is deployed on Render and is accessible online:

🔗 Live URL:
https://phishing-website-detection-gfss.onrender.com

⚠️ Note: Free Render instances may take a few seconds to start after inactivity.

🧪 Dataset Information

The dataset (phishing.csv) contains URLs labeled as:

1 → Phishing

0 → Legitimate

Used to train the machine learning classification model

🤖 Machine Learning Model

Feature extraction is based on URL characteristics such as:

URL length

Special characters

Domain information

HTTPS usage

Model used: Gradient Boosting Classifier

Trained model is stored as model.pkl

👥 Team Contributions

This project was developed as a team-based mini project.

All team members contributed through GitHub collaboration

Contributions include coding, testing, documentation, and deployment

📌 Use Cases

Educational demonstration of phishing detection

Cybersecurity awareness projects

Academic mini project for engineering students

Example of ML + Flask integration

🔮 Future Enhancements

Improve accuracy with advanced models

Add browser extension support

Integrate real-time threat intelligence APIs

Enhance UI/UX design

📜 License

This project is developed for educational purposes only.
