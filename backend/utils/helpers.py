"""
Helper Utility Functions
"""
import time
import httpx
import random
from datetime import datetime, timezone, timedelta


def supabase_retry(func, max_retries=3, base_delay=0.2, backoff_factor=3):
    """
    Retry wrapper for Supabase operations to handle transient network issues.

    - Retries on common network exceptions (httpx, ConnectionError, OSError)
    - Specifically looks for WinError 10035 / WSAEWOULDBLOCK and treats it as transient
    - Uses exponential backoff with configurable base_delay and factor
    - Logs each attempt with diagnostic details
    """
    delay = float(base_delay)
    attempt = 0
    while attempt < max_retries:
        try:
            return func()
        except Exception as e:
            attempt += 1
            # Diagnostic logging
            try:
                print(f"⚠️ supabase_retry caught exception (attempt {attempt}/{max_retries}): {type(e).__name__}")
                print("Exception repr:", repr(e))
                if hasattr(e, 'args') and e.args:
                    print("Exception args:", e.args)
            except Exception:
                pass

            # Determine if error is retryable
            is_retryable = False
            err_str = str(e).lower()

            # httpx specific
            if isinstance(e, (httpx.ReadError, httpx.ConnectError, httpx.TimeoutException)):
                is_retryable = True

            # ConnectionError / OSError / socket-like issues
            if isinstance(e, (ConnectionError, OSError)):
                is_retryable = True

            # Check textual clues (covers some environments where errno isn't exposed)
            if any(k in err_str for k in [
                'non-blocking socket operation', 'winerror 10035', 'wsawouldblock',
                'connection', 'timeout', 'read error', 'network', 'winerror 10054',
                'forcibly closed', 'connection reset', 'broken pipe'
            ]):
                is_retryable = True

            # If this looks retryable and we have attempts left, back off and retry
            if is_retryable and attempt < max_retries:
                print(f"🔄 Transient network error detected; retrying in {delay}s (attempt {attempt}/{max_retries})")
                time.sleep(delay)
                delay = delay * backoff_factor
                continue

            # No more retries or non-retryable error: raise
            print(f"❌ Supabase operation failed (attempt {attempt}/{max_retries}): {e}")
            raise

    # If we exit loop without returning, raise a final error
    raise RuntimeError("supabase_retry: exhausted retries without success")


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
