"""
Configuration Module
Handles environment variables and app configuration
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Application configuration"""
    
    # Supabase Configuration
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")
    
    # Email Configuration
    EMAIL_SECRET_KEY = os.getenv("EMAIL_SECRET_KEY")
    MAILJET_API_KEY = os.getenv("MAILJET_API_KEY")
    MAILJET_API_SECRET = os.getenv("MAILJET_API_SECRET")
    EMAIL_CODE_EXPIRY = int(os.getenv("EMAIL_CODE_EXPIRY_MINUTES", 10))
    
    # Frontend Configuration
    # Auto-detect: Use localhost for dev, Vercel for production
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    
    # Flask Configuration
    DEBUG = os.getenv("FLASK_ENV", "development") == "development"
    PORT = int(os.getenv("PORT", 5000))
    
    # Cache Configuration
    CACHE_TYPE = 'SimpleCache'
    CACHE_DEFAULT_TIMEOUT = 300
    
    # Upload Configuration
    # Get the backend directory path regardless of where the script is run from
    BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
    UPLOAD_FOLDER = os.path.join(BACKEND_DIR, "uploads")
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
