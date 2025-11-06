# Community Guard Frontend

React + Vite frontend for the Community Guard application.

## Structure

```
frontend/
├── index.html
├── package.json
├── vite.config.js
├── eslint.config.js
├── public/              # Static assets
└── src/
    ├── main.jsx        # Entry point
    ├── App.jsx         # Main app component
    ├── supabaseClient.js
    ├── assets/         # Images and static files
    ├── components/     # React components
    │   ├── Admin-*.jsx       # Admin components
    │   ├── Layout.jsx        # Layout components
    │   ├── Auth components   # Login, Register, etc.
    │   ├── Reports.jsx       # Report components
    │   └── ...
    ├── hooks/          # Custom React hooks
    └── utils/          # Utility functions
        ├── session.js
        └── ...
```

## Setup

1. Install dependencies:
```bash
cd frontend
npm install
```

2. Configure environment variables:
Create a `.env` file in the frontend directory:
```
VITE_API_URL=http://localhost:5000/api
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_KEY=your_supabase_key
```

3. Run development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Build for Production

```bash
npm run build
```

This will create an optimized production build in the `dist/` folder.

## Features

- User authentication and registration
- Email verification
- Profile management
- Report/incident submission with image upload
- Real-time notifications
- Admin dashboard
- Map view of incidents
- Community feed
- Session management

## API Integration

The frontend communicates with the backend API at `/api` endpoints. All API calls should include the authentication token in the `Authorization` header:

```javascript
headers: {
  'Authorization': `Bearer ${token}`
}
```

## Component Structure

- **Admin Components**: Admin-specific features (user management, reports)
- **Auth Components**: Login, registration, password reset
- **Layout Components**: Main layout, navigation, sidebar
- **Profile Components**: User profile, settings
- **Report Components**: Report creation, viewing, management
- **Notification Components**: Real-time notifications
- **Map Components**: Interactive map for incident locations
