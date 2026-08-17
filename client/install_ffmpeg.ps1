param(
    [string]$Destination
)

$ErrorActionPreference = 'Stop'
$downloadUrl = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'
$checksumUrl = "$downloadUrl.sha256"

if ([string]::IsNullOrWhiteSpace($Destination)) {
    $Destination = Join-Path $PSScriptRoot 'dependencies\ffmpeg.exe'
}

$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("hdzero-ffmpeg-" + [guid]::NewGuid().ToString('N'))
$archivePath = Join-Path $temporaryDirectory 'ffmpeg.zip'
$checksumPath = Join-Path $temporaryDirectory 'ffmpeg.zip.sha256'
$extractPath = Join-Path $temporaryDirectory 'extracted'

try {
    New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
    Write-Host 'Downloading the FFmpeg release essentials build...'
    if (Get-Command 'curl.exe' -ErrorAction SilentlyContinue) {
        & curl.exe --fail --location --retry 2 --connect-timeout 20 --max-time 900 --output $archivePath $downloadUrl
        if ($LASTEXITCODE -ne 0) {
            throw "FFmpeg download failed with curl exit code $LASTEXITCODE."
        }
        & curl.exe --fail --location --retry 2 --connect-timeout 20 --max-time 60 --output $checksumPath $checksumUrl
        if ($LASTEXITCODE -ne 0) {
            throw "FFmpeg checksum download failed with curl exit code $LASTEXITCODE."
        }
    }
    else {
        Invoke-WebRequest -UseBasicParsing -TimeoutSec 900 -Uri $downloadUrl -OutFile $archivePath
        Invoke-WebRequest -UseBasicParsing -TimeoutSec 60 -Uri $checksumUrl -OutFile $checksumPath
    }

    Write-Host 'Verifying the FFmpeg archive...'
    $expectedHash = ((Get-Content -Raw -LiteralPath $checksumPath) -split '\s+')[0].Trim().ToUpperInvariant()
    $actualHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $archivePath).Hash.ToUpperInvariant()
    if ($expectedHash -notmatch '^[A-F0-9]{64}$' -or $actualHash -ne $expectedHash) {
        throw 'The downloaded FFmpeg archive failed SHA-256 verification.'
    }

    Write-Host 'Extracting ffmpeg.exe...'
    Expand-Archive -LiteralPath $archivePath -DestinationPath $extractPath -Force
    $ffmpeg = Get-ChildItem -LiteralPath $extractPath -Filter 'ffmpeg.exe' -File -Recurse | Select-Object -First 1
    if (-not $ffmpeg) {
        throw 'ffmpeg.exe was not found inside the downloaded archive.'
    }

    $destinationDirectory = Split-Path -Parent $Destination
    New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
    Copy-Item -LiteralPath $ffmpeg.FullName -Destination $Destination -Force

    & $Destination -version 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw 'The downloaded ffmpeg.exe could not be started.'
    }

    Write-Host "FFmpeg installed at: $Destination"
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}
finally {
    if (Test-Path -LiteralPath $temporaryDirectory) {
        Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force -ErrorAction SilentlyContinue
    }
}
