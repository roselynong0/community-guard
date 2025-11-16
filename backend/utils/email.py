"""
Email Utility Functions
Handles sending emails via Mailjet with enhanced error handling
"""
import time
from mailjet_rest import Client
from config import Config

# Initialize Mailjet client
mailjet_client = Client(
    auth=(Config.MJ_APIKEY_PUBLIC, Config.MJ_APIKEY_SECRET), 
    version='v3.1'
)


def send_with_retry(mailjet_client, data, max_retries=2, retry_delay=1):
    """Helper function to send email with retry logic"""
    for attempt in range(max_retries + 1):
        try:
            result = mailjet_client.send.create(data=data)
            if result.status_code == 200:
                return True
            
            # Log Mailjet API errors
            print(f"Mailjet API error (attempt {attempt + 1}): {result.status_code}")
            if attempt < max_retries:
                time.sleep(retry_delay)
                
        except Exception as e:
            print(f"Mailjet send error (attempt {attempt + 1}): {str(e)}")
            if attempt < max_retries:
                time.sleep(retry_delay)
                
    return False


def send_verification_email(to_email, code):
    """Send email verification code with enhanced error handling"""
    data = {
        'Messages': [{
            "From": {"Email": "roselynong0@gmail.com", "Name": "Team CodeWise"},
            "To": [{"Email": to_email}],
            "Subject": "Verify Your Email",
            "HTMLPart": f"""
            <div style='font-family:Segoe UI;padding:1rem;text-align:center;'>
                <h2>Get Verified on Community Guard</h2>
                <p>Use the code below:</p>
                <h1>{code}</h1>
                <p>Expires in {Config.EMAIL_CODE_EXPIRY} minutes.</p>
            </div>
            """
        }]
    }
    
    try:
        success = send_with_retry(mailjet_client, data)
        if not success:
            print(f"Failed to send verification email to {to_email} after retries")
        return success
    except Exception as e:
        print(f"Unexpected error sending verification email: {str(e)}")
        return False


def send_reset_code_email(to_email, code):
    """Send password reset code with enhanced error handling"""
    data = {
        'Messages': [{
            "From": {"Email": "roselynong0@gmail.com", "Name": "Team CodeWise"},
            "To": [{"Email": to_email}],
            "Subject": "Password Reset Code",
            "HTMLPart": f"""
                <div style='font-family:Segoe UI;padding:1rem;text-align:center;'>
                    <h2>Password Reset</h2>
                    <p>Use the code below to reset your password (expires in {Config.EMAIL_CODE_EXPIRY} mins):</p>
                    <h3 style="font-size:2rem;">{code}</h3>
                </div>
            """
        }]
    }
    
    try:
        success = send_with_retry(mailjet_client, data)
        if not success:
            print(f"Failed to send reset code email to {to_email} after retries")
        return success
    except Exception as e:
        print(f"Unexpected error sending reset code email: {str(e)}")
        return False