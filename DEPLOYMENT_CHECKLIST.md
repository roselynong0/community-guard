# 🚀 Vercel Deployment Checklist

## Pre-Deployment Setup ✅

- [ ] Install Node.js and npm
- [ ] Install Vercel CLI: `npm install -g vercel`
- [ ] Create Vercel account at https://vercel.com
- [ ] Have all environment variables ready (from .env file)

## First Time Deployment 🎯

- [ ] Run `vercel login` in terminal
- [ ] Navigate to project root: `cd C:\Users\Roselyn\Desktop\GitHub\community-guard\master`
- [ ] Run `vercel` for preview deployment
- [ ] Note the deployment URL provided

## Vercel Dashboard Configuration 🔐

- [ ] Go to https://vercel.com/dashboard
- [ ] Select your project
- [ ] Go to Settings → Environment Variables
- [ ] Add SUPABASE_URL
- [ ] Add SUPABASE_KEY
- [ ] Add SECRET_KEY
- [ ] Add MJ_APIKEY_PUBLIC
- [ ] Add MJ_APIKEY_PRIVATE
- [ ] Add EMAIL_CODE_EXPIRY (value: 10)
- [ ] Add RESET_CODE_EXPIRY (value: 10)
- [ ] Add FLASK_ENV (value: production)

## Frontend Configuration 📱

- [ ] Create `frontend/.env` file
- [ ] Add `VITE_API_URL=https://your-vercel-url.vercel.app`
- [ ] Save the file

## Backend Configuration 🐍

- [ ] Update CORS in `backend/app.py` to include production domain
- [ ] Verify all routes are working in `backend/app.py`
- [ ] Check file upload limits (Vercel has 4.5MB limit)

## Production Deployment 🌟

- [ ] Run `vercel --prod` for production deployment
- [ ] Verify deployment completed successfully
- [ ] Note production URL

## Testing Phase 🧪

- [ ] Test user registration
- [ ] Test user login (all roles)
  - [ ] Admin login → should go to /admin/users
  - [ ] Barangay Official login → should go to /barangay/home
  - [ ] Responder login → should go to /responder/home
  - [ ] Resident login → should go to /home
- [ ] Test logout functionality
- [ ] Test email verification
- [ ] Test password reset
- [ ] Test file uploads
- [ ] Test notifications
- [ ] Test reports
- [ ] Test maps functionality
- [ ] Test profile updates
- [ ] Test role-specific features

## Admin Features ✅

- [ ] User management works
- [ ] User verification works
- [ ] Admin notifications work
- [ ] Community metrics visible

## Barangay Official Features ✅

- [ ] Can access reports
- [ ] Can view statistics
- [ ] Can see maps
- [ ] Can manage notifications

## Responder Features ✅

- [ ] Can access admin reports
- [ ] Can view maps
- [ ] Can see notifications
- [ ] Proper layout displays

## Resident Features ✅

- [ ] Can submit reports
- [ ] Can view community feed
- [ ] Can see safety tips
- [ ] Can view maps
- [ ] Can receive notifications

## Optional: GitHub Integration 🔄

- [ ] Push code to GitHub repository
- [ ] Go to https://vercel.com/new
- [ ] Import GitHub repository
- [ ] Connect repository to Vercel
- [ ] Verify automatic deployments work

## Performance & Monitoring 📊

- [ ] Enable Vercel Analytics in project settings
- [ ] Check function logs for errors
- [ ] Monitor response times
- [ ] Check for any 500 errors
- [ ] Verify all API endpoints respond correctly

## Custom Domain (Optional) 🌐

- [ ] Purchase domain (optional)
- [ ] Go to Vercel Dashboard → Domains
- [ ] Add custom domain
- [ ] Update DNS records
- [ ] Wait for SSL certificate (automatic)
- [ ] Update CORS to include custom domain

## Documentation 📝

- [ ] Update README with production URL
- [ ] Document any environment-specific configurations
- [ ] Save deployment URLs for reference
- [ ] Note any known issues or limitations

## Security Checklist 🔒

- [ ] All sensitive data in environment variables (not in code)
- [ ] .env files are in .gitignore
- [ ] CORS properly configured
- [ ] HTTPS enabled (automatic with Vercel)
- [ ] API endpoints require authentication
- [ ] File upload validation in place

## Final Checks ✨

- [ ] No console errors in browser
- [ ] All images loading correctly
- [ ] Mobile responsive design working
- [ ] All links working
- [ ] Error pages displaying correctly
- [ ] Loading states working properly

## Post-Deployment 🎉

- [ ] Share production URL with team/users
- [ ] Monitor for any issues in first 24 hours
- [ ] Set up alerts for downtime (optional)
- [ ] Plan for regular updates and maintenance

---

## Quick Commands Reference

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# View deployments
vercel ls

# View logs
vercel logs

# Pull environment variables
vercel env pull
```

---

## Support Resources

- Vercel Dashboard: https://vercel.com/dashboard
- Vercel Docs: https://vercel.com/docs
- Deployment Guide: See DEPLOYMENT_QUICKSTART.md
- Detailed Guide: See VERCEL_DEPLOYMENT.md

---

**Status:** ⬜ Not Started | 🟡 In Progress | ✅ Completed

**Last Updated:** [Add date when you complete deployment]
