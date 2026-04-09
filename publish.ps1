$ErrorActionPreference = 'Stop'

$sourceRoot = 'C:\Projects\BinanceTradingBot'
$publishRoot = 'C:\BinanceTradingBot'
$distSource = Join-Path $sourceRoot 'dist'
$strategiesSource = Join-Path $sourceRoot 'strategies'

if (-not (Test-Path $distSource)) {
    throw "Build output not found at '$distSource'. Run 'npm.cmd run build' first."
}

New-Item -ItemType Directory -Force -Path $publishRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $publishRoot 'strategies') | Out-Null

Copy-Item -Path (Join-Path $distSource '*') -Destination $publishRoot -Recurse -Force
Copy-Item -Path (Join-Path $strategiesSource '*.json') -Destination (Join-Path $publishRoot 'strategies') -Force

$optionalFiles = @(
    '.env',
    'package.json',
    'EXECUTION_GUIDE.md',
    'EXECUTION_GUIDE.es.md',
    'README.md'
)

foreach ($file in $optionalFiles) {
    $sourceFile = Join-Path $sourceRoot $file
    if (Test-Path $sourceFile) {
        Copy-Item -Path $sourceFile -Destination (Join-Path $publishRoot $file) -Force
    }
}

$legacyArtifacts = @(
    'backtest-ab.js',
    'backtest-ab.js.map'
)

foreach ($legacyFile in $legacyArtifacts) {
    $targetPath = Join-Path $publishRoot $legacyFile
    if (Test-Path $targetPath) {
        Remove-Item -Path $targetPath -Force
    }
}

Write-Host "Publish completed to $publishRoot"
Write-Host 'Contents:'
Get-ChildItem -Force $publishRoot
