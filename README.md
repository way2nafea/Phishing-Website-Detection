# Phishing Website Detection System

## Overview

An advanced cybersecurity web application that detects malicious and phishing URLs using machine learning, Google Safe Browsing API, DNS & WHOIS validation, and SSL certificate verification. The system provides real-time threat intelligence with detailed security reports for any given URL.

## Key Features

### Multi-Layer Security Detection
- IP address detection
- DNS validation
- Domain age (WHOIS) analysis
- SSL certificate validation
- Look-alike domain detection
- Suspicious keyword structure detection
- Google Safe Browsing API integration
- Machine Learning prediction

### Professional Risk Score System
Each URL is assigned a risk score (0–100%):
- **Low Risk** (Safe)
- **Medium Risk** (Suspicious)
- **High Risk** (Phishing)

### User Authentication & Dashboard
- User registration with secure password hashing (Bcrypt)
- Login/Logout with session management (Flask-Login)
- Dashboard with scan history
- User-specific history tracking
- Persistent storage using SQLite

## Technology Stack

| Category | Technologies |
|----------|---------------|
| **Backend** | Python, Flask, SQLAlchemy, Flask-Login, Flask-Bcrypt |
| **Machine Learning** | Scikit-learn, trained classification model (.pkl) |
| **Security** | Google Safe Browsing API, WHOIS lookup, DNS validation, SSL verification |
| **Frontend** | HTML, CSS, Bootstrap |
| **Database** | SQLite (scans.db) |
| **Deployment** | Render |
| **Version Control** | Git & GitHub |

## System Architecture

```
User → Flask Web App → Security Checks Layer → ML Model → Risk Scoring Engine → Database → Response UI
```

### Workflow
1. User logs in to the application
2. User submits a URL for scanning
3. System performs comprehensive security checks:
   - DNS check
   - SSL validation
   - WHOIS domain age check
   - Google Safe Browsing check
   - Structural analysis
   - ML prediction
4. Risk score is calculated
5. Result is stored in database
6. Detailed report is displayed to user

## Project Structure

```
Phishing-Website-Detection/
├── app.py                  # Main Flask application
├── database.py             # Database configuration
├── models.py               # Database models
├── requirements.txt        # Python dependencies
│
├── phishing_engine/        # Core detection engine
│   ├── utils.py
│   ├── security_checks.py
│   ├── ml_engine.py
│   ├── google_check.py
│   └── feature.py
│
├── templates/              # HTML templates
│   ├── index.html
│   ├── login.html
│   ├── register.html
│   └── dashboard.html
│
├── static/                 # Static files
│   ├── style.css
│   ├── robots.txt
│   └── sitemap.xml
│
├── pickle/                 # Trained models
│   └── dl_model.h5
│
├── instance/               # Instance folder
├── scans.db                # SQLite database
├── .env                    # Environment variables
└── README.md
```

## Installation & Setup

### Prerequisites
- Python 3.8+
- Git
- Google Safe Browsing API key

### Local Setup

**1. Clone Repository**
```bash
git clone https://github.com/way2nafea/Phishing-Website-Detection.git
cd Phishing-Website-Detection
```

**2. Create Virtual Environment**
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Mac/Linux
python -m venv venv
source venv/bin/activate
```

**3. Install Dependencies**
```bash
pip install -r requirements.txt
```

**4. Create Environment File**
Create a `.env` file in the project root:
```env
GOOGLE_API_KEY=your_google_safe_browsing_api_key
SECRET_KEY=your_secret_key
```

**5. Initialize Database**
```bash
python
```
Inside Python shell:
```python
from app import app
from database import db

with app.app_context():
    db.create_all()
exit()
```

**6. Run Application**
```bash
python app.py
```
Visit: `http://127.0.0.1:10000`

## Live Deployment

**URL:** https://phishing-website-detection-1-qex8.onrender.com

> **Note:** Free Render services may take 20–30 seconds to wake up on first access.

## Security Features

- Password hashing using Bcrypt
- Session protection using Flask-Login
- Input normalization and validation
- Multi-layer phishing detection
- Google threat intelligence integration

## Use Cases

- Cybersecurity academic projects
- Phishing awareness training tools
- URL threat intelligence demonstrations
- ML + Security integration examples
- Production-ready backend project

## Future Enhancements

- Deep Learning models (LSTM / Transformer)
- Dashboard analytics with charts
- Website screenshot preview
- Adversarial attack testing
- Chrome Extension version
- REST API version
- PostgreSQL production database

## License

This project is developed for academic and educational purposes. See [LICENSE](LICENSE) for details.

## Developer

Developed by Team Apex  
Computer Engineering Student  
Cybersecurity & Machine Learning Enthusiast

## Conclusion

This project demonstrates the practical integration of:
- Machine Learning
- Real-time threat intelligence
- Backend security architecture
- User authentication systems
- Database persistence

It serves as a production-ready cybersecurity web application showcasing real-world phishing detection techniques.
