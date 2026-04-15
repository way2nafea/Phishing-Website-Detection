# NEXUS: Phishing Website Detection and Analysis System

**Abstract:**
Phishing attacks represent a pervasive threat to global cybersecurity, necessitating the development of robust, automated detection mechanisms. This project, NEXUS, implements a multi-layered analysis system that integrates machine learning algorithms with real-time threat intelligence. By utilizing a combination of lexical feature extraction and live data feeds from Google Safe Browsing, OpenPhish, and PhishTank, NEXUS provides high-accuracy identification of malicious URLs. The system is designed to provide comprehensive forensic insights and risk scoring, serving as an effective defensive tool for end-users and security researchers in the fight against digital fraud.

---

### Introduction

In the current digital landscape, phishing remains one of the most common vectors for data breaches and identity theft. As attackers move beyond simple mimicry to sophisticated social engineering, traditional static blacklists have become inadequate for detecting zero-day threats. Therefore, there is a critical need for an intelligent system capable of identifying malicious intent through property analysis. NEXUS addresses this challenge by employing a predictive approach, analyzing the structural and infrastructural DNA of a website to determine its legitimacy before a user is compromised.

---

### System Overview

NEXUS is a comprehensive threat intelligence platform that offers the following core capabilities:

- **Multi-layer URL Scanner**: A deep-inspection engine that evaluates DNS records, SSL certificates, and complex URL structural patterns.
- **Threat Intelligence APIs**: Seamless integration with global threat registries to provide verified security signals and real-time validation.
- **AI-based Risk Analysis**: A machine learning layer that classifies URLs based on trained structural features and predictive scoring.
- **Real-time Dashboard**: An interactive interface powered by Chart.js for monitoring scan history and visualizing threat analytics.
- **Integrated Security Suite**: Modular specialized components for analyzing SMS phishing templates and Android (APK) package metadata.

---

### Key Features

- **Machine Learning-based detection**: Utilizes a trained classification model for high-accuracy phishing prediction.
- **Real-time Infrastructure Validation**: Automated checks for DNS health and SSL/TLS certificate transparency.
- **Google Safe Browsing Integration**: Direct verification against Google's repository of dangerous web resources.
- **Intelligence Synchronization**: Aggregated feeds from OpenPhish and PhishTank for up-to-the-minute threat detection.
- **Heuristic Risk Scoring**: A weighted algorithm that provides a clear "Safe", "Suspicious", or "Phishing" verdict.
- **Persistent Analytics Dashboard**: Secure user accounts with full access to historical scan data and security metrics.

---

### Project Information

**Project Members:**
1. Nakade Abdul Nafea Nasir (Team Leader)
2. Shaikh Abdul Rahim Sultan Ahmed
3. Sayyed Zidan Nasir
4. Ansari Zaid Ayub

**Project Guide:**
Prof. Prathamesh Yadav (Primary Guide)

---

### Technical Specification

- **Backend Architecture**: Python, Flask
- **Machine Learning Engine**: Scikit-learn
- **Frontend Framework**: HTML5, CSS3, JavaScript
- **Data Visualization**: Chart.js
- **Intelligence API**: Google Safe Browsing API
- **Database Layer**: SQLite / SQLAlchemy

---

### Deployment and Installation

To initialize and run the NEXUS system locally, follow these steps:

1. **Install Dependencies**:
   `pip install -r requirements.txt`

2. **Execute Application**:
   `python app.py`

3. **Initalize Interface**:
   Navigate to `http://localhost:10000` in a modern web browser.

---

### Data Sources and References

- **Kaggle Phishing Dataset**: Primary training data for the heuristic model.
- **URLHaus Threat Feed**: Real-time repository of malicious URL signatures.
- **Google Safe Browsing Documentation**: API specifications for threat integration.
- **PhishTank API**: Community-driven phishing verification data.

---

### Conclusion

The NEXUS system effectively demonstrates how machine learning and real-time intelligence can be synthesized to mitigate the impact of phishing attacks. By providing users with immediate, forensic-level insights into URL safety, the project significantly reduces the success rate of deceptive digital campaigns. NEXUS serves as a scalable foundation for modern cybersecurity defense, showcasing the transition from reactive blacklisting to proactive, intelligent threat detection.

---
© 2026  Team Apex · SE (COMP) Div B · Mini Project-I (MP-1)
