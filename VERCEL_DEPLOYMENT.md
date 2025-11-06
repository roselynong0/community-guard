# Vercel Deployment Guide for Community Guard

## 📦 Prerequisites

1. Install Vercel CLI globally:
```bash
npm install -g vercel
```

2. Make sure you have a Vercel account at https://vercel.com

## 🚀 Deployment Steps

### Option 1: Deploy via Vercel CLI (Recommended for Development)

1. **Login to Vercel**
```bash
vercel login
```

2. **Deploy from the project root**
```bash
cd C:\Users\Roselyn\Desktop\GitHub\community-guard\master
vercel
```

3. **Follow the prompts:**
   - Set up and deploy? `Y`
   - Which scope? Select your account
   - Link to existing project? `N` (first time)
   - Project name? `community-guard`
   - In which directory is your code located? `./`

4. **For production deployment:**
```bash
vercel --prod
```

### Option 2: Deploy via GitHub (Recommended for Continuous Deployment)

1. **Push your code to GitHub**
```bash
git add .
git commit -m "Add Vercel configuration"
git push origin main
```

2. **Connect to Vercel:**
   - Go to https://vercel.com/new
   - Import your GitHub repository
   - Vercel will auto-detect the configuration

## 🔐 Environment Variables

You need to add these environment variables in Vercel Dashboard:

### Backend Environment Variables
Go to Vercel Dashboard > Your Project > Settings > Environment Variables

Add the following:

**From your .env file:**
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
SECRET_KEY=your_secret_key
MJ_APIKEY_PUBLIC=your_mailjet_public_key
MJ_APIKEY_PRIVATE=your_mailjet_private_key
EMAIL_CODE_EXPIRY=10
RESET_CODE_EXPIRY=10
FLASK_ENV=production
```

### Frontend Environment Variables (if any)
```
VITE_API_URL=https://your-backend-url.vercel.app
```

## 📝 Update API URLs in Frontend

After deployment, you'll get two URLs:
- Frontend: `https://community-guard.vercel.app`
- Backend: `https://community-guard-backend.vercel.app`

Update these files with your production backend URL:

1. **frontend/src/utils/session.js**
2. **frontend/src/components/LoginForm.jsx**
3. **frontend/src/components/RegistrationForm.jsx**
4. All other components that use `http://localhost:5000`

Replace all instances of:
```javascript
"http://localhost:5000/api/..."
```

With:
```javascript
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
// Then use:
`${API_URL}/api/...`
```

## 🔄 For Development + Production Setup

### Option A: Separate Deployments
Deploy frontend and backend separately:

**Backend:**
```bash
cd backend
vercel
```

**Frontend:**
```bash
cd frontend
vercel
```

### Option B: Monorepo (Current Setup)
The root `vercel.json` handles both frontend and backend.

## 🛠️ Project Structure for Vercel

```
community-guard/master/
├── vercel.json           # Root config (routes both)
├── frontend/
│   ├── vercel.json       # Frontend SPA config
│   ├── package.json      # Has vercel-build script
│   └── dist/             # Build output
└── backend/
    ├── vercel.json       # Backend API config
    ├── app.py            # Entry point
    └── requirements.txt  # Python dependencies
```

## 🌐 Custom Domain (Optional)

1. Go to Vercel Dashboard > Your Project > Settings > Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Vercel automatically handles SSL certificates

## 🔍 Troubleshooting

### Build Fails
- Check build logs in Vercel Dashboard
- Ensure all dependencies are in package.json/requirements.txt
- Verify environment variables are set

### API Requests Fail
- Check CORS settings in backend/app.py
- Verify API URL in frontend is correct
- Check environment variables in Vercel Dashboard

### Database Connection Issues
- Verify Supabase credentials in environment variables
- Check Supabase dashboard for connection limits

## 📊 Monitoring

- View deployment logs: Vercel Dashboard > Deployments
- Check function logs: Vercel Dashboard > Functions
- Monitor performance: Vercel Analytics (enable in settings)

## 🔄 Automatic Deployments

Once connected to GitHub:
- Push to `main` branch → Production deployment
- Push to other branches → Preview deployments
- Pull requests → Automatic preview URLs

## 🎯 Quick Commands

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View deployment logs
vercel logs

# List all deployments
vercel ls

# Remove a deployment
vercel rm [deployment-url]
```

## ✅ Post-Deployment Checklist

- [ ] Environment variables configured
- [ ] API URLs updated in frontend
- [ ] CORS configured for production domain
- [ ] Database connection working
- [ ] Email service (Mailjet) working
- [ ] File uploads working
- [ ] Test all user roles (Admin, Barangay, Responder, Resident)
- [ ] Test authentication flow
- [ ] Test notifications
- [ ] Verify maps functionality

## 🔗 Useful Links

- Vercel Documentation: https://vercel.com/docs
- Vercel CLI Reference: https://vercel.com/docs/cli
- Environment Variables: https://vercel.com/docs/concepts/projects/environment-variables
