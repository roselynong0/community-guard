# 🚀 Community Guard - Vercel Deployment Quick Start

## ⚡ Quick Deploy (3 Steps)

### Step 1: Install Vercel CLI
```powershell
npm install -g vercel
```

### Step 2: Login to Vercel
```powershell
vercel login
```

### Step 3: Deploy!
```powershell
# Navigate to project root
cd C:\Users\Roselyn\Desktop\GitHub\community-guard\master

# Deploy to preview
vercel

# Or deploy to production
vercel --prod
```

---

## 📦 What's Been Set Up

✅ **Backend Configuration** (`backend/vercel.json`)
- Python/Flask API configured
- Routes set up for `/api/*` and `/uploads/*`

✅ **Frontend Configuration** (`frontend/vercel.json`)
- React SPA with proper routing
- Build script ready

✅ **Root Configuration** (`vercel.json`)
- Monorepo setup handling both frontend and backend
- Automatic routing between API and static files

✅ **Environment Examples**
- `backend/.env.example` - Backend environment variables template
- `frontend/.env.example` - Frontend environment variables template

✅ **Deployment Script** (`deploy.ps1`)
- PowerShell script for easy deployment
- Interactive menu for different deployment options

---

## 🔐 Environment Variables Setup

After first deployment, add these in **Vercel Dashboard**:

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Go to: **Settings** > **Environment Variables**
4. Add these variables:

### Backend Variables:
```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SECRET_KEY=your_flask_secret_key
MJ_APIKEY_PUBLIC=your_mailjet_public_key
MJ_APIKEY_PRIVATE=your_mailjet_private_key
EMAIL_CODE_EXPIRY=10
RESET_CODE_EXPIRY=10
FLASK_ENV=production
```

### Frontend Variables:
```
VITE_API_URL=https://your-backend-url.vercel.app
```

---

## 🛠️ Using the Deployment Script

Simply run:
```powershell
cd C:\Users\Roselyn\Desktop\GitHub\community-guard\master
.\deploy.ps1
```

The script will:
1. ✅ Check if Vercel CLI is installed
2. ✅ Help you login to Vercel
3. ✅ Give you deployment options:
   - Deploy Full Stack (Preview)
   - Deploy Backend Only
   - Deploy Frontend Only
   - Deploy to Production

---

## 🌐 After Deployment

### 1. Get Your URLs
After deployment, Vercel will give you URLs like:
- Frontend: `https://community-guard.vercel.app`
- Backend: `https://community-guard-api.vercel.app`

### 2. Update Frontend API Configuration
Create `.env` file in `frontend/` folder:
```
VITE_API_URL=https://your-backend-url.vercel.app
```

### 3. Update CORS in Backend
In `backend/app.py`, make sure CORS includes your production domain:
```python
CORS(app, origins=[
    "http://localhost:5173",
    "https://community-guard.vercel.app",  # Your production frontend
])
```

### 4. Test Everything
- ✅ Login/Registration
- ✅ User roles (Admin, Barangay, Responder, Resident)
- ✅ File uploads
- ✅ Notifications
- ✅ Maps functionality
- ✅ Reports

---

## 🔄 Continuous Deployment (GitHub)

For automatic deployments:

1. **Push to GitHub:**
```bash
git add .
git commit -m "Add Vercel configuration"
git push origin main
```

2. **Connect to Vercel:**
   - Go to https://vercel.com/new
   - Click "Import Git Repository"
   - Select your `community-guard` repo
   - Vercel will auto-detect the configuration

3. **Automatic Deployments:**
   - Every push to `main` = Production deployment
   - Every push to other branches = Preview deployment
   - Every PR = Automatic preview URL

---

## 🐛 Troubleshooting

### Build Fails
```bash
# Check logs in Vercel Dashboard > Deployments > View Logs
```

### API Not Working
1. Check environment variables are set
2. Verify CORS settings
3. Check API URL in frontend `.env`

### Database Connection Issues
1. Verify Supabase credentials
2. Check Supabase connection limits
3. Test connection from Vercel Functions logs

### File Uploads Not Working
- Vercel has a 4.5MB request size limit
- Consider using Supabase Storage for larger files
- Update upload handling in backend

---

## 📊 Monitoring

- **Deployments:** https://vercel.com/dashboard/deployments
- **Functions:** https://vercel.com/dashboard/functions
- **Analytics:** Enable in Project Settings

---

## 💡 Development Workflow

### Local Development:
```bash
# Backend
cd backend
python run.py

# Frontend (new terminal)
cd frontend
npm run dev
```

### Deploy to Preview:
```bash
vercel
```

### Deploy to Production:
```bash
vercel --prod
```

---

## 🎯 Quick Commands Reference

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View deployments
vercel ls

# View logs
vercel logs

# Remove deployment
vercel rm [deployment-url]

# Pull environment variables from Vercel
vercel env pull

# Add environment variable
vercel env add
```

---

## ✅ Deployment Checklist

Before going to production:

- [ ] All environment variables configured in Vercel
- [ ] Frontend API URL points to production backend
- [ ] CORS configured for production domain
- [ ] Database connection tested
- [ ] Email service (Mailjet) configured and tested
- [ ] File upload limits checked
- [ ] All user roles tested (Admin, Barangay, Responder, Resident)
- [ ] Authentication flow verified
- [ ] Notifications working
- [ ] Maps functionality tested
- [ ] SSL certificate active (automatic with Vercel)
- [ ] Custom domain configured (optional)

---

## 🔗 Important Links

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Vercel Docs:** https://vercel.com/docs
- **Environment Variables:** https://vercel.com/docs/concepts/projects/environment-variables
- **Python on Vercel:** https://vercel.com/docs/functions/serverless-functions/runtimes/python

---

## 📧 Need Help?

- Vercel Support: https://vercel.com/support
- Vercel Community: https://github.com/vercel/vercel/discussions

---

**Made with ❤️ for Community Safety**
