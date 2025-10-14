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

### 2. Install Dependencies

#### Frontend Dependencies (React/Vite):
```bash
npm install
```

#### Backend Dependencies (Python/Flask):
```bash
pip install flask flask-cors supabase python-dotenv pyjwt bcrypt pillow mailjet-rest flask-caching flask-compress
```

### 3. Environment Configuration
Create a `.env` file in the root directory and add your environment variables:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
EMAIL_SECRET_KEY=your_email_service_secret_key
MAILJET_API_KEY=your_mailjet_api_key
MAILJET_SECRET_KEY=your_mailjet_secret_key
```

### 4. Database Setup
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Copy your project URL and anon key to the `.env` file
3. Run the database migrations (if any) or set up your tables according to the schema

## 🚀 Running the Project

### Development Mode

#### Option 1: Run Frontend and Backend Separately
**Terminal 1 - Frontend (React/Vite):**
```bash
npm run dev
```
This starts the Vite development server at `http://localhost:5173`

**Terminal 2 - Backend (Flask API):**
```bash
python app.py
```
This starts the Flask server at `http://localhost:5000`

#### Option 2: Run Both Concurrently
```bash
npm run dev:full
```
This command runs both frontend and backend simultaneously.

### Production Build
```bash
# Build the frontend
npm run build

# Preview the build
npm run preview

# Start production server
npm start
```

## 📁 Project Structure
```
community-guard/
├── master/
│   ├── public/                 # Static assets
│   ├── src/                    # React source code
│   │   ├── components/         # React components
│   │   ├── assets/            # Images, icons, etc.
│   │   ├── utils/             # Utility functions
│   │   └── main.jsx           # App entry point
│   ├── app.py                 # Flask backend server
│   ├── model.py               # Database models (if applicable)
│   ├── package.json           # NPM dependencies & scripts
│   ├── vite.config.js         # Vite configuration
│   ├── eslint.config.js       # ESLint configuration
│   └── .env                   # Environment variables (create this)
```

## 🔄 Available Scripts

### Frontend (NPM Scripts):
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Backend (Python):
- `python app.py` - Start Flask server
- `python model.py` - Run database operations (if applicable)

## 🌐 API Endpoints
The Flask backend provides various API endpoints for:
- User authentication (`/api/auth/*`)
- Incident reporting (`/api/reports/*`)
- User management (`/api/users/*`)
- Administrative functions (`/api/admin/*`)

## 📱 Usage
1. **For Residents:**
   - Register/Login to your account
   - Report incidents with location and details
   - View nearby incidents on the map
   - Track your report status

2. **For Administrators:**
   - Access admin dashboard
   - Verify user accounts
   - Manage incident reports
   - View analytics and statistics

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
1. **Port conflicts**: Make sure ports 5173 (frontend) and 5000 (backend) are available
2. **Environment variables**: Ensure all required variables are set in `.env`
3. **Dependencies**: Run `npm install` and `pip install` commands if modules are missing
4. **Supabase connection**: Verify your Supabase URL and key are correct

### Getting Help:
- Check the browser console for frontend errors
- Check the Flask terminal output for backend errors
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