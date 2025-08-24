@echo off
echo ========================================
echo 🧪 Testing Local Setup Before Railway
echo ========================================
echo.

echo 📦 Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo ❌ npm install failed
    goto :error
)

echo.
echo 🔧 Generating Prisma client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo ❌ Prisma generate failed
    goto :error
)

echo.
echo 🌐 Testing server startup (will exit after 10 seconds)...
timeout /t 2 >nul
start /b node backend/server.js
timeout /t 8 >nul
taskkill /f /im node.exe >nul 2>&1

echo.
echo ✅ Local setup looks good!
echo 🚂 Railway deployment should work now.
echo.
echo 📋 Next steps:
echo 1. Make sure DATABASE_URL is set in Railway
echo 2. Remove MONGODB_URI from Railway variables
echo 3. Wait for Railway to redeploy
echo 4. Test https://your-app.railway.app/api/health
echo.
goto :end

:error
echo.
echo ❌ Local setup failed. Check the errors above.
echo 🔧 Railway deployment might also fail.
echo.

:end
echo Press any key to exit...
pause >nul