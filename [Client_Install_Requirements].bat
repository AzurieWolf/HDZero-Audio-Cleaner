@echo off
setlocal EnableExtensions

:: Always run from this script's client directory.
cd /d "%~dp0"
cd client

where npm >nul 2>&1
if errorlevel 1 (
    echo.
    echo ========================================
    echo ERROR: npm was not found.
    echo Install Node.js, then run this file again.
    echo ========================================
    pause
    exit /b 1
)

echo.
echo ========================================
echo Installing HDZero Audio Cleaner requirements...
echo ========================================
echo.

call npm install
if errorlevel 1 (
    echo.
    echo ========================================
    echo ERROR: Electron requirements installation failed.
    echo ========================================
    pause
    exit /b 1
)

:: Verify or download the FFmpeg executable used by the application.
call :CHECK_FFMPEG
if not errorlevel 1 goto FFMPEG_READY

echo.
echo FFmpeg was not found. Downloading the Windows release essentials build...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%CD%\install_ffmpeg.ps1"
if errorlevel 1 goto FFMPEG_FAILED

call :CHECK_FFMPEG
if errorlevel 1 goto FFMPEG_FAILED

:FFMPEG_READY
echo FFmpeg is ready.

:: DeepFilterLib provides a prebuilt Windows wheel for Python 3.11.
:: Newer Python versions attempt a Rust source build and are not supported.
call :CHECK_PYTHON311
if not errorlevel 1 goto INSTALL_DENOISE

echo.
echo Python 3.11 is required for DeepFilterNet noise reduction.
echo Python 3.12 and newer cannot use the supplied prebuilt DeepFilterLib wheel.
echo.
set /p "INSTALL_PYTHON=Download and install Python 3.11.9 for the current user now? [Y/N]: "
if /I not "%INSTALL_PYTHON%"=="Y" goto PYTHON_DECLINED

set "PYTHON_INSTALLER=%TEMP%\hdzero-python-3.11.9-amd64.exe"
echo.
echo Downloading Python 3.11.9 from python.org...
powershell.exe -NoProfile -Command "Invoke-WebRequest -UseBasicParsing -Uri 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe' -OutFile '%PYTHON_INSTALLER%'"
if errorlevel 1 (
    echo.
    echo ERROR: Python 3.11.9 could not be downloaded.
    echo Download it manually from https://www.python.org/downloads/release/python-3119/
    pause
    exit /b 1
)

echo Installing Python 3.11.9 for the current user...
start /wait "" "%PYTHON_INSTALLER%" /quiet InstallAllUsers=0 PrependPath=0 Include_launcher=1 Include_pip=1 Include_test=0
set "PYTHON_INSTALL_RESULT=%errorlevel%"
del /q "%PYTHON_INSTALLER%" >nul 2>&1
if not "%PYTHON_INSTALL_RESULT%"=="0" (
    echo.
    echo ERROR: Python 3.11.9 installation failed with code %PYTHON_INSTALL_RESULT%.
    pause
    exit /b 1
)

call :CHECK_PYTHON311
if errorlevel 1 (
    echo.
    echo ERROR: Python 3.11 was installed but the Python launcher cannot find it.
    echo Restart Windows, then run this installer again.
    pause
    exit /b 1
)

:INSTALL_DENOISE
echo.
echo Installing DeepFilterNet using Python 3.11...
py -3.11 -m pip install --disable-pip-version-check --no-warn-script-location --upgrade pip
if errorlevel 1 goto DENOISE_FAILED

:: DeepFilterNet 0.5.6 uses the torchaudio.backend API. Install the
:: matching CPU-only Torch 2.1.2 pair before the remaining packages.
py -3.11 -c "import torch, torchaudio; raise SystemExit(0 if torch.__version__.startswith('2.1.2') and torchaudio.__version__.startswith('2.1.2') else 1)" >nul 2>&1
if not errorlevel 1 goto TORCH_READY

echo Replacing incompatible Torch packages with CPU-only version 2.1.2...
py -3.11 -m pip install --disable-pip-version-check --no-warn-script-location --upgrade --force-reinstall torch==2.1.2 torchaudio==2.1.2 --index-url https://download.pytorch.org/whl/cpu
if errorlevel 1 goto DENOISE_FAILED

:TORCH_READY
:: Refuse source compilation so a missing wheel produces a useful error
:: instead of requesting a Rust/Cargo toolchain.
py -3.11 -m pip install --disable-pip-version-check --no-warn-script-location --only-binary=deepfilterlib -r requirements.txt
if errorlevel 1 goto DENOISE_FAILED

py -3.11 -W ignore::UserWarning -c "import df, soundfile, torch, torchaudio"
if errorlevel 1 goto DENOISE_FAILED

if exist "dependencies\models\DeepFilterNet3\checkpoints\model_120.ckpt.best" goto DENOISE_MODEL_READY
echo.
echo Downloading the DeepFilterNet3 model used by noise reduction...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%CD%\install_deepfilter_model.ps1"
if errorlevel 1 goto DENOISE_FAILED

:DENOISE_MODEL_READY

echo.
echo ========================================
echo All requirements installed successfully.
echo FFmpeg, Python 3.11, and DeepFilterNet are ready.
echo ========================================
echo.
pause
exit /b 0

:CHECK_PYTHON311
where py >nul 2>&1
if errorlevel 1 exit /b 1
py -3.11 -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 11) else 1)" >nul 2>&1
exit /b %errorlevel%

:CHECK_FFMPEG
if not exist "dependencies\ffmpeg.exe" exit /b 1
"dependencies\ffmpeg.exe" -version >nul 2>&1
exit /b %errorlevel%

:FFMPEG_FAILED
echo.
echo ========================================
echo ERROR: FFmpeg could not be downloaded.
echo.
echo Download the release essentials ZIP from:
echo https://www.gyan.dev/ffmpeg/builds/
echo.
echo Extract bin\ffmpeg.exe and place it here:
echo %CD%\dependencies\ffmpeg.exe
echo.
echo The download page will now open in your browser.
echo ========================================
start "" "https://www.gyan.dev/ffmpeg/builds/"
pause
exit /b 1

:PYTHON_DECLINED
echo.
echo ========================================
echo Electron requirements are installed.
echo AI noise reduction was not installed.
echo Channel removal will still work normally.
echo ========================================
echo.
pause
exit /b 1

:DENOISE_FAILED
echo.
echo ========================================
echo ERROR: DeepFilterNet installation failed.
echo The app can still remove audio channels,
echo but AI noise reduction is not available.
echo ========================================
echo.
pause
exit /b 1
