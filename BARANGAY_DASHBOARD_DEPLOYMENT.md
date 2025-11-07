# 🚀 Barangay Dashboard Deployment Guide

## ✅ What Was Fixed

### **Backend Changes:**
1. ✅ Added `/api/stats` endpoint in `routes/admin.py`
   - Supports barangay filtering via query param: `?barangay=Barretto`
   - Returns: `totalReports`, `pending`, `ongoing`, `resolved`
   - Works for both "All" barangays and specific barangay filter

### **Frontend Changes:**
1. ✅ `BarangayDashboard.jsx` now:
   - Fetches user profile to get real `address_barangay`
   - Uses `API_CONFIG.BASE_URL` for dynamic URL detection
   - Filters stats by barangay automatically
   - Removed hardcoded `localhost:5000`

2. ✅ `BarangayLayout.jsx` improvements:
   - Fixed logout (clears `profileLoaded` flag)
   - Mobile nav: 6 buttons in a row (removed floating bubble)
   - Better error handling with retry logic

### **Database Changes:**
1. ✅ Created complete migration `006_complete_barangay_dashboard.sql` with:
   - Full schema with all tables
   - ENUM type for Olongapo barangays
   - Critical indexes for dashboard performance
   - RLS policies for security
   - Seed data for testing

---

## 📋 Deployment Steps

### **Step 1: Deploy Database Schema to Supabase**

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project: `tpqtnkjalrwimxwqjldm`
3. Click **SQL Editor** in the left sidebar
4. Click **New query**
5. Copy the entire contents of `migrations/006_complete_barangay_dashboard.sql`
6. Paste into the SQL editor
7. Click **Run** (bottom right)
8. Wait for success message: "✅ All required tables created successfully!"

**⚠️ Important:** This migration will **DROP and RECREATE** all tables. Make sure you have backups if you have important data!

---

### **Step 2: Deploy Backend to Railway**

Your backend is already deployed to Railway, so we just need to push the updates:

```powershell
cd c:\Users\Roselyn\Desktop\GitHub\community-guard\master\backend
git add routes/admin.py
git commit -m "Add /api/stats endpoint for barangay dashboard"
git push
```

Railway will automatically redeploy your backend.

**Verify Backend Deployment:**
- Check Railway logs for successful deployment
- Test endpoint: `https://your-railway-url/api/stats`
- Should return 401 (needs auth) - that's correct!

---

### **Step 3: Deploy Frontend to Vercel**

```powershell
cd c:\Users\Roselyn\Desktop\GitHub\community-guard\master\frontend
git add src/components/BarangayDashboard.jsx src/components/BarangayLayout.jsx
git commit -m "Fix: Barangay dashboard with real data and stats API"
git push
npx vercel --prod
```

---

### **Step 4: Test the Complete System**

#### **1. Test Login:**
```
Email: barangay.test@example.com
Password: test123
```

Or use your existing Barangay Official account:
```
Email: sample@gmail.com
Password: your_password
```

#### **2. Verify Dashboard Data:**
- Login as Barangay Official
- Navigate to Dashboard
- Check console (F12) for logs:
  ```
  Barangay Official Profile: {address_barangay: "Barretto", ...}
  Barangay Dashboard - Selected Barangay: Barretto
  ```
- Verify stats cards show correct numbers
- Verify data is filtered by YOUR barangay (not "All")

#### **3. Test Logout:**
- Click logout
- Should redirect to login page
- Should not get stuck in loop

#### **4. Test Mobile View:**
- Open browser dev tools (F12)
- Toggle device emulation (phone/tablet)
- Verify bottom nav shows all 6 buttons:
  [🏠] [🗺️] [📄] [🔔] [👥] [👤]

---

## 🔍 Troubleshooting

### **Problem: Dashboard shows 0 for all stats**
**Solution:**
1. Check console for API errors
2. Verify user has `address_barangay` set in their profile:
   ```sql
   SELECT u.email, i.address_barangay 
   FROM users u 
   LEFT JOIN info i ON u.id = i.user_id 
   WHERE u.email = 'your_email@example.com';
   ```
3. If `address_barangay` is NULL, update it:
   ```sql
   UPDATE info 
   SET address_barangay = 'Barretto'::olongapo_barangay 
   WHERE user_id = (SELECT id FROM users WHERE email = 'your_email@example.com');
   ```

### **Problem: "Session lookup error" in backend logs**
**Solution:** Already fixed with retry logic in `middleware/auth.py`. Just restart backend.

### **Problem: Stats API returns 500 error**
**Solution:**
1. Check Railway backend logs
2. Verify migration ran successfully in Supabase
3. Check if `reports` table has `address_barangay` column:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'reports';
   ```

---

## 🎯 Expected Results

After successful deployment:

1. ✅ Barangay Official logs in successfully
2. ✅ Dashboard loads with real statistics
3. ✅ Stats are filtered by official's barangay
4. ✅ Console shows correct barangay name
5. ✅ Logout works without redirect loop
6. ✅ Mobile nav shows 6 buttons properly
7. ✅ Charts display real data

---

## 📊 Testing Queries

**Check if your barangay has reports:**
```sql
SELECT 
    address_barangay,
    status,
    COUNT(*) as count
FROM reports
WHERE deleted_at IS NULL
GROUP BY address_barangay, status
ORDER BY address_barangay, status;
```

**Check total reports by barangay:**
```sql
SELECT 
    address_barangay,
    COUNT(*) as total_reports
FROM reports
WHERE deleted_at IS NULL
GROUP BY address_barangay
ORDER BY total_reports DESC;
```

**Create test reports for your barangay:**
```sql
-- Get your user_id and barangay
SELECT id, email FROM users WHERE email = 'your_email@example.com';

-- Create test reports
INSERT INTO reports (user_id, title, description, category, address_barangay, status)
VALUES 
    ('your_user_id', 'Test Report 1', 'Test description', 'Concern', 'Barretto', 'Pending'),
    ('your_user_id', 'Test Report 2', 'Test description', 'Crime', 'Barretto', 'Ongoing'),
    ('your_user_id', 'Test Report 3', 'Test description', 'Hazard', 'Barretto', 'Resolved');
```

---

## 🔐 Security Notes

1. ✅ RLS policies enabled on all tables
2. ✅ Backend uses `service_role` key to bypass RLS
3. ✅ Frontend uses `anon` key (public)
4. ✅ All endpoints require authentication token
5. ✅ Barangay Officials only see their barangay data

---

## 📝 Next Steps (Optional Enhancements)

1. **Real-time updates:** Add Supabase realtime subscriptions for live stats
2. **Monthly trend data:** Query reports grouped by month for the line chart
3. **Barangay ranking:** Show top barangays with most reports in bar chart
4. **Map markers:** Add real report locations to MapView component
5. **Export reports:** Add CSV/PDF export functionality

---

## ✅ Deployment Checklist

- [ ] Run SQL migration in Supabase
- [ ] Verify all tables created (check SQL editor output)
- [ ] Update user's `address_barangay` in info table
- [ ] Commit and push backend changes to Railway
- [ ] Verify Railway deployment successful
- [ ] Commit and push frontend changes to Vercel
- [ ] Test login with Barangay Official account
- [ ] Verify dashboard shows correct statistics
- [ ] Test logout functionality
- [ ] Check mobile view layout
- [ ] Create test reports if needed
- [ ] Verify filtering works correctly

---

🎉 **Ready to deploy!** Follow the steps above and your Barangay Dashboard will be fully functional.
