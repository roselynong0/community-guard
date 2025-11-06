# Community Guard

## Overview
Community Guard is a React-based web application designed to enhance community safety through incident reporting and administrative management. The system allows residents to report incidents while providing administrators with tools to manage reports and verify users.

## 🚀 Features
- **Incident Reporting**: Residents can report safety incidents with location data
- **Administrative Dashboard**: Admins can manage reports and verify users  
- **Interactive Maps**: Visual representation of incidents using Leaflet
- **User Authentication**: Secure login/registration with email verification
- **Real-time Notifications**: Updates on report status changes
- **Mobile Responsive**: Optimized for both desktop and mobile devices

## 🛠️ Tech Stack
**Frontend:**
- React 19.1.1
- Vite (Build tool)
- React Router DOM (Navigation)
- Leaflet & React-Leaflet (Interactive maps)
- React Icons
- React DatePicker
- Recharts (Data visualization)

**Backend:**
- Flask (Python web framework)
- Supabase (Database & Authentication)
- Flask-CORS (Cross-origin requests)
- JWT (Authentication tokens)
- Bcrypt (Password hashing)
- Mailjet (Email services)

**Additional Tools:**
- ESLint (Code linting)
- PWA Support (Progressive Web App)
- Compression & Caching

## 📋 Prerequisites
Before running this project, make sure you have the following installed:
- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **Python** (v3.8 or higher) - [Download here](https://python.org/)
- **npm** or **yarn** (comes with Node.js)
- **Git** - [Download here](https://git-scm.com/)

## 🔧 Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Roselynong/community-guard.git
cd community-guard/master
```

### 2. Backend Setup

Navigate to the backend directory and install dependencies:

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in the **root directory** (or backend directory) with your credentials:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
EMAIL_SECRET_KEY=your_email_service_secret_key
MAILJET_API_KEY=your_mailjet_api_key
MAILJET_API_SECRET=your_mailjet_secret_key
EMAIL_CODE_EXPIRY_MINUTES=10
FRONTEND_URL=http://localhost:5173
```

### 3. Frontend Setup

Navigate to the frontend directory and install dependencies:

```bash
cd frontend
npm install
```

### 4. Database Setup
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key to the `.env` file
3. Run the database migrations in the `migrations/` folder

## 🚀 Running the Project

### Development Mode

You need to run **both** the backend and frontend servers in separate terminals:

**Terminal 1 - Backend (Flask API):**
```bash
cd backend
python app.py
```
Backend will run on `http://localhost:5000`

**Terminal 2 - Frontend (React/Vite):**
```bash
cd frontend
npm run dev
```
Frontend will run on `http://localhost:5173`

The Vite dev server is configured to proxy all `/api` requests to the Flask backend automatically.

### Production Build

**Backend:**
```bash
cd backend
# Use a production WSGI server like Gunicorn
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

**Frontend:**
```bash
cd frontend
npm run build
# Output will be in dist/ folder
npm run preview  # To preview the production build
```

## 📁 Project Structure

The project is now organized into separate **backend** and **frontend** directories for better modularity and professional structure:

```
community-guard/master/
│
├── backend/                    # Flask API Backend
│   ├── app.py                 # Main Flask application (uses blueprints)
│   ├── config.py              # Configuration management
│   ├── requirements.txt       # Python dependencies
│   ├── README.md              # Backend documentation
│   │
│   ├── middleware/            # Authentication middleware
│   │   ├── __init__.py
│   │   └── auth.py           # Token validation decorators
│   │
│   ├── routes/               # API route blueprints (organized by feature)
│   │   ├── __init__.py
│   │   ├── auth.py          # Authentication (login, register, logout)
│   │   ├── profile.py       # User profile management
│   │   ├── sessions.py      # Session management
│   │   ├── verification.py  # Email verification
│   │   ├── reports.py       # Report/incident management
│   │   ├── admin.py         # Admin operations
│   │   └── notifications.py # Notifications
│   │
│   ├── utils/               # Utility functions
│   │   ├── __init__.py
│   │   ├── supabase_client.py  # Supabase initialization
│   │   ├── helpers.py          # Helper functions
│   │   └── email.py            # Email utilities
│   │
│   └── uploads/             # File uploads directory
│
├── frontend/                   # React + Vite Frontend
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js         # Configured with backend proxy
│   ├── eslint.config.js
│   ├── README.md              # Frontend documentation
│   │
│   ├── public/                # Static assets
│   │
│   └── src/                   # Source code
│       ├── main.jsx          # Entry point
│       ├── App.jsx           # Main component
│       ├── supabaseClient.js
│       ├── assets/           # Images, styles
│       ├── components/       # React components
│       │   ├── Admin-*.jsx       # Admin components
│       │   ├── Auth components   # Login, Register, etc.
│       │   ├── Reports.jsx       # Report components
│       │   └── ...
│       ├── hooks/            # Custom React hooks
│       └── utils/            # Utility functions
│
├── migrations/                 # Database migrations
├── .env                        # Environment variables (create this)
├── .gitignore
└── README.md                   # This file
```

## 🔄 Available Scripts

### Backend (Python):
```bash
cd backend
python app.py              # Start Flask development server
pip install -r requirements.txt  # Install dependencies
```

### Frontend (NPM):
```bash
cd frontend
npm run dev                # Start Vite development server
npm run build              # Build for production
npm run preview            # Preview production build
npm run lint               # Run ESLint
```

## 🌐 API Endpoints

The Flask backend uses **Blueprint architecture** for organized routing. All endpoints are prefixed with `/api`:

### Authentication (`/api/`)
- `POST /api/register` - User registration
- `POST /api/login` - User login
- `POST /api/logout` - User logout (requires token)
- `POST /api/password/forgot` - Request password reset
- `POST /api/password/reset` - Reset password with code

### Profile (`/api/profile`)
- `GET /api/profile` - Get user profile (requires token)
- `PUT /api/profile` - Update profile (requires token)
- `DELETE /api/profile` - Delete account (requires token)
- `POST /api/profile/upload-avatar` - Upload avatar (requires token)

### Sessions (`/api/sessions`)
- `GET /api/sessions` - List active sessions (requires token)
- `DELETE /api/sessions/<id>` - Revoke specific session (requires token)
- `DELETE /api/sessions/revoke_all` - Revoke all sessions (requires token)

### Verification (`/api/`)
- `POST /api/email/send-code` - Send verification code
- `POST /api/email/verify-code` - Verify email code
- `POST /api/verification/validate-access` - Validate verification access

### Reports (`/api/reports`)
- `GET /api/reports` - Get reports with filters (requires token)
- `POST /api/reports` - Create new report (requires token)
- `PUT /api/reports/<id>` - Update report (requires token)
- `DELETE /api/reports/<id>` - Delete report (requires token)

### Admin (`/api/admin`)
- Various admin-specific endpoints (requires admin token)

### Notifications (`/api/notifications`)
- `GET /api/notifications` - Get user notifications (requires token)
- `POST /api/notifications/<id>/read` - Mark as read (requires token)
- `DELETE /api/notifications/<id>` - Delete notification (requires token)

> **Note:** Routes marked with "requires token" need the `Authorization: Bearer <token>` header.

## 📱 Usage
1. **For Residents:**
   - Register/Login to your account
   - Verify your email with the code sent
   - Report incidents with location, photos, and details
   - View nearby incidents on the interactive map
   - Track your report status through notifications
   - Manage your profile and sessions

2. **For Administrators:**
   - Access admin dashboard with admin credentials
   - Verify user accounts and manage users
   - Review and update incident report statuses
   - View analytics and statistics
   - Monitor system notifications

## 🏗️ Architecture

### Backend Structure (Flask Blueprints)
The backend is organized using **Flask Blueprints** for modularity:

- **`backend/app.py`**: Main application factory that registers all blueprints
- **`backend/routes/`**: Each file is a blueprint handling specific features
  - `auth.py` - Authentication and password management
  - `profile.py` - User profile operations
  - `sessions.py` - Session management
  - `verification.py` - Email verification
  - `reports.py` - Report CRUD operations
  - `admin.py` - Admin-specific operations
  - `notifications.py` - Notification system
- **`backend/middleware/`**: Authentication decorators (`@token_required`, etc.)
- **`backend/utils/`**: Shared utilities (database client, email, helpers)

### Frontend Structure (React + Vite)
- **Component-based architecture** with reusable React components
- **React Router** for client-side navigation
- **Vite proxy** configured to forward `/api` requests to Flask backend
- **State management** using React hooks (useState, useEffect, custom hooks)
- **Real-time updates** for notifications and reports

## 🔮 Future Enhancements

### 1. Enhanced Notification System
- **Real-time Push Notifications**: Implement WebSocket connections for instant notifications

### 2. Advanced Security & Verification
- **ID Verification System**: Users upload valid ID photos for admin verification

### 3. Interactive Mapping Features
- **Heat Maps**: Visual representation of incident density by barangay
- **Real-time Report Counter**: Live updates of report counts per location

### 4. Location-Based Enhancements
- **Barangay-Focused Dashboard**: Users see reports specific to their barangay
- **Nearby Incidents**: Alert users of incidents in their immediate barangay

### 5. Media & Communication
- **Video Upload Support**: Allow video attachments for incident reports
- **Image Compression**: Optimize uploaded media for better performance

## 🐛 Troubleshooting

### Common Issues:
1. **Port conflicts**: 
   - Make sure port 5000 (backend) is not in use
   - Make sure port 5173 (frontend) is not in use
   - Kill any processes using these ports if needed

2. **Environment variables**: 
   - Ensure `.env` file exists in the root or backend directory
   - Verify all required variables are set correctly
   - Check for typos in variable names

3. **Dependencies**: 
   - Backend: Run `pip install -r requirements.txt` in backend directory
   - Frontend: Run `npm install` in frontend directory
   - Consider using a Python virtual environment

4. **Supabase connection**: 
   - Verify your Supabase URL and key are correct
   - Check your internet connection
   - Ensure Supabase project is active

5. **Import errors**:
   - Backend: Make sure you're running from the backend directory
   - Frontend: Clear node_modules and reinstall if needed

6. **CORS errors**:
   - Ensure backend CORS is configured correctly
   - Check that frontend is making requests to the correct backend URL
   - Verify the Vite proxy configuration in `vite.config.js`

### Getting Help:
- Check the browser console for frontend errors (F12)
- Check the Flask terminal output for backend errors
- Review the `backend/README.md` for backend-specific help
- Review the `frontend/README.md` for frontend-specific help
- Ensure all dependencies are installed correctly

## 🤝 Contributing
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License
This project is developed for educational purposes as part of academic coursework.

## 👥 Team
- **Student Developers**: Roselyn Lei B. Ong & Larissa Eunice T. Panganiban
- **Institution**: Gordon College
- **Course**: BSIT
- **Academic Year**: 2025

---

## 📞 Support
If you encounter any issues or have questions:
1. Check this README for setup instructions
2. Look at the troubleshooting section
3. Create an issue on the GitHub repository

---

*Community Guard - Making communities safer, one report at a time.*

**🌟 Thank you for using Community Guard!**