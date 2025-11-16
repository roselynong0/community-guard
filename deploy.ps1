# Community Guard - Quick Deployment Script
# Run this in PowerShell

Write-Host "🚀 Community Guard Vercel Deployment Setup" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Vercel CLI is installed
Write-Host "📋 Checking prerequisites..." -ForegroundColor Yellow
try {
    $vercelVersion = vercel --version 2>$null
    Write-Host "✅ Vercel CLI is installed: $vercelVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Vercel CLI not found!" -ForegroundColor Red
    Write-Host "📦 Installing Vercel CLI..." -ForegroundColor Yellow
    npm install -g vercel
    Write-Host "✅ Vercel CLI installed successfully!" -ForegroundColor Green
}

Write-Host ""
Write-Host "🔐 Before deploying, make sure you have:" -ForegroundColor Yellow
Write-Host "  1. Created a Vercel account at https://vercel.com" -ForegroundColor White
Write-Host "  2. Your environment variables ready:" -ForegroundColor White
Write-Host "     - SUPABASE_URL" -ForegroundColor Gray
Write-Host "     - SUPABASE_KEY" -ForegroundColor Gray
Write-Host "     - SECRET_KEY" -ForegroundColor Gray
Write-Host "     - MJ_APIKEY_PUBLIC" -ForegroundColor Gray
Write-Host "     - MJ_APIKEY_PRIVATE" -ForegroundColor Gray
Write-Host ""

$continue = Read-Host "Do you want to continue with deployment? (Y/N)"

if ($continue -ne "Y" -and $continue -ne "y") {
    Write-Host "❌ Deployment cancelled." -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "🔑 Logging into Vercel..." -ForegroundColor Yellow
vercel login

Write-Host ""
Write-Host "📦 Choose deployment option:" -ForegroundColor Yellow
Write-Host "  1. Deploy Full Stack (Frontend + Backend together)" -ForegroundColor White
Write-Host "  2. Deploy Backend Only" -ForegroundColor White
Write-Host "  3. Deploy Frontend Only" -ForegroundColor White
Write-Host "  4. Deploy to Production (Full Stack)" -ForegroundColor White
Write-Host ""

$option = Read-Host "Enter option (1-4)"

switch ($option) {
    "1" {
        Write-Host ""
        Write-Host "🚀 Deploying Full Stack to Preview..." -ForegroundColor Cyan
        Set-Location "C:\Users\Roselyn\Desktop\GitHub\community-guard\master"
        vercel
    }
    "2" {
        Write-Host ""
        Write-Host "🐍 Deploying Backend Only..." -ForegroundColor Cyan
        Set-Location "C:\Users\Roselyn\Desktop\GitHub\community-guard\master\backend"
        vercel
    }
    "3" {
        Write-Host ""
        Write-Host "⚛️ Deploying Frontend Only..." -ForegroundColor Cyan
        Set-Location "C:\Users\Roselyn\Desktop\GitHub\community-guard\master\frontend"
        vercel
    }
    "4" {
        Write-Host ""
        Write-Host "🚀 Deploying Full Stack to PRODUCTION..." -ForegroundColor Cyan
        Write-Host "⚠️  This will deploy to your production URL!" -ForegroundColor Yellow
        $confirm = Read-Host "Are you sure? (Y/N)"
        if ($confirm -eq "Y" -or $confirm -eq "y") {
            Set-Location "C:\Users\Roselyn\Desktop\GitHub\community-guard\master"
            vercel --prod
        } else {
            Write-Host "❌ Production deployment cancelled." -ForegroundColor Red
        }
    }
    default {
        Write-Host "❌ Invalid option selected." -ForegroundColor Red
        exit
    }
}

Write-Host ""
Write-Host "✅ Deployment initiated!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Yellow
Write-Host "  1. Go to Vercel Dashboard: https://vercel.com/dashboard" -ForegroundColor White
Write-Host "  2. Find your project and click on it" -ForegroundColor White
Write-Host "  3. Go to Settings > Environment Variables" -ForegroundColor White
Write-Host "  4. Add all required environment variables" -ForegroundColor White
Write-Host "  5. Redeploy if necessary" -ForegroundColor White
Write-Host ""
Write-Host "🔗 Your deployment URLs will be shown above" -ForegroundColor Cyan
Write-Host ""
