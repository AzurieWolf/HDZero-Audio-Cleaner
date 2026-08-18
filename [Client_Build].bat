@echo off
setlocal EnableDelayedExpansion

:: -----------------------------------------------------------
:: Always run from script directory
:: -----------------------------------------------------------
cd /d "%~dp0"
cd client

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

if not exist "dependencies\models\DeepFilterNet3\checkpoints\model_120.ckpt.best" (
    echo.
    echo ERROR: The DeepFilterNet3 model checkpoint is missing.
    echo Run [Client_Install_Requirements].bat before building the application.
    pause
    exit /b 1
)

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
:: Copy win-unpacked output
:: -----------------------------------------------------------
if exist "dist\win-unpacked" (
    echo.
    echo ========================================
    echo Copying build to dist-client...
    echo ========================================
    robocopy "dist\win-unpacked" "dist-client" /E /NFL /NDL /NJH /NJS /NC /NS >nul
    set "ROBOCOPY_RESULT=!errorlevel!"
    if !ROBOCOPY_RESULT! GEQ 8 (
        echo.
        echo ========================================
        echo ERROR: Copying the packaged application failed.
        echo Robocopy returned code !ROBOCOPY_RESULT!.
        echo The original build remains in client\dist\win-unpacked.
        echo ========================================
        pause
        exit /b 1
    )
) else (
    echo.
    echo ========================================
    echo ERROR: dist\win-unpacked not found!
    echo ========================================
    pause
    exit /b 1
)

:: -----------------------------------------------------------
:: Verify the complete packaged application exists
:: -----------------------------------------------------------
if not exist "dist-client\HDZero Audio Cleaner.exe" goto BUILD_INCOMPLETE
if not exist "dist-client\resources\denoise\denoise_worker.py" goto BUILD_INCOMPLETE
if not exist "dist-client\resources\models\DeepFilterNet3\checkpoints\model_120.ckpt.best" goto BUILD_INCOMPLETE

if exist "dist-client\HDZero Audio Cleaner.exe" (
    echo.
    echo ========================================
    echo Build successful. dist-client is ready.
    echo ========================================
) else (
    echo.
    echo ========================================
    echo ERROR: dist-client is incomplete.
    echo ========================================
    pause
    exit /b 1
)

goto BUILD_COMPLETE

:BUILD_INCOMPLETE
echo.
echo ========================================
echo ERROR: dist-client is incomplete.
echo The executable, denoise worker, or model checkpoint was not copied.
echo The original build remains in client\dist\win-unpacked for inspection.
echo ========================================
pause
exit /b 1

:BUILD_COMPLETE

:: -----------------------------------------------------------
:: Remove the temporary build only after the copied package is verified
:: -----------------------------------------------------------
if exist dist (
    echo.
    echo ========================================
    echo Cleaning up dist folder...
    echo ========================================
    attrib -r -s -h dist /s /d >nul 2>&1
    rmdir /s /q dist
)

REM === Open dist-client folder ===
start "" "dist-client"

echo.
echo ========================================
echo Finished building HDZero Audio Cleaner.
echo ========================================
echo.

endlocal
