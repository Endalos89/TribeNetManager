$ErrorActionPreference = 'Stop'

if (-not $env:APP_VERSION) {
  throw 'APP_VERSION must be set to the version of the installer being tested.'
}

$installerPath = Join-Path $PWD "release/TribeNet Manager Setup $env:APP_VERSION.exe"
if (-not (Test-Path $installerPath)) {
  throw "Built installer not found: $installerPath"
}

$setupPattern = '^TribeNet(?:-Manager-Setup-| Manager Setup ).+\.exe$'
$releases = Invoke-RestMethod -Headers @{ 'User-Agent' = 'TribeNetManager-Installer-Regression' } `
  -Uri 'https://api.github.com/repos/Endalos89/TribeNetManager/releases?per_page=100'
$release = $releases | Where-Object {
  @($_.assets | Where-Object { $_.name -match $setupPattern }).Count -gt 0
} | Select-Object -First 1
if (-not $release) {
  throw 'No published TribeNet Manager setup installer was found in the latest 100 releases.'
}
$previousInstaller = $release.assets | Where-Object { $_.name -match $setupPattern } | Select-Object -First 1

$oldInstallerPath = Join-Path $env:RUNNER_TEMP $previousInstaller.name
Invoke-WebRequest -Headers @{ 'User-Agent' = 'TribeNetManager-Installer-Regression' } `
  -Uri $previousInstaller.browser_download_url -OutFile $oldInstallerPath

$installDirectory = Join-Path $env:RUNNER_TEMP "TribeNetUpgradeTest-$PID"
if (Test-Path $installDirectory) {
  Remove-Item -LiteralPath $installDirectory -Recurse -Force
}

function Install-Silently([string] $Path, [string] $Destination) {
  $process = Start-Process -FilePath $Path -ArgumentList @('/S', "/D=$Destination") -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    throw "Installer '$Path' exited with code $($process.ExitCode)."
  }
}

Write-Host "Installing previous released build $($previousInstaller.name)..."
Install-Silently $oldInstallerPath $installDirectory
$appPath = Join-Path $installDirectory 'TribeNet Manager.exe'
if (-not (Test-Path $appPath)) {
  throw "Previous release did not install the app at $appPath"
}

Write-Host "Upgrading that installation to $env:APP_VERSION..."
Install-Silently $installerPath $installDirectory
if (-not (Test-Path $appPath)) {
  throw "Upgrade removed the app executable from $installDirectory"
}
if (-not (Test-Path (Join-Path $installDirectory 'Uninstall TribeNet Manager.exe'))) {
  throw 'Upgrade did not leave a usable uninstaller in the installation directory.'
}

Write-Host "Installer upgrade regression passed: $($release.tag_name) -> $env:APP_VERSION"
