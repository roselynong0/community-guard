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
    """
    for attempt in range(max_retries):
        try:
            return func()
        except (httpx.ReadError, httpx.ConnectError, httpx.TimeoutException, Exception) as e:
            error_str = str(e).lower()
            # Check if it's a network-related error that we should retry
            if any(keyword in error_str for keyword in [
                'non-blocking socket operation', 'connection', 'timeout', 
                'read error', 'network', 'winerror 10035'
            ]):
                if attempt < max_retries - 1:
                    print(f"🔄 Supabase operation failed (attempt {attempt + 1}/{max_retries}): {e}")
                    print(f"   Retrying in {delay}s...")
                    time.sleep(delay)
                    delay *= 2  # Exponential backoff
                    continue
                else:
                    print(f"❌ Supabase operation failed after {max_retries} attempts: {e}")
                    raise e
            else:
                # Non-network error, don't retry
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
