# Community Guard

[![Deployment](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://community-guard.vercel.app)
[![React](https://img.shields.io/badge/React-19.1.1-blue?logo=react)](https://reactjs.org/)
[![Flask](https://img.shields.io/badge/Flask-Python-green?logo=flask)](https://flask.palletsprojects.com/)

## Overview
Community Guard is a full-stack web application designed to enhance community safety through incident reporting and administrative management. The system allows residents to report incidents while providing administrators with tools to manage reports and verify users.

**🌐 Live Demo:** [https://community-guard.vercel.app](https://community-guard.vercel.app)

## 🚀 Features
- **Incident Reporting**: Residents report safety incidents with location data and photos
- **Administrative Dashboard**: Admins manage reports, verify users, and monitor system activity
- **Interactive Maps**: Location-based visualization with grouped markers and statistics
- **Role-Based Dashboards**: Customized views for Admin, Barangay Official, Responder, and Resident roles
- **Optimized Real-time Notifications**: Polling with adaptive intervals and deduplication
- **Mobile Responsive**: Fully optimized for desktop and mobile devices
- **Session Management**: Track and manage active login sessions with revocation control

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

### Local Development Mode

You need to run **both** the backend and frontend servers in separate terminals:

**Terminal 1 - Backend (Flask API):**
```powershell
cd master/backend
python app.py
```
Backend will run on `http://localhost:5000`

**Terminal 2 - Frontend (React/Vite):**
```powershell
cd master/frontend
npm run dev
```
Frontend will run on `http://localhost:5173`

The application is configured to work seamlessly in both localhost and production:
- **Localhost**: Frontend uses `http://localhost:5000` for API calls
- **Vercel/Railway**: Automatically detects and uses production domain

### Testing Localhost Setup

1. **Backend Health Check**: Open `http://localhost:5000/api/health`
   - Should return: `{"status": "ok", "message": "Community Guard API is running"}`

2. **Frontend**: Open `http://localhost:5173`
   - Should display the Community Guard landing page

3. **Test API Connection**: Try registering or logging in

### Production Deployment

#### Option 1: Vercel (Recommended for Frontend)

**Quick Deploy:**
```powershell
# Install Vercel CLI (first time only)
npm install -g vercel

# Login to Vercel
vercel login

# Deploy to production
cd master
vercel --prod
```

**Environment Variables for Vercel:**
Set these in your Vercel Dashboard (Settings → Environment Variables):
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Note:** Don't set `VITE_API_URL` on Vercel - it auto-detects the production URL.

#### Option 2: Railway (Full Stack)

**Deploy Backend to Railway:**

1. Create a Railway project at [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Select the `master` directory as the root
4. Set environment variables in Railway Dashboard:
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
MJ_APIKEY_PUBLIC=your_mailjet_public_key
MJ_APIKEY_SECRET=your_mailjet_secret_key
SECRET_KEY=your_secret_key
EMAIL_CODE_EXPIRY=10
FLASK_ENV=production
FRONTEND_URL=https://your-railway-frontend-domain.railway.app
PORT=5000
```

5. Railway will auto-detect `requirements.txt` and deploy Flask backend

**Deploy Frontend to Railway:**

1. Create another Railway project for frontend (or same project, different service)
2. Configure build command: `cd frontend && npm install && npm run build`
3. Configure start command: `cd frontend && npm run preview`
4. Set environment variables:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=https://your-railway-backend-domain.railway.app
```

**Alternative: Deploy using Railway CLI**
```powershell
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize and deploy
cd master
railway init
railway up
```

**View Logs:**
```powershell
railway logs
```

#### Environment Configuration by Platform

**Vercel:**
- Frontend auto-detects production URL
- Backend can be on Railway, AWS, or other platform
- Set `VITE_API_URL` to your backend platform URL

**Railway:**
- Both frontend and backend can be deployed
- Set `FRONTEND_URL` to your Railway frontend domain
- Set `VITE_API_URL` to your Railway backend domain
- All environment variables set in Railway Dashboard

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
```powershell
cd backend
python app.py                      # Start Flask development server
pip install -r requirements.txt    # Install dependencies
pip freeze > requirements.txt      # Update dependencies
```

### Frontend (NPM):
```powershell
cd frontend
npm run dev                        # Start Vite development server
npm run build                      # Build for production
npm run preview                    # Preview production build
npm run lint                       # Run ESLint
npm install                        # Install dependencies
```

### Deployment:
```powershell
cd master
vercel                             # Deploy to preview
vercel --prod                      # Deploy to production
vercel logs                        # View deployment logs
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

## 🌍 Environment Configuration

### How Auto-Detection Works

The application intelligently detects its environment:

**Development (Localhost):**
- Frontend checks `VITE_API_URL` in `.env` → uses `http://localhost:5000`
- Backend uses `FRONTEND_URL` from `.env` → `http://localhost:5173`

**Production (Vercel):**
- Frontend detects `vercel.app` domain → uses same origin automatically
- Backend uses `FRONTEND_URL` from Vercel dashboard → `https://community-guard.vercel.app`

### Backend Environment Variables

**Local Development** (`backend/.env`):
```env
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

**Production** (Set in Vercel Dashboard):
```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
MJ_APIKEY_PUBLIC=your_mailjet_public_key
MJ_APIKEY_SECRET=your_mailjet_secret_key
SECRET_KEY=your_secret_key
EMAIL_CODE_EXPIRY=10
FLASK_ENV=production
FRONTEND_URL=https://community-guard.vercel.app
```

### Frontend Environment Variables

**Local Development** (`frontend/.env`):
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:5000
```

**Production** (Set in Vercel Dashboard):
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
# Do NOT set VITE_API_URL - it auto-detects!
```

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

### 1. WebSocket Real-time Notifications
- **True Push Notifications**: Replace polling with WebSocket for sub-second latency
- **Reduced Network Overhead**: Single persistent connection vs. repeated HTTP requests

### 2. Advanced Security & Verification
- **ID Verification System**: Users upload valid ID photos for admin verification

### 3. Interactive Mapping Features
- **Heat Maps**: Visual representation of incident density by barangay
- **Real-time Report Counter**: Live updates of report counts per location

### 4. Media & Communication
- **Video Upload Support**: Allow video attachments for incident reports
- **Image Compression**: Optimize uploaded media for performance

## 🐛 Troubleshooting

### Local Development Issues:

**Port conflicts:**
```powershell
# Backend port 5000 in use
# Change PORT in backend/.env to 5001
# Update VITE_API_URL in frontend/.env to http://localhost:5001

# Frontend port 5173 in use
# Vite will automatically try the next available port (5174, etc.)
```

**Environment variables:**
- Ensure `backend/.env` and `frontend/.env` files exist
- Copy from `.env.example` files if needed
- For localhost: `VITE_API_URL=http://localhost:5000` (frontend)
- For localhost: `FRONTEND_URL=http://localhost:5173` (backend)

**Dependencies not installing:**
```powershell
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
rm -rf node_modules
npm install
```

**Backend won't start:**
- Check if Python 3.8+ is installed: `python --version`
- Make sure you're in the `backend` directory
- Check for errors in terminal output
- Verify Supabase credentials in `.env`

**Frontend won't start:**
- Check if Node.js is installed: `node --version`
- Make sure you're in the `frontend` directory
- Run `npm install` first
- Check for errors in terminal output

**API requests failing:**
- Ensure backend is running on port 5000
- Check `VITE_API_URL` in `frontend/.env`
- Open browser console (F12) for CORS errors
- Verify `frontend/src/utils/apiConfig.js` configuration

### Vercel Deployment Issues:

**Build fails:**
- Check build logs in Vercel Dashboard
- Verify all environment variables are set
- Ensure `requirements.txt` and `package.json` are up to date

**API requests fail on Vercel:**
- Remove `VITE_API_URL` from Vercel environment variables
- It should auto-detect and use `https://community-guard.vercel.app`
- Check CORS settings in `backend/app.py`

**Database connection fails:**
- Verify Supabase credentials in Vercel Dashboard
- Check Supabase project is active and accessible
- Ensure environment variables are set for production

**Environment not switching properly:**
- The app auto-detects environment:
  - Localhost → uses `http://localhost:5000`
  - Vercel → uses same origin (e.g., `https://community-guard.vercel.app`)
- Check `frontend/src/utils/apiConfig.js` for logic

### Quick Fixes:
```powershell
# Reset everything
cd master/frontend
rm -rf node_modules
npm install

cd ../backend
pip install -r requirements.txt

# Check health
# Backend: http://localhost:5000/api/health
# Frontend: http://localhost:5173
```

### Getting Help:
- Check browser console for frontend errors (F12)
- Check terminal output for backend errors
- Review Vercel logs for deployment issues
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