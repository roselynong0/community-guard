"""
Email Utility Functions
Handles sending emails via Mailjet
"""
from mailjet_rest import Client
from config import Config

# Initialize Mailjet client
mailjet_client = Client(
    auth=(Config.MAILJET_API_KEY, Config.MAILJET_API_SECRET), 
    version='v3.1'
)


def send_verification_email(to_email, code):
    """Send email verification code"""
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
        result = mailjet_client.send.create(data=data)
        return result.status_code == 200
    except Exception:
        return False


def send_reset_code_email(to_email, code):
    """Send password reset code"""
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
        result = mailjet_client.send.create(data=data)
        return result.status_code == 200
    except Exception as e:
        print("Error sending reset code email:", e)
        return False
