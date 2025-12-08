#!/usr/bin/env powershell
"""
Safe Cleanup Script: Remove Old Ollama/LangChain Files
Backs up deleted files before removing them
"""

param(
    [switch]$DryRun = $false,  # Preview what will be deleted without actually deleting
    [switch]$Backup = $true     # Create backup before deleting
)

$ErrorActionPreference = "Stop"

# Files to delete
$filesToDelete = @(
    "ai_core.py",
    "ollama_app.py",
    "start-ollama.ps1",
    "start-ollama.sh",
    "test_ollama_api.py",
    "test_ai_endpoints_http.py",
    "test_ai_mapping.py",
    "retrain_model.py",
    "OLLAMA_SETUP.md",
    "OLLAMA_INTEGRATION_SUMMARY.md",
    "OLLAMA_VERIFICATION_CHECKLIST.md",
    "OLLAMA_QUICK_REFERENCE.md",
    "DELIVERY_PACKAGE.md",
    "QUICK_START.md",
    "OLLAMA_IMPLEMENTATION.md",
    "MIGRATION_COMPLETE.md",
    "routes/ollama_ai.py",
    "routes/chatbot_ollama.py",
    "routes/ai_endpoints.py"
)

$servicesToDelete = @(
    "services/langchain_service.py",
    "services/ollama_service.py",
    "services/rag_service.py",
    "services/ml_categorizer.py",
    "services/analytics_service.py"
)

function Print-Header {
    param([string]$text)
    Write-Host ""
    Write-Host "╔" + ("=" * 70) + "╗"
    Write-Host "║  $text" + (" " * (68 - $text.Length)) + "║"
    Write-Host "╚" + ("=" * 70) + "╝"
}

function Print-Mode {
    if ($DryRun) {
        Write-Host "📋 DRY RUN MODE - No files will be deleted" -ForegroundColor Yellow
    } else {
        Write-Host "🗑️  ACTUAL DELETION MODE - Files will be permanently deleted" -ForegroundColor Red
    }
}

Print-Header "COMMUNITY GUARD - OLD FILES CLEANUP"
Print-Mode

# Get current location
$backendPath = Split-Path -Parent $MyInvocation.MyCommand.Path
if ((Split-Path -Leaf $backendPath) -ne "backend") {
    $backendPath = Join-Path (Split-Path -Parent $backendPath) "backend"
}

Write-Host ""
Write-Host "Backend path: $backendPath"
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path (Join-Path $backendPath "ai_core_lean.py"))) {
    Write-Host "❌ Error: Can't find backend directory or ai_core_lean.py" -ForegroundColor Red
    Write-Host "Make sure you're running this from the backend directory"
    exit 1
}

# Create backup if needed
if ($Backup -and -not $DryRun) {
    Print-Header "CREATING BACKUP"
    $date = (Get-Date).ToString("yyyy-MM-dd_HHmmss")
    $backupPath = Join-Path (Split-Path -Parent $backendPath) "backend_backup_$date"
    
    Write-Host "Backing up to: $backupPath"
    Copy-Item -Path $backendPath -Destination $backupPath -Recurse
    Write-Host "✅ Backup created successfully" -ForegroundColor Green
}

# Count files to delete
$totalFiles = $filesToDelete.Count + $servicesToDelete.Count
Write-Host ""
Write-Host "📊 Files to delete: $totalFiles"
Write-Host ""

# Show files in backend root
Print-Header "FILES IN BACKEND ROOT"
$rootFilesToDelete = @()
foreach ($file in $filesToDelete) {
    if (-not $file.Contains("/")) {
        $rootFilesToDelete += $file
    }
}

Write-Host "Count: $($rootFilesToDelete.Count)"
foreach ($file in $rootFilesToDelete) {
    $filePath = Join-Path $backendPath $file
    if (Test-Path $filePath) {
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "  ⊘ $file (not found)" -ForegroundColor Gray
    }
}

# Show files in routes/
Print-Header "FILES IN ROUTES/"
$routeFiles = $filesToDelete | Where-Object { $_.StartsWith("routes/") }
Write-Host "Count: $($routeFiles.Count)"
foreach ($file in $routeFiles) {
    $filePath = Join-Path $backendPath $file
    if (Test-Path $filePath) {
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "  ⊘ $file (not found)" -ForegroundColor Gray
    }
}

# Show files in services/
Print-Header "FILES IN SERVICES/"
Write-Host "Count: $($servicesToDelete.Count)"
foreach ($file in $servicesToDelete) {
    $filePath = Join-Path $backendPath $file
    if (Test-Path $filePath) {
        Write-Host "  ✓ $file" -ForegroundColor Green
    } else {
        Write-Host "  ⊘ $file (not found)" -ForegroundColor Gray
    }
}

# Confirmation
Write-Host ""
if ($DryRun) {
    Write-Host "✅ DRY RUN: No files were deleted" -ForegroundColor Green
    Write-Host ""
    Write-Host "To actually delete the files, run:"
    Write-Host "  .\cleanup.ps1 -DryRun:`$false"
    exit 0
}

Write-Host "⚠️  WARNING: This will delete $totalFiles files permanently!" -ForegroundColor Red
Write-Host ""
$response = Read-Host "Are you sure? Type 'yes' to confirm"

if ($response -ne "yes") {
    Write-Host "❌ Cancelled" -ForegroundColor Yellow
    exit 0
}

# Delete files
Print-Header "DELETING OLD FILES"

$deletedCount = 0
$failedCount = 0

# Delete backend root files
foreach ($file in $rootFilesToDelete) {
    $filePath = Join-Path $backendPath $file
    if (Test-Path $filePath) {
        try {
            Remove-Item -Path $filePath -Force
            Write-Host "  ✓ Deleted: $file" -ForegroundColor Green
            $deletedCount++
        } catch {
            Write-Host "  ✗ Failed: $file - $_" -ForegroundColor Red
            $failedCount++
        }
    }
}

# Delete route files
foreach ($file in $routeFiles) {
    $filePath = Join-Path $backendPath $file
    if (Test-Path $filePath) {
        try {
            Remove-Item -Path $filePath -Force
            Write-Host "  ✓ Deleted: $file" -ForegroundColor Green
            $deletedCount++
        } catch {
            Write-Host "  ✗ Failed: $file - $_" -ForegroundColor Red
            $failedCount++
        }
    }
}

# Delete service files
foreach ($file in $servicesToDelete) {
    $filePath = Join-Path $backendPath $file
    if (Test-Path $filePath) {
        try {
            Remove-Item -Path $filePath -Force
            Write-Host "  ✓ Deleted: $file" -ForegroundColor Green
            $deletedCount++
        } catch {
            Write-Host "  ✗ Failed: $file - $_" -ForegroundColor Red
            $failedCount++
        }
    }
}

# Summary
Print-Header "CLEANUP SUMMARY"
Write-Host "✅ Successfully deleted: $deletedCount files" -ForegroundColor Green
if ($failedCount -gt 0) {
    Write-Host "❌ Failed to delete: $failedCount files" -ForegroundColor Red
}

Write-Host ""
Write-Host "📝 Next steps:"
Write-Host "  1. Verify system still works:"
Write-Host "     python ai_app_lean.py"
Write-Host "  2. Test endpoints in another PowerShell window:"
Write-Host "     Invoke-RestMethod -Uri 'http://localhost:8000/api/ai/health' -Method Get"
Write-Host ""
Write-Host "✅ Cleanup complete!" -ForegroundColor Green
