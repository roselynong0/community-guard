# Community Guard Backend

Professional Flask-based backend for the Community Guard application.

## Structure

```
backend/
├── app.py                 # Main Flask application
├── config.py              # Configuration management
├── requirements.txt       # Python dependencies
├── middleware/            # Authentication middleware
│   ├── __init__.py
│   └── auth.py           # Token validation decorators
├── routes/               # Route blueprints
│   ├── __init__.py
│   ├── auth.py          # Authentication routes
│   ├── profile.py       # User profile routes
│   ├── sessions.py      # Session management
│   ├── verification.py  # Email verification
│   ├── reports.py       # Report/incident management
│   ├── admin.py         # Admin operations
│   └── notifications.py # Notifications
├── utils/               # Utility functions
│   ├── __init__.py
│   ├── supabase_client.py  # Supabase initialization
│   ├── helpers.py          # Helper functions
│   └── email.py            # Email utilities
└── uploads/             # File uploads directory
```

## Setup

1. Install dependencies:
```bash
cd backend
pip install -r requirements.txt
```

2. Configure environment variables (create .env file):
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
EMAIL_SECRET_KEY=your_secret_key
MAILJET_API_KEY=your_mailjet_key
MAILJET_API_SECRET=your_mailjet_secret
EMAIL_CODE_EXPIRY_MINUTES=10
FRONTEND_URL=http://localhost:5173
```

3. Run the server:
```bash
python app.py
```

The API will be available at `http://localhost:5000`

## API Endpoints

### Authentication
- POST `/api/register` - User registration
- POST `/api/login` - User login
- POST `/api/logout` - User logout
- POST `/api/password/forgot` - Request password reset
- POST `/api/password/reset` - Reset password

### Profile
- GET `/api/profile` - Get user profile
- PUT `/api/profile` - Update user profile
- DELETE `/api/profile` - Delete user profile
- POST `/api/profile/upload-avatar` - Upload avatar

### Sessions
- GET `/api/sessions` - List user sessions
- DELETE `/api/sessions/<id>` - Revoke session
- DELETE `/api/sessions/revoke_all` - Revoke all sessions

### Verification
- POST `/api/email/send-code` - Send verification code
- POST `/api/email/verify-code` - Verify code
- POST `/api/verification/validate-access` - Validate verification access

### Reports
- GET `/api/reports` - Get reports
- POST `/api/reports` - Create report
- PUT `/api/reports/<id>` - Update report
- DELETE `/api/reports/<id>` - Delete report

### Admin
- GET `/api/admin/users` - Get all users
- PUT `/api/admin/users/<id>/verification` - Update verification
- GET `/api/admin/notifications` - Get admin notifications

### Notifications
- GET `/api/notifications` - Get user notifications
- POST `/api/notifications/<id>/read` - Mark as read
- DELETE `/api/notifications/<id>` - Delete notification
