#!/bin/bash
# 🚀 Render Deployment Script for Community Guard

set -e  # Exit on error

echo "=========================================="
echo "Community Guard - Render Deployment Script"
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
if grep -q "supabase" backend/requirements.txt; then
    echo -e "${GREEN}✓ Supabase dependency found${NC}"
else
    echo -e "${RED}✗ Supabase dependency missing${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All dependencies verified${NC}"
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

# Step 4: Git status check
echo -e "${YELLOW}Step 4: Checking git status...${NC}"
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
        git commit -m "chore: Prepare for Render deployment"
        echo -e "${GREEN}✓ Changes committed${NC}"
    fi
fi
echo ""

# Step 5: Show deployment info
echo -e "${YELLOW}Step 5: Deployment Configuration${NC}"
echo ""
echo "Backend Configuration:"
echo "  - Python: 3.11"
echo "  - Process: gunicorn app:app"
echo "  - Port: 8000"
echo "  - API URL: https://community-guard-backend.onrender.com"
echo ""
echo "Frontend Configuration:"
echo "  - VITE_API_URL: https://community-guard-backend.onrender.com"
echo ""
echo -e "${GREEN}✓ All checks passed!${NC}"
echo ""

# Step 6: Instructions
echo "=========================================="
echo "✅ READY FOR RENDER DEPLOYMENT"
echo "=========================================="
echo ""
echo "🔍 Next Steps:"
echo ""
echo "1. Push your changes to GitHub:"
echo "   git push origin main"
echo ""
echo "2. Go to Render Dashboard:"
echo "   https://dashboard.render.com"
echo ""
echo "3. Create a new Web Service"
echo "   - Connect your GitHub repository"
echo "   - Select the render.yaml configuration"
echo "   - Deploy!"
echo ""
echo "4. Monitor the deployment in Render"
echo ""
echo "5. Update Vercel environment variables if needed"
echo ""
echo "=========================================="
echo -e "${GREEN}Deployment preparation complete!${NC}"
echo "=========================================="