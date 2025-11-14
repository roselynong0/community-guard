"""
Supabase Client Initialization
Handles safe initialization and error management
"""
import os
from supabase import create_client
from config import Config

# Initialize Supabase client with environment validation
try:
    if not Config.SUPABASE_URL or not Config.SUPABASE_KEY:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY environment variables")
    
    supabase = create_client(Config.SUPABASE_URL, Config.SUPABASE_KEY)
except Exception as e:
    print(f"Error initializing Supabase client: {str(e)}")
    raise
