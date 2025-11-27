"""
Helper Utility Functions
"""
import time
import httpx
import random
from datetime import datetime, timezone, timedelta


def supabase_retry(func, max_retries=3, delay=0.5):
    """
    Retry wrapper for Supabase operations to handle network issues
    Handles WinError 10054 (connection forcibly closed) and other connection errors
    """
    for attempt in range(max_retries):
        try:
            return func()
        except (httpx.ReadError, httpx.ConnectError, httpx.TimeoutException, ConnectionError, Exception) as e:
            # Print detailed diagnostics for easier debugging of API errors
            try:
                print(f"⚠️ supabase_retry caught exception (attempt {attempt+1}/{max_retries}): {type(e).__name__}")
                print("Exception repr:", repr(e))
                # Many postgrest APIError exceptions include a dict or tuple in args
                if hasattr(e, 'args') and e.args:
                    print("Exception args:", e.args)
            except Exception:
                pass

            error_str = str(e).lower()
            # Check if it's a network-related error that we should retry
            if any(keyword in error_str for keyword in [
                'non-blocking socket operation', 'connection', 'timeout', 
                'read error', 'network', 'winerror 10035', 'winerror 10054',
                'forcibly closed', 'connection reset', 'broken pipe'
            ]):
                if attempt < max_retries - 1:
                    print(f"🔄 Supabase connection error (attempt {attempt + 1}/{max_retries}): {type(e).__name__}")
                    print(f"   Retrying in {delay}s...")
                    time.sleep(delay)
                    delay *= 2  # Exponential backoff
                    continue
                else:
                    print(f"❌ Supabase operation failed after {max_retries} attempts: {e}")
                    raise e
            else:
                # Non-network error: surface it (do not swallow)
                # If it's a postgrest APIError, attempt to show the payload
                try:
                    from postgrest.exceptions import APIError
                    if isinstance(e, APIError):
                        # APIError often stores a dict or json-like detail
                        try:
                            print("Postgrest APIError details:", e.args[0])
                        except Exception:
                            pass
                except Exception:
                    pass
                raise e
    
    return None  # Should never reach here


def with_default(value, default):
    """Return default value if value is None or empty string"""
    return default if value is None or value == "" else value


def generate_verification_code():
    """Generate a 6-digit verification code"""
    return f"{random.randint(0, 999999):06}"


# Default reporter info for reports with missing user data
DEFAULT_REPORTER = {
    "id": 0, 
    "firstname": "Unknown", 
    "lastname": "User", 
    "avatar_url": None, 
    "isverified": False, 
    "verified": False
}
