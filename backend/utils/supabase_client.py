"""
Supabase Client Initialization - Simplified PostgreSQL client
Uses postgrest directly to avoid auth client compatibility issues
"""
import os
import time
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
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
                    # Create a shared requests Session with connection pooling and retries
                    self._session = requests.Session()
                    retry_strategy = Retry(
                        total=2,
                        backoff_factor=0.2,
                        status_forcelist=[429, 500, 502, 503, 504],
                        allowed_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
                    )
                    # Increase pool_maxsize to better handle concurrent requests
                    adapter = HTTPAdapter(pool_connections=100, pool_maxsize=100, max_retries=retry_strategy)
                    self._session.mount("https://", adapter)
                    self._session.mount("http://", adapter)

                    # Initialize postgrest client once. If SyncPostgrestClient accepts a session
                    # parameter, pass our session to it; otherwise it will use its own HTTP logic.
                    try:
                        self._client = SyncPostgrestClient(self.rest_url, headers=self.headers)
                    except Exception:
                        # Fallback: still try to create client (some versions have different signatures)
                        self._client = SyncPostgrestClient(self.rest_url, headers=self.headers)
                    # Simple in-memory TTL cache to avoid repeating identical REST selects
                    self._cache = {}
                    self._cache_ttl = 60  # seconds
            return self._client
        
        def table(self, table_name):
            """Access a table using postgrest client. Leave retry behaviour to supabase_retry wrapper.

            This method returns a postgrest `from_(table_name)` object which callers can
            use to build and execute queries. Avoid doing heavy retry logic here to
            prevent double-retries and long cumulative waits.
            """
            client = self._get_client()
            return client.from_(table_name)

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
                    return resp
            except Exception:
                # Fall through to direct HTTP call using our session
                pass

            # Fallback: call REST RPC endpoint directly
            url = f"{self.rest_url}/rpc/{fn_name}"
            headers = self.headers.copy()
            sess = getattr(self, '_session', requests)
            try:
                r = sess.post(url, headers=headers, json=params, timeout=10)
                r.raise_for_status()
                try:
                    data = r.json()
                except ValueError:
                    data = None
                return SimpleNamespace(data=data, status_code=r.status_code, text=r.text)
            except Exception:
                raise
        def rest_select(self, table, select='*', in_field=None, in_values=None, eq_field=None, eq_value=None, limit=None, order=None):
            """Perform a REST v1 select using the shared requests session.

            Uses PostgREST query syntax, e.g. `id=in.(a,b)` and `user_id=eq.123`.
            Returns a SimpleNamespace with `.data` matching the postgrest response.
            """
            params = {}
            if select:
                params['select'] = select
            # Build cache key for common batch selects
            cache_key = None
            if in_field and in_values:
                joined = ','.join(map(str, in_values))
                params[in_field] = f'in.({joined})'
                cache_key = f"{table}:{select}:{in_field}:{joined}"
            if eq_field and eq_value is not None:
                params[eq_field] = f'eq.{eq_value}'
                if cache_key is None:
                    cache_key = f"{table}:{select}:{eq_field}:{eq_value}"
                else:
                    cache_key = f"{cache_key}|{eq_field}:{eq_value}"
            if limit:
                params['limit'] = str(limit)
            if order:
                params['order'] = order

            # Check cache
            if cache_key:
                entry = getattr(self, '_cache', {}).get(cache_key)
                if entry and (time.time() - entry['ts'] < getattr(self, '_cache_ttl', 60)):
                    return SimpleNamespace(data=entry['data'], status_code=200, text='cached')
            url = f"{self.rest_url}/{table}"
            sess = getattr(self, '_session', requests)
            results = []
            try:
                if in_field and in_values and len(in_values) > 50:
                    chunk_size = 50
                    for i in range(0, len(in_values), chunk_size):
                        chunk = in_values[i:i+chunk_size]
                        chunk_params = params.copy()
                        joined_chunk = ','.join(map(str, chunk))
                        chunk_params[in_field] = f'in.({joined_chunk})'
                        r = sess.get(url, headers=self.headers, params=chunk_params, timeout=5)
                        r.raise_for_status()
                        try:
                            data = r.json() or []
                        except ValueError:
                            data = []
                        results.extend(data)
                else:
                    r = sess.get(url, headers=self.headers, params=params, timeout=5)
                    r.raise_for_status()
                    try:
                        results = r.json() or []
                    except ValueError:
                        results = []
                if cache_key:
                    try:
                        self._cache[cache_key] = {'ts': time.time(), 'data': results}
                    except Exception:
                        pass
                return SimpleNamespace(data=results, status_code=200, text='ok')
            except Exception:
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

