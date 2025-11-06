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
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
    
    # Flask Configuration
    DEBUG = True
    PORT = 5000
    
    # Cache Configuration
    CACHE_TYPE = 'SimpleCache'
    CACHE_DEFAULT_TIMEOUT = 300
    
    # Upload Configuration
    UPLOAD_FOLDER = os.path.join(os.getcwd(), "backend", "uploads")
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size
