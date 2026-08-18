$ErrorActionPreference = 'Stop'

$projectDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$modelsDirectory = Join-Path $projectDirectory 'dependencies\models'
$modelDirectory = Join-Path $modelsDirectory 'DeepFilterNet3'
$checkpoint = Join-Path $modelDirectory 'checkpoints\model_120.ckpt.best'
$downloadUrl = 'https://github.com/Rikorose/DeepFilterNet/raw/main/models/DeepFilterNet3.zip'

if (Test-Path -LiteralPath $checkpoint -PathType Leaf) {
    Write-Host 'DeepFilterNet3 model is already installed.'
    exit 0
}

$temporaryRoot = [System.IO.Path]::GetTempPath()
$temporaryDirectory = Join-Path $temporaryRoot ("hdzero-deepfilter-{0}" -f [guid]::NewGuid().ToString('N'))
$archive = Join-Path $temporaryDirectory 'DeepFilterNet3.zip'

try {
    New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null
    New-Item -ItemType Directory -Force -Path $modelsDirectory | Out-Null
    Write-Host 'Downloading the DeepFilterNet3 model...'
    Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $archive
    Expand-Archive -LiteralPath $archive -DestinationPath $modelsDirectory -Force

    if (-not (Test-Path -LiteralPath $checkpoint -PathType Leaf)) {
        throw 'The downloaded archive did not contain the DeepFilterNet3 checkpoint.'
    }
    Write-Host 'DeepFilterNet3 model is ready.'
}
finally {
    $resolvedTemporaryRoot = [System.IO.Path]::GetFullPath($temporaryRoot)
    $resolvedTemporaryDirectory = [System.IO.Path]::GetFullPath($temporaryDirectory)
    if ($resolvedTemporaryDirectory.StartsWith($resolvedTemporaryRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        Remove-Item -LiteralPath $resolvedTemporaryDirectory -Recurse -Force -ErrorAction SilentlyContinue
    }
}
