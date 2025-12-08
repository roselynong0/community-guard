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
    
    # Validate critical environment variables on import
    if not SUPABASE_URL:
        print("⚠️  WARNING: SUPABASE_URL not set in environment variables")
    if not SUPABASE_KEY:
        print("⚠️  WARNING: SUPABASE_KEY not set in environment variables")
    
    # Email Configuration
    EMAIL_SECRET_KEY = os.getenv("EMAIL_SECRET_KEY")
    MJ_APIKEY_PUBLIC = os.getenv("MJ_APIKEY_PUBLIC")
    MJ_APIKEY_SECRET = os.getenv("MJ_APIKEY_SECRET")
    EMAIL_CODE_EXPIRY = int(os.getenv("EMAIL_CODE_EXPIRY", 10))
    
    # Frontend Configuration
    # Auto-detect: Use localhost for dev, Vercel for production
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    
    # Flask Configuration
    DEBUG = os.getenv("FLASK_ENV", "development") == "development"
    PORT = int(os.getenv("PORT", 5000))
    
    # Cache Configuration
    CACHE_TYPE = 'SimpleCache'
    CACHE_DEFAULT_TIMEOUT = 300
    
    # Ollama Configuration
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    LLM_MODEL = os.getenv("LLM_MODEL", "phi4:mini-q4_0")
    EMBED_MODEL = os.getenv("EMBED_MODEL", "bge-m3")
    
    # Vector Database Configuration
    CHROMA_DB_PATH = os.getenv("CHROMA_DB_PATH", None)  # Uses default if not set
    
    # Upload Configuration
    # Get the backend directory path regardless of where the script is run from
    BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
    UPLOAD_FOLDER = os.path.join(BACKEND_DIR, "uploads")
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size