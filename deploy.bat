@echo off
echo ====================================
echo    AirHost AI - Auto Deploy Script
echo ====================================
echo.

:: Check if commit message was provided
if "%~1"=="" (
    echo ❌ Error: Please provide a commit message
    echo Usage: deploy.bat "Your commit message here"
    pause
    exit /b 1
)

set COMMIT_MSG=%~1

echo 📝 Commit message: %COMMIT_MSG%
echo.

:: Add all changes
echo 🔄 Adding changes to git...
git add .
if errorlevel 1 (
    echo ❌ Error adding files to git
    pause
    exit /b 1
)

:: Commit with timestamp
echo 📦 Committing changes...
git commit -m "%COMMIT_MSG%

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
if errorlevel 1 (
    echo ⚠️ Nothing to commit or commit failed
    echo Continuing with deployment...
)

:: Push to GitHub
echo 🚀 Pushing to GitHub...
git push origin main
if errorlevel 1 (
    echo ❌ Error pushing to GitHub
    pause
    exit /b 1
)

:: Deploy to Railway
echo 🚂 Deploying to Railway...
railway up
if errorlevel 1 (
    echo ❌ Error deploying to Railway
    pause
    exit /b 1
)

echo.
echo ✅ Deployment completed successfully!
echo 🌐 Backend URL: https://airhost-backend-production.up.railway.app
echo 📊 Health Check: https://airhost-backend-production.up.railway.app/api/health
echo.
pause