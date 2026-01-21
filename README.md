# Phishing Website Detection System

## 📌 Overview
The **Phishing Website Detection System** is a machine learning–based web application designed to identify and classify phishing websites using URL and website-based features. The system helps users determine whether a given website URL is **legitimate or phishing**, improving online security and awareness.

---

## 🎯 Objectives
- Detect phishing websites using machine learning techniques  
- Analyze URL-based and website-related features  
- Provide a simple web interface for real-time URL checking  
- Reduce the risk of phishing attacks and fraudulent websites  

---

## 🧠 Technology Stack
- **Programming Language:** Python  
- **Framework:** Flask  
- **Machine Learning:** Scikit-learn  
- **Frontend:** HTML, CSS  
- **Backend:** Flask (Python)  
- **Deployment:** Render  
- **Version Control:** Git & GitHub  

---

## ⚙️ System Architecture
1. User enters a website URL  
2. URL features are extracted using predefined rules  
3. Trained ML model predicts whether the website is phishing or legitimate  
4. Result is displayed on the web interface  

---

## 📁 Project Structure
Phishing-Website-Detection/
│
├── app.py # Flask application
├── feature.py # Feature extraction logic
├── train_model.py # Model training script
├── phishing.csv # Dataset
├── requirements.txt # Project dependencies
├── pickle/
│ └── model.pkl # Trained ML model
├── templates/
│ └── index.html # Frontend HTML
├── static/
│ └── style.css # CSS styling
├── .gitignore
└── README.md



---

## 🚀 How It Works
- The model is trained using a dataset containing phishing and legitimate URLs.
- Features such as URL length, presence of special characters, domain age, and HTTPS usage are extracted.
- A machine learning classifier predicts the nature of the URL.
- The Flask web app provides an interface to test URLs in real time.

---

## 🛠️ Installation & Setup (Local)
```bash
git clone https://github.com/way2nafea/Phishing-Website-Detection.git
cd Phishing-Website-Detection
pip install -r requirements.txt
python app.py
Open browser and visit:

http://127.0.0.1:5000/
🌐 Live Deployment
The application is deployed on Render and accessible online:

🔗 Live URL:
https://phishing-website-detection-gfss.onrender.com

Note: Free Render instances may take a few seconds to start due to inactivity.

👥 Team Contributions
This project was developed as a team project.
All team members contributed through GitHub collaboration and commits.

📊 Use Cases
Educational demonstration of phishing detection

Cybersecurity awareness projects

Academic mini-project or experiment

URL risk analysis tool

🔮 Future Enhancements
Improve accuracy using advanced ML/DL models

Add real-time WHOIS and DNS analysis

Browser extension integration

Multi-language support

📜 License
This project is developed for academic and educational purposes.

✅ Conclusion
The Phishing Website Detection System demonstrates the effective use of machine learning in cybersecurity applications. It provides a simple yet powerful approach to identifying malicious websites and promoting safer internet usage.
