@echo off
setlocal EnableDelayedExpansion

:: -----------------------------------------------------------
:: Always run from script directory
:: -----------------------------------------------------------
cd /d "%~dp0"
cd client

:: -----------------------------------------------------------
:: Elevate to Administrator if needed
:: -----------------------------------------------------------
net session >nul 2>&1
if %errorlevel% NEQ 0 (
    echo Requesting administrative privileges...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit
)

:: -----------------------------------------------------------
:: Kill any running instances of the client to prevent folder locks
:: -----------------------------------------------------------
set "ProcessName=HDZero Audio Cleaner.exe"

echo ========================================
echo Checking for %ProcessName%...
echo ========================================

taskkill /F /IM "%ProcessName%" >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo %date% %time% - %ProcessName% found and terminated.
    echo ========================================
) else (
    echo.
    echo ========================================
    echo %date% %time% - %ProcessName% not running.
    echo ========================================
)

:: -----------------------------------------------------------
:: Clean previous build folders
:: -----------------------------------------------------------
echo.
echo ========================================
echo Cleaning previous build folders...
echo ========================================

:: -----------------------------------------------------------
:: Remove dist-client folder
:: -----------------------------------------------------------
if exist dist-client (
    echo.
    echo ========================================
    echo Removing dist-client folder...
    echo ========================================
    attrib -r -s -h dist-client /s /d >nul 2>&1
    rmdir /s /q dist-client
)

:: -----------------------------------------------------------
:: Remove dist folder
:: -----------------------------------------------------------
if exist dist (
    echo.
    echo ========================================
    echo Removing dist folder...
    echo ========================================
    attrib -r -s -h dist /s /d >nul 2>&1
    rmdir /s /q dist
)

:: -----------------------------------------------------------
:: Build the project
:: -----------------------------------------------------------
echo.
echo ========================================
echo Building project...
echo ========================================

call npm run build

if %errorlevel% NEQ 0 (
    echo.
    echo ========================================
    echo Build failed. Aborting.
    echo ========================================
    pause
    exit /b 1
)

:: -----------------------------------------------------------
:: Move win-unpacked output
:: -----------------------------------------------------------
if exist "dist\win-unpacked" (
    echo.
    echo ========================================
    echo Moving build to dist-client...
    echo ========================================
    robocopy "dist\win-unpacked" "dist-client" /MOVE /E /NFL /NDL /NJH /NJS /NC /NS >nul
) else (
    echo.
    echo ========================================
    echo ERROR: dist\win-unpacked not found!
    echo ========================================
    pause
    exit /b 1
)

:: -----------------------------------------------------------
:: Final cleanup of dist-client folder (remove any leftover files)
:: -----------------------------------------------------------
if exist dist (
    echo.
    echo ========================================
    echo Cleaning up dist folder...
    echo ========================================
    attrib -r -s -h dist /s /d >nul 2>&1
    rmdir /s /q dist
)

:: -----------------------------------------------------------
:: Verify dist-client folder exists
:: -----------------------------------------------------------
if exist dist-client (
    echo.
    echo ========================================
    echo Build successful. dist-client is ready.
    echo ========================================
) else (
    echo.
    echo ========================================
    echo ERROR: dist-client folder not found after build!
    echo ========================================
    pause
    exit /b 1
)

REM === Open dist-client folder ===
start "" "dist-client"

echo.
echo ========================================
echo Finished building HDZero Audio Cleaner.
echo ========================================
echo.

endlocal
