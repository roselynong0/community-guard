# Community Guard - Local Development Setup Script
# This script sets up everything you need to run the system locally

Write-Host "🚀 Community Guard - Setup Script" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Get project root
$projectRoot = "c:\Users\Roselyn\Desktop\GitHub\community-guard\master"
$backendDir = "$projectRoot\backend"
$frontendDir = "$projectRoot\frontend"

# Change to project root
cd $projectRoot

Write-Host "📁 Project Root: $projectRoot" -ForegroundColor Green

# ==========================================
# Step 1: Check Python Installation
# ==========================================
Write-Host ""
Write-Host "Step 1: Checking Python Installation..." -ForegroundColor Yellow

try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python not found. Please install Python 3.8+" -ForegroundColor Red
    exit 1
}

# ==========================================
# Step 2: Check Node.js Installation
# ==========================================
Write-Host ""
Write-Host "Step 2: Checking Node.js Installation..." -ForegroundColor Yellow

try {
    $nodeVersion = node --version
    $npmVersion = npm --version
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
    Write-Host "✅ npm found: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js or npm not found. Please install Node.js 16+" -ForegroundColor Red
    exit 1
}

# ==========================================
# Step 3: Install Python Dependencies
# ==========================================
Write-Host ""
Write-Host "Step 3: Installing Python Dependencies..." -ForegroundColor Yellow

Write-Host "Installing Flask dependencies..." -ForegroundColor Cyan

# Check if requirements.txt exists
if (Test-Path "$backendDir\requirements.txt") {
    pip install -r "$backendDir\requirements.txt" -q
    Write-Host "✅ Flask dependencies installed" -ForegroundColor Green
} else {
    Write-Host "⚠️  requirements.txt not found" -ForegroundColor Yellow
}

# Install scikit-learn and numpy for ML
Write-Host "Installing ML dependencies (scikit-learn, numpy)..." -ForegroundColor Cyan
pip install scikit-learn numpy -q
Write-Host "✅ ML dependencies installed" -ForegroundColor Green

# Verify critical packages
Write-Host "Verifying packages..." -ForegroundColor Cyan
$packages = @("flask", "flask-cors", "flask-caching", "scikit-learn", "numpy")
foreach ($pkg in $packages) {
    try {
        $version = pip show $pkg 2>&1 | Select-String "Version"
        Write-Host "✅ $pkg installed" -ForegroundColor Green
    } catch {
        Write-Host "❌ $pkg not installed" -ForegroundColor Red
    }
}

# ==========================================
# Step 4: Install Frontend Dependencies
# ==========================================
Write-Host ""
Write-Host "Step 4: Installing Frontend Dependencies..." -ForegroundColor Yellow

cd "$frontendDir"

if (Test-Path "$frontendDir\package.json") {
    Write-Host "Installing npm packages..." -ForegroundColor Cyan
    npm install -q
    Write-Host "✅ npm packages installed" -ForegroundColor Green
} else {
    Write-Host "❌ package.json not found" -ForegroundColor Red
}

# ==========================================
# Step 5: Verify Files
# ==========================================
Write-Host ""
Write-Host "Step 5: Verifying AI Component Files..." -ForegroundColor Yellow

$filesToCheck = @(
    @{
        Path = "$backendDir\routes\ai_endpoints.py"
        Name = "AI Endpoints (Backend)"
    },
    @{
        Path = "$backendDir\services\ml_categorizer.py"
        Name = "ML Categorizer (Backend)"
    },
    @{
        Path = "$frontendDir\src\components\IncidentCategorySelector.jsx"
        Name = "Category Selector (Frontend)"
    },
    @{
        Path = "$frontendDir\src\styles\IncidentCategorySelector.css"
        Name = "Category Selector Styles (Frontend)"
    }
)

$allFilesExist = $true

foreach ($file in $filesToCheck) {
    if (Test-Path $file.Path) {
        Write-Host "✅ $($file.Name)" -ForegroundColor Green
    } else {
        Write-Host "❌ $($file.Name) - NOT FOUND" -ForegroundColor Red
        $allFilesExist = $false
    }
}

# ==========================================
# Step 6: Verify app.py Blueprint Registration
# ==========================================
Write-Host ""
Write-Host "Step 6: Verifying Blueprint Registration..." -ForegroundColor Yellow

$appPyPath = "$backendDir\app.py"
$appPyContent = Get-Content $appPyPath -Raw

if ($appPyContent -match "from routes.ai_endpoints import ai_bp") {
    Write-Host "✅ AI blueprint import found in app.py" -ForegroundColor Green
} else {
    Write-Host "❌ AI blueprint import NOT found - need to add it" -ForegroundColor Red
    $allFilesExist = $false
}

if ($appPyContent -match "app.register_blueprint\(ai_bp") {
    Write-Host "✅ AI blueprint registration found in app.py" -ForegroundColor Green
} else {
    Write-Host "❌ AI blueprint registration NOT found - need to add it" -ForegroundColor Red
    $allFilesExist = $false
}

# ==========================================
# Summary
# ==========================================
Write-Host ""
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

if ($allFilesExist) {
    Write-Host ""
    Write-Host "✅ All files and dependencies verified!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Open Terminal 1 and run:" -ForegroundColor Cyan
    Write-Host "   cd $backendDir" -ForegroundColor White
    Write-Host "   python app.py" -ForegroundColor White
    Write-Host ""
    Write-Host "2. Open Terminal 2 and run:" -ForegroundColor Cyan
    Write-Host "   cd $frontendDir" -ForegroundColor White
    Write-Host "   npm run dev" -ForegroundColor White
    Write-Host ""
    Write-Host "3. Open browser to:" -ForegroundColor Cyan
    Write-Host "   http://localhost:5173" -ForegroundColor White
    Write-Host ""
    Write-Host "4. Test the API:" -ForegroundColor Cyan
    Write-Host "   curl http://localhost:5000/api/health" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "⚠️  Some files or configurations are missing!" -ForegroundColor Yellow
    Write-Host "Please check the messages above and run the setup again." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📚 Documentation:" -ForegroundColor Yellow
Write-Host "- QUICK_START_GUIDE.md" -ForegroundColor Cyan
Write-Host "- AI_CATEGORIZATION_GUIDE.md" -ForegroundColor Cyan
Write-Host "- FILE_COPY_INSTRUCTIONS.md" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Setup script complete!" -ForegroundColor Green
