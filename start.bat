@echo off
echo ==========================================
echo AEVINITE Hackathon Platform - Quick Start
echo ==========================================
echo.
echo [1/2] Installing dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
    echo.
    echo ERROR: npm install failed. Please check your internet connection and try again.
    pause
    exit /b %ERRORLEVEL%
)
echo.
echo [2/2] Launching development server...
echo The application will be available at http://localhost:5173
echo.
npm run dev
pause
