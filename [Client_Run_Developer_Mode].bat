@echo off
set "ProcessName=electron.exe"

echo Checking for %ProcessName%...

taskkill /F /IM "%ProcessName%" >nul 2>&1
if %errorlevel% equ 0 (
    echo %date% %time% - %ProcessName% found and terminated.
) else (
    echo %date% %time% - %ProcessName% not running.
)

:: -----------------------------------------------------------
:: Script starts here
:: -----------------------------------------------------------
cd /d "%~dp0"
cd client

echo Starting app in developer mode...
npm start -- --developer-mode