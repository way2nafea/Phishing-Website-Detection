🔐 Phishing Website Detection System (Advanced)

📌 Overview
The Phishing Website Detection System is an advanced cybersecurity web application that detects malicious and phishing URLs using:
🧠 Machine Learning
🌍 Google Safe Browsing API
🔎 DNS & WHOIS validation
🔐 SSL Certificate verification
📊 Risk scoring system

👤 User authentication & scan history
The system provides real-time threat intelligence and generates a detailed security report for any given URL.

🚀 Key Features
🛡️ Multi-Layer Security Detection
IP address detection
DNS validation
Domain age (WHOIS) analysis
SSL certificate validation
Look-alike domain detection
Suspicious keyword structure detection
Google Safe Browsing API integration
Machine Learning prediction

📊 Professional Risk Score System
Each URL is assigned a risk score (0–100%):
🟢 Low Risk (Safe)
🟡 Medium Risk (Suspicious)
🔴 High Risk (Phishing)
Displayed using a dynamic progress bar.
👤 User Authentication System
User registration
Secure password hashing (Bcrypt)
Login / Logout
Session management (Flask-Login)

📈 Dashboard & Scan History
Stores each scan in database
User-specific history
Risk score tracking
Persistent storage using SQLite

🧠 Technology Stack

Backend

Python
Flask
SQLAlchemy
Flask-Login
Flask-Bcrypt

Machine Learning

Scikit-learn
Trained classification model (.pkl)

Security Intelligence

Google Safe Browsing API
WHOIS lookup
DNS validation
SSL certificate verification

Frontend

HTML
CSS
Bootstrap
Database
SQLite (scans.db)

Deployment

Render

Version Control

Git & GitHub

⚙️ System Architecture

User → Flask Web App → Security Checks Layer → ML Model → Risk Scoring Engine → Database → Response UI

1.Flow:
2.User logs in
3.User submits URL
    System performs:
    DNS check
    SSL validation
    WHOIS domain age check
    Google Safe Browsing check
    Structural analysis
    ML prediction
4.Risk score is calculated
5.Result stored in database
6.Detailed report shown to user

```
📁 Project Structure
Phishing-Website-Detection/
│
├── app.py
├── database.py
├── models.py
│
├── phishing_engine/
│   ├── utils.py
│   ├── security_checks.py
│   ├── ml_engine.py
│   ├── google_check.py
│
├── templates/
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   ├── dashboard.html
│
├── static/
│   └── style.css
│
├── pickle/
│   └── model.pkl
│
├── scans.db
├── requirements.txt
├── README.md
└── .env
```

```
🛠️ Installation & Setup (Local)
1️⃣ Clone Repository
git clone https://github.com/way2nafea/Phishing-Website-Detection.git
cd Phishing-Website-Detection
```
```
2️⃣ Create Virtual Environment
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate   # Mac/Linux
```
```
3️⃣ Install Dependencies
pip install -r requirements.txt
```
```
4️⃣ Create Environment File
Create a .env file:
GOOGLE_API_KEY=your_google_safe_browsing_api_key
SECRET_KEY=your_secret_key
```
```
5️⃣ Initialize Database
python
Then inside Python shell:
from app import app
from database import db

with app.app_context():
    db.create_all()
Exit Python.
```
```
6️⃣ Run Application
python app.py
Visit:
http://127.0.0.1:10000
```

🌐 Live Deployment
🔗 Live URL:
https://phishing-website-detection-gfss.onrender.com
⚠️ Note: Free Render services may take 20–30 seconds to wake up.

🎯 Use Cases

Cybersecurity academic projects
Phishing awareness tools
URL threat intelligence demo
ML + Security integration example
Resume-level backend project

🔮 Future Enhancements

🧬 Deep Learning (LSTM / Transformer)
📊 Dashboard analytics charts
🌍 Website screenshot preview
🧪 Adversarial attack testing
🧩 Chrome Extension version
🌐 REST API version
☁️ PostgreSQL production database
🔐 Security Features

Password hashing using Bcrypt
Session protection using Flask-Login
Input normalization
Multi-layer phishing detection
Google threat intelligence integration

📜 License
This project is developed for academic and educational purposes.

👨‍💻 Developer
Developed by Team Apex
Computer Engineering Student
Cybersecurity & Machine Learning Enthusiast

✅ Conclusion
This project demonstrates the practical integration of:
Machine Learning
Real-time threat intelligence
Backend security architecture
User authentication systems
Database persistence
It serves as a production-ready cybersecurity web application showcasing real-world phishing detection techniques.