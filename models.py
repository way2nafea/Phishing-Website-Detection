from database import db
from flask_login import UserMixin
from flask_bcrypt import Bcrypt
import datetime

bcrypt = Bcrypt()

# ======================
# USER MODEL
# ======================
class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)

    scans = db.relationship('Scan', backref='user', lazy=True)


# ======================
# SCAN MODEL
# ======================
class Scan(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    url = db.Column(db.String(500))
    risk_score = db.Column(db.Float, default=0.0)
    result = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow, nullable=False)

    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)