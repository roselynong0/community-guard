# Community Guard Backend

Professional Flask-based backend for the Community Guard application.

## Quick Setup

1. Install dependencies:
```bash
cd backend
pip install -r requirements.txt
```

2. Configure environment variables (`.env`):
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
MJ_APIKEY_PUBLIC=your_mailjet_public_key
MJ_APIKEY_SECRET=your_mailjet_secret_key
SECRET_KEY=your_secret_key
EMAIL_CODE_EXPIRY=10
FLASK_ENV=development
FRONTEND_URL=http://localhost:5173
PORT=5000
```

3. Run server:
```bash
python app.py
```
API available at `http://localhost:5000`

## Project Structure

```
backend/
├── app.py                 # Flask app factory
├── config.py              # Configuration
├── middleware/auth.py     # Token validation decorators
├── routes/                # API blueprints
│   ├── auth.py           # Login, register, password reset
│   ├── profile.py        # User profile operations
│   ├── sessions.py       # Session management
│   ├── reports.py        # Report/incident management
│   ├── admin.py          # Admin operations
│   ├── notifications.py  # Notification endpoints
│   └── verification.py   # Email verification
├── utils/                # Utilities
│   ├── supabase_client.py  # Database client
│   ├── email.py            # Email service
│   └── helpers.py          # Helper functions
└── uploads/              # File uploads
```

## API Endpoints (Blueprint Architecture)

### Auth
- `POST /api/register` - User registration
- `POST /api/login` - User login  
- `POST /api/logout` - User logout
- `POST /api/password/forgot` - Request password reset
- `POST /api/password/reset` - Reset password

### Profile
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update profile
- `DELETE /api/profile` - Delete account
- `POST /api/profile/upload-avatar` - Upload avatar

### Sessions
- `GET /api/sessions` - List active sessions
- `DELETE /api/sessions/<id>` - Revoke session
- `DELETE /api/sessions/revoke_all` - Revoke all sessions

### Verification
- `POST /api/email/send-code` - Send verification code
- `POST /api/email/verify-code` - Verify code

### Reports
- `GET /api/reports` - Get reports
- `POST /api/reports` - Create report
- `PUT /api/reports/<id>` - Update report
- `DELETE /api/reports/<id>` - Delete report

### Admin
- `GET /api/admin/users` - Get all users
- `PUT /api/admin/users/<id>/verification` - Update verification status
- `GET /api/admin/admin_notifications` - Get admin notifications

### Barangay
- `GET /api/barangay/notifications` - Get barangay notifications

### Responder
- `GET /api/responder/notifications` - Get responder notifications

### Notifications
- `GET /api/notifications` - Get user notifications
- `POST /api/notifications/<id>/read` - Mark as read
- `DELETE /api/notifications/<id>` - Delete notification

> All endpoints require `Authorization: Bearer {token}` header

## Features

- **Role-Based Access Control**: Admin, Barangay Official, Responder, User roles
- **JWT Authentication**: Secure token-based authentication
- **Email Verification**: Send verification codes via Mailjet
- **Session Management**: Track and revoke user sessions
- **Report Management**: Create, update, delete incident reports
- **Optimized Notifications**: Role-specific notification endpoints
- **Database**: Supabase (PostgreSQL) with real-time capabilities
- **CORS**: Configured for frontend and production domains

## Troubleshooting

**Port conflicts:**
```bash
# Change PORT in .env if 5000 is in use
# Update VITE_API_URL in frontend/.env to http://localhost:5001
```

**Database connection errors:**
- Verify Supabase URL and key in `.env`
- Check Supabase project is active
- Ensure environment variables are set correctly

**Deployment:**
```bash
# Backend auto-detects environment (localhost vs. production)
# Set FLASK_ENV=production for Vercel deployment
# Set all environment variables in Vercel Dashboard
```
