"""
Base64 Image Helper
Converts uploaded files to base64 for database storage
"""
import base64
from PIL import Image
from io import BytesIO


def image_to_base64(file_storage, max_size=(800, 800), quality=85):
    """
    Convert uploaded file to base64 string
    
    Args:
        file_storage: FileStorage object from request.files
        max_size: Tuple (width, height) to resize image
        quality: JPEG quality (1-100)
    
    Returns:
        str: Base64 data URL (data:image/jpeg;base64,...)
    """
    try:
        # Open image
        img = Image.open(file_storage)
        
        # Convert to RGB if necessary
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
            img = background
        
        # Resize if larger than max_size
        if img.size[0] > max_size[0] or img.size[1] > max_size[1]:
            img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Convert to base64
        buffer = BytesIO()
        img.save(buffer, format='JPEG', quality=quality, optimize=True)
        img_bytes = buffer.getvalue()
        img_base64 = base64.b64encode(img_bytes).decode('utf-8')
        
        # Return as data URL
        return f"data:image/jpeg;base64,{img_base64}"
    
    except Exception as e:
        print(f"Error converting image to base64: {e}")
        return None


def base64_to_image(base64_string):
    """
    Convert base64 string back to PIL Image
    
    Args:
        base64_string: Base64 data URL or raw base64 string
    
    Returns:
        PIL.Image: Image object
    """
    try:
        # Remove data URL prefix if present
        if base64_string.startswith('data:image'):
            base64_string = base64_string.split(',')[1]
        
        # Decode base64
        img_bytes = base64.b64decode(base64_string)
        img = Image.open(BytesIO(img_bytes))
        
        return img
    
    except Exception as e:
        print(f"Error converting base64 to image: {e}")
        return None


def validate_image_size(base64_string, max_bytes=5_000_000):
    """
    Check if base64 image is within size limit
    
    Args:
        base64_string: Base64 data URL
        max_bytes: Maximum size in bytes (default 5MB)
    
    Returns:
        bool: True if within limit, False otherwise
    """
    try:
        if base64_string.startswith('data:image'):
            base64_string = base64_string.split(',')[1]
        
        # Calculate size
        size = len(base64.b64decode(base64_string))
        return size <= max_bytes
    
    except Exception as e:
        print(f"Error validating image size: {e}")
        return False
