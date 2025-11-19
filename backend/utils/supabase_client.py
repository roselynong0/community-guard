"""
Supabase Client Initialization - Simplified PostgreSQL client
Uses postgrest directly to avoid auth client compatibility issues
"""
import os
from postgrest import SyncPostgrestClient
from config import Config

# Initialize direct PostgreSQL client (bypassing Supabase Auth)
supabase = None

try:
    if not Config.SUPABASE_URL or not Config.SUPABASE_KEY:
        raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY environment variables")
    
    # Create a simple wrapper class that mimics supabase client's .table() method
    class SimpleSupabaseClient:
        def __init__(self, url, key):
            self.rest_url = f"{url}/rest/v1"
            self.headers = {
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            }
            self._client = SyncPostgrestClient(self.rest_url, headers=self.headers)
        
        def table(self, table_name):
            """Access a table using postgrest directly"""
            return self._client.from_(table_name)
    
    supabase = SimpleSupabaseClient(Config.SUPABASE_URL, Config.SUPABASE_KEY)
    print("✅ Supabase client initialized successfully (direct PostgreSQL mode)")
    
except Exception as e:
    error_msg = str(e)
    print(f"❌ FATAL: Could not initialize Supabase client: {error_msg}")
    print(f"   URL: {Config.SUPABASE_URL[:30] if Config.SUPABASE_URL else 'MISSING'}...")
    
    # Raise exception to prevent app from starting with broken database
    raise RuntimeError(
        f"Supabase initialization failed: {error_msg}. "
        "Check SUPABASE_URL and SUPABASE_KEY environment variables."
    ) from e

