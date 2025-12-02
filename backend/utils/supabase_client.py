"""
Supabase Client Initialization - Simplified PostgreSQL client
Uses postgrest directly to avoid auth client compatibility issues
"""
import os
import time
import requests
from types import SimpleNamespace
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
            # Don't create client yet - lazy init on first use
            self._url = url
            self._key = key
            self._client = None
        
        def _get_client(self):
            """Lazy initialize the postgrest client"""
            if self._client is None:
                self._client = SyncPostgrestClient(self.rest_url, headers=self.headers)
            return self._client
        
        def table(self, table_name):
            """Access a table using postgrest directly with retry logic"""
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    client = self._get_client()
                    return client.from_(table_name)
                except Exception as e:
                    if attempt < max_retries - 1:
                        # DNS or connection error - retry after delay
                        wait_time = (attempt + 1) * 1
                        print(f"⚠️  Connection attempt {attempt + 1} failed, retrying in {wait_time}s...")
                        time.sleep(wait_time)
                    else:
                        # Final attempt failed
                        error_msg = str(e)
                        if "11001" in error_msg or "getaddrinfo" in error_msg:
                            raise ConnectionError(
                                f"Cannot connect to Supabase ({self._url}). "
                                "Check your internet connection or firewall settings."
                            ) from e
                        raise

        def rpc(self, fn_name, params=None):
            """Call a Postgres function via Supabase REST RPC endpoint.

            Returns a SimpleNamespace with a `data` attribute (list or object) to
            match the minimal interface expected by route handlers.
            """
            params = params or {}
            # Prefer using the postgrest client if it exposes rpc
            try:
                client = self._get_client()
                if hasattr(client, 'rpc'):
                    resp = client.rpc(fn_name, params)
                    # postgrest client typically returns an object we can read
                    return resp
            except Exception:
                # Fall through to direct HTTP call
                pass

            # Fallback: call REST RPC endpoint directly
            url = f"{self.rest_url}/rpc/{fn_name}"
            headers = self.headers.copy()
            try:
                r = requests.post(url, headers=headers, json=params, timeout=10)
                r.raise_for_status()
                try:
                    data = r.json()
                except ValueError:
                    data = None
                return SimpleNamespace(data=data, status_code=r.status_code, text=r.text)
            except Exception as e:
                raise
    
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

