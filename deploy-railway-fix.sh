#!/bin/bash
# 🚀 Quick Deployment Script - Railway Fix

echo "=========================================="
echo "Community Guard - Railway Fix Deployment"
echo "=========================================="
echo ""

# Step 1: Verify we're in the right directory
if [ ! -f "backend/requirements.txt" ]; then
    echo "❌ Error: Not in project root"
    echo "Please run from: community-guard/master"
    exit 1
fi

echo "✓ In correct directory"
echo ""

# Step 2: Show what we're deploying
echo "📦 Deployment Summary:"
echo "—————————————————————"
echo "Files to commit:"
echo "  • backend/requirements.txt (updated dependencies)"
echo "  • backend/utils/supabase_client.py (enhanced error handling)"
echo ""
echo "Key changes:"
echo "  • supabase: 2.4.2 → 2.5.1"
echo "  • httpx: 0.24.1 → 0.27.0"
echo "  • gotrue: (implicit) → 0.5.0 (explicit)"
echo "  • Reason: Fix 'proxy' parameter error on Railway"
echo ""

# Step 3: Commit
echo "🔧 Committing changes..."
git add backend/requirements.txt backend/utils/supabase_client.py

git commit -m "fix(deployment): Update httpx/gotrue/supabase compatibility for Railway

- Upgrade supabase from 2.4.2 to 2.5.1
- Upgrade httpx from 0.24.1 to 0.27.0 (latest stable)
- Add explicit gotrue==0.5.0 pin
- Enhance supabase_client.py with graceful initialization
- Fixes TypeError: Client proxy argument error on Railway worker startup"

if [ $? -ne 0 ]; then
    echo "❌ Commit failed"
    exit 1
fi

echo "✓ Changes committed"
echo ""

# Step 4: Push to test0
echo "🚀 Pushing to test0..."
git push origin test0

if [ $? -ne 0 ]; then
    echo "❌ Push failed"
    exit 1
fi

echo "✓ Pushed to test0"
echo ""

# Step 5: Instructions
echo "=========================================="
echo "✅ DEPLOYMENT INITIATED"
echo "=========================================="
echo ""
echo "🔍 Next Steps:"
echo ""
echo "1. Go to Railway Dashboard:"
echo "   https://railway.app/project/community-guard-production"
echo ""
echo "2. Click 'Backend' service"
echo ""
echo "3. Click 'Deployments' tab"
echo ""
echo "4. Watch for new deployment (2-3 minutes)"
echo ""
echo "5. Expected success:"
echo "   ✓ Supabase client initialized successfully"
echo "   [INFO] Listening at: http://0.0.0.0:8000"
echo ""
echo "6. If it fails:"
echo "   • Check environment variables are set (SUPABASE_URL, SUPABASE_KEY)"
echo "   • Click 'Redeploy' button for fresh container"
echo "   • Wait 2-3 minutes and check logs again"
echo ""
echo "=========================================="

# Optional: Open Railway dashboard
if command -v open &> /dev/null; then
    read -p "Open Railway Dashboard in browser? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open "https://railway.app/project/community-guard-production"
    fi
fi
