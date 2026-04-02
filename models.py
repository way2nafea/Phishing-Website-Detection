from database import db
from flask_login import UserMixin
from flask_bcrypt import Bcrypt
import datetime

bcrypt = Bcrypt()

# ============================================================
# ADD THIS CLASS TO YOUR EXISTING models.py
# ============================================================
# Place it after your existing Scan and User model classes.
# The db object is already imported/shared via your database.py.
# ============================================================

from database import db   # already imported in your models.py — just shown for context
import datetime


class PhishReport(db.Model):
    """
    Community-submitted phishing URL reports.
    Replaces the in-memory `reported_phishes` list in app.py.
    """
    __tablename__ = "phish_report"

    id          = db.Column(db.Integer, primary_key=True)
    url         = db.Column(db.String(2048), nullable=False)
    reason      = db.Column(db.String(512),  nullable=False, default="User submitted phishing report")
    user_id     = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=True)
    username    = db.Column(db.String(150),  nullable=False, default="anonymous")

    # Moderation status: pending → verified → malicious | safe
    status      = db.Column(
        db.String(32),
        nullable=False,
        default="pending",
        # Allowed values: pending | verified | malicious | safe
    )

    reported_on = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.datetime.utcnow,
    )
    updated_on  = db.Column(
        db.DateTime,
        nullable=True,
        onupdate=datetime.datetime.utcnow,
    )

    def as_dict(self):
        return {
            "id":          self.id,
            "url":         self.url,
            "reason":      self.reason,
            "username":    self.username,
            "status":      self.status,
            "reported_on": self.reported_on.strftime("%Y-%m-%d %H:%M") if self.reported_on else "",
        }
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