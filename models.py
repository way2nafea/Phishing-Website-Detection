from database import db
from flask_login import UserMixin
from flask_bcrypt import Bcrypt

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
    risk_score = db.Column(db.Float)
    result = db.Column(db.String(200))

    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)