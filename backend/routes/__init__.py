"""
Routes package initialization
Registers all blueprints
"""
from routes.auth import auth_bp
from routes.profile import profile_bp
from routes.sessions import sessions_bp
from routes.verification import verification_bp
from routes.reports import reports_bp
from routes.admin import admin_bp
from routes.notifications import notifications_bp

__all__ = [
    'auth_bp',
    'profile_bp',
    'sessions_bp',
    'verification_bp',
    'reports_bp',
    'admin_bp',
    'notifications_bp'
]
