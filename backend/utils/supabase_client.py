"""
Supabase Client Initialization
Handles safe initialization with connection pooling and retry logic
"""
import os
import httpx
from supabase import create_client
from config import Config

# Initialize Supabase client with proper error handling and connection pooling
supabase = None

try:
    if not Config.SUPABASE_URL or not Config.SUPABASE_KEY:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY environment variables")
    
    # Create httpx client with connection pooling and timeout settings
    http_client = httpx.Client(
        timeout=httpx.Timeout(30.0, connect=10.0),  # 30s total, 10s connect
        limits=httpx.Limits(
            max_keepalive_connections=20,
            max_connections=100,
            keepalive_expiry=30.0
        ),
        http2=True,  # Enable HTTP/2 for better performance
    )
    
    # Create client with explicit configuration
    supabase = create_client(
        Config.SUPABASE_URL, 
        Config.SUPABASE_KEY,
        options={
            'postgrest': {
                'client': http_client
            }
        }
    )
    print("✓ Supabase client initialized successfully with connection pooling")
    
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

