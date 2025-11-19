"""
Supabase Client Initialization
Handles safe initialization with retry logic
"""
import os
from supabase import create_client
from config import Config

# Initialize Supabase client with proper error handling and connection pooling
supabase = None

try:
    if not Config.SUPABASE_URL or not Config.SUPABASE_KEY:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY environment variables")
    
    # Create client with default settings (supabase-py manages httpx internally)
    supabase = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
    print("✓ Supabase client initialized successfully")
    
except Exception as e:
    error_msg = str(e)
    print(f"⚠ Warning: Could not initialize Supabase client: {error_msg}")
    
    # If it's the proxy error, provide helpful guidance
    if "proxy" in error_msg.lower():
        print("This is a known httpx/gotrue compatibility issue")
        print("Ensure requirements.txt has compatible versions:")
        print("  - supabase>=2.5.0")
        print("  - httpx>=0.25.0")
        print("  - gotrue>=0.4.2")
    
    # Fallback: Try without custom client
    try:
        supabase = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
        print("✓ Supabase client initialized with default settings")
    except:
        supabase = None

