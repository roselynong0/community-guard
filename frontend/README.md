# Community Guard Frontend

React + Vite frontend for the Community Guard application.

## Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Configure environment variables (`.env`):
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:5000
```

3. Run development server:
```bash
npm run dev
```
App runs on `http://localhost:5173`

## Build & Deploy

```bash
npm run build      # Create production build
npm run preview    # Preview production build locally
npm run lint       # Run ESLint
```

## Key Features

- **User Authentication**: Registration, login, email verification
- **Interactive Maps**: Location-based incident visualization with grouped markers
- **Role-Based Dashboards**: Customized views for Admin, Barangay Official, Responder, and Resident
- **Report Management**: Create and manage incident reports with photos
- **Optimized Notifications**: Adaptive polling with request deduplication
- **Session Management**: Track active sessions with revocation control
- **Community Feed**: View incidents and community updates
- **Profile Management**: User profile and settings

## Component Organization

```
src/
├── components/
│   ├── Admin-*.jsx          # Admin features
│   ├── Barangay-*.jsx       # Barangay official features
│   ├── Responder-*.jsx      # First responder features
│   ├── Auth/                # Login, register, password reset
│   ├── Maps.jsx             # City-wide map view
│   ├── BarangayMaps.jsx     # Barangay-filtered map
│   ├── ResponderMaps.jsx    # Responder operations map
│   ├── Reports.jsx          # Report management
│   └── ...
├── hooks/                   # Custom React hooks
└── utils/
    ├── notificationService.js  # Optimized notification polling
    ├── apiConfig.js            # API configuration
    └── ...
```

## Notification System

The notification service uses **optimized HTTP polling** with:
- **Request Deduplication**: Prevents stacking requests
- **Adaptive Intervals**: Slows down polling when idle
- **Exponential Backoff**: Reduces retries on errors
- **Role-Based Endpoints**: Only calls appropriate endpoint per user role

```javascript
// Example usage
import { startNotificationPolling } from './utils/notificationService';

startNotificationPolling(token, 'Admin', 10000); // 10s polling interval
```

## Troubleshooting

**Port conflicts:**
```bash
# Frontend port 5173 in use
# Vite will automatically use next available port (5174, 5175, etc.)
```

**API not connecting:**
- Verify `VITE_API_URL` in `.env` points to backend
- Ensure backend is running on correct port
- Check browser console for CORS errors

**Build errors:**
```bash
rm -rf node_modules
npm install
npm run build
```
