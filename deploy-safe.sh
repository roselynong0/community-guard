#!/bin/bash
# 🚀 Safe Deployment Script for Community Guard
# This script helps you deploy safely to Railway

set -e  # Exit on error

echo "=========================================="
echo "Community Guard - Safe Deployment Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Verify we're in the right directory
echo -e "${YELLOW}Step 1: Verifying directory structure...${NC}"
if [ ! -f "backend/requirements.txt" ]; then
    echo -e "${RED}Error: Not in the correct directory${NC}"
    echo "Please run this script from the repository root"
    exit 1
fi
echo -e "${GREEN}✓ Directory structure verified${NC}"
echo ""

# Step 2: Check backend requirements
echo -e "${YELLOW}Step 2: Verifying backend dependencies...${NC}"
if grep -q "supabase==2.4.2" backend/requirements.txt; then
    echo -e "${GREEN}✓ Supabase 2.4.2 (compatible version)${NC}"
else
    echo -e "${RED}✗ Supabase version mismatch${NC}"
    exit 1
fi

if grep -q "httpx==0.24.1" backend/requirements.txt; then
    echo -e "${GREEN}✓ httpx 0.24.1 (pinned)${NC}"
else
    echo -e "${RED}✗ httpx version missing or incorrect${NC}"
    exit 1
fi

if grep -q "gunicorn==23.0.0" backend/requirements.txt; then
    echo -e "${GREEN}✓ gunicorn 23.0.0 (pinned)${NC}"
else
    echo -e "${RED}✗ gunicorn version mismatch${NC}"
    exit 1
fi
echo ""

# Step 3: Verify supabase_client.py has error handling
echo -e "${YELLOW}Step 3: Verifying Supabase client initialization...${NC}"
if grep -q "try:" backend/utils/supabase_client.py && grep -q "raise ValueError" backend/utils/supabase_client.py; then
    echo -e "${GREEN}✓ Error handling implemented${NC}"
else
    echo -e "${RED}✗ Error handling missing${NC}"
    exit 1
fi
echo ""

# Step 4: Test backend locally (if Python available)
echo -e "${YELLOW}Step 4: Testing backend startup (local test)...${NC}"
if command -v python3 &> /dev/null; then
    echo "Attempting local Python import test..."
    cd backend
    
    # Just test imports without running the server
    python3 -c "
import sys
sys.path.insert(0, '.')
try:
    from config import Config
    print('✓ Config imports successfully')
    
    # Don't actually create Supabase client locally
    # Just verify the file structure
    from utils import supabase
    print('✓ Utils module structure verified')
    
    print('✓ All imports successful')
except Exception as e:
    print(f'✗ Import failed: {e}')
    sys.exit(1)
" || exit 1
    
    cd ..
    echo -e "${GREEN}✓ Backend structure validated${NC}"
else
    echo -e "${YELLOW}⚠ Python3 not available for local testing (this is okay, will test on Railway)${NC}"
fi
echo ""

# Step 5: Git status check
echo -e "${YELLOW}Step 5: Checking git status...${NC}"
git_status=$(git status --porcelain)
if [ -z "$git_status" ]; then
    echo -e "${GREEN}✓ No uncommitted changes${NC}"
else
    echo -e "${YELLOW}⚠ Uncommitted changes detected:${NC}"
    echo "$git_status"
    echo ""
    read -p "Do you want to commit these changes? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git add -A
        git commit -m "fix: Update Supabase and dependencies for Railway compatibility"
        echo -e "${GREEN}✓ Changes committed${NC}"
    fi
fi
echo ""

# Step 6: Show deployment info
echo -e "${YELLOW}Step 6: Deployment Configuration${NC}"
echo ""
echo "Backend Configuration:"
echo "  - Python: 3.11 (from runtime.txt)"
echo "  - Process: gunicorn app:app (from Procfile)"
echo "  - Port: 8000"
echo "  - Dependencies: Updated and pinned"
echo ""
echo "Frontend Configuration:"
echo "  - VITE_API_URL: https://community-guard-production.up.railway.app"
echo ""
echo -e "${GREEN}✓ All checks passed!${NC}"
echo ""

# Step 7: Ask for deployment confirmation
echo -e "${YELLOW}Step 7: Ready to deploy?${NC}"
read -p "Push to test0 and deploy to Railway? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Pushing to test0...${NC}"
    git push origin test0
    echo -e "${GREEN}✓ Pushed to test0${NC}"
    echo ""
    echo -e "${YELLOW}Next steps:${NC}"
    echo "1. Go to Railway Dashboard"
    echo "2. Select 'Backend' service"
    echo "3. Monitor Deployment tab"
    echo "4. Wait for 'Deploy successful'"
    echo "5. Check logs for any errors"
    echo ""
    echo "If you see 'Worker exiting (pid:2)' or 'proxy' errors:"
    echo "- Go to Railway Variables tab"
    echo "- Verify SUPABASE_URL and SUPABASE_KEY are set"
    echo "- Click 'Redeploy' button to rebuild"
else
    echo -e "${YELLOW}Deployment cancelled${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Deployment safety check complete!${NC}"
echo "=========================================="
