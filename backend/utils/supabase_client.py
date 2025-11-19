"""
Supabase Client Initialization
Handles safe initialization with retry logic
"""
import os
from supabase import create_client
from config import Config

# Initialize Supabase client with proper error handling
supabase = None

try:
    if not Config.SUPABASE_URL or not Config.SUPABASE_KEY:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY environment variables")
    
    # Create client with default settings (supabase-py manages httpx internally)
    supabase = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
    print("✅ Supabase client initialized successfully")
    
except Exception as e:
    error_msg = str(e)
    print(f"❌ FATAL: Could not initialize Supabase client: {error_msg}")
    print(f"   URL: {Config.SUPABASE_URL[:30] if Config.SUPABASE_URL else 'MISSING'}...")
    
    # Provide version troubleshooting hint
    if "proxy" in error_msg.lower() or "unexpected keyword" in error_msg.lower():
        print("💡 This may be a package version mismatch.")
        print("   Try upgrading: supabase>=2.9.0, httpx>=0.27.0, gotrue>=2.9.1")
    
    # Raise exception to prevent app from starting with broken database
    raise RuntimeError(
        f"Supabase initialization failed: {error_msg}. "
        "Check SUPABASE_URL and SUPABASE_KEY environment variables."
    ) from e

