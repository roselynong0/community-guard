"""
Image Helper Utilities
Handles both base64 and URL images for backward compatibility
"""
import re


def is_base64_image(url: str) -> bool:
    """
    Check if the URL is a base64-encoded image
    
    Args:
        url: Image URL or base64 string
        
    Returns:
        True if base64, False if regular URL
    """
    if not url:
        return False
    return url.startswith('data:image/')


def is_supabase_url(url: str) -> bool:
    """
    Check if the URL is from Supabase Storage
    
    Args:
        url: Image URL
        
    Returns:
        True if Supabase URL, False otherwise
    """
    if not url:
        return False
    return 'supabase.co/storage' in url


def get_image_url(avatar_url: str) -> str:
    """
    Get the proper image URL for display
    Handles both base64 and Supabase URLs
    
    Args:
        avatar_url: Image URL or base64 string
        
    Returns:
        Properly formatted image URL
    """
    if not avatar_url or avatar_url == '/default-avatar.png':
        return '/default-avatar.png'
    
    # Already a proper URL (Supabase or external)
    if is_supabase_url(avatar_url) or avatar_url.startswith('http'):
        return avatar_url
    
    # Base64 encoded image - return as is (frontend can display it)
    if is_base64_image(avatar_url):
        return avatar_url
    
    # Default fallback
    return '/default-avatar.png'


def sanitize_image_response(user_data: dict) -> dict:
    """
    Sanitize user data to ensure avatar_url is properly formatted
    
    Args:
        user_data: User dictionary from database
        
    Returns:
        User dictionary with sanitized avatar_url
    """
    if 'avatar_url' in user_data:
        user_data['avatar_url'] = get_image_url(user_data['avatar_url'])
    
    return user_data


def get_image_size_estimate(url: str) -> int:
    """
    Estimate the size of an image in bytes
    
    Args:
        url: Image URL or base64 string
        
    Returns:
        Estimated size in bytes
    """
    if not url:
        return 0
    
    if is_base64_image(url):
        # Base64 is ~33% larger than original
        # Extract base64 part after "data:image/xxx;base64,"
        base64_data = url.split(',', 1)[1] if ',' in url else url
        return len(base64_data) * 3 // 4
    
    # For URLs, we can't estimate without fetching
    return 0


def should_migrate_to_storage(avatar_url: str, size_threshold: int = 50000) -> bool:
    """
    Determine if an avatar should be migrated to Supabase Storage
    
    Args:
        avatar_url: Current avatar URL
        size_threshold: Size in bytes above which to migrate (default 50KB)
        
    Returns:
        True if should migrate, False otherwise
    """
    if not avatar_url or avatar_url == '/default-avatar.png':
        return False
    
    # Already in Supabase Storage
    if is_supabase_url(avatar_url):
        return False
    
    # Check if base64 and large
    if is_base64_image(avatar_url):
        size = get_image_size_estimate(avatar_url)
        return size > size_threshold
    
    return False
