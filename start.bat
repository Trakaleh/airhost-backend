@echo off
echo ========================================
echo 🚀 Starting AirHost AI Application
echo ========================================
echo.

echo Starting Backend Server...
cd backend
start cmd /k "echo Backend Server Started & node server.js"

echo.
echo ✅ Backend started on: http://localhost:3001
echo 📊 Health Check: http://localhost:3001/api/health
echo 📖 API Docs: http://localhost:3001/api/info
echo.

echo 🌐 Frontend files are in the public folder
echo    You can serve them with any static server or open index.html directly
echo.

echo Press any key to exit...
pause >nul