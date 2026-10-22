$ErrorActionPreference = 'Stop'

if (-not $env:APP_VERSION) {
  throw 'APP_VERSION must be set to the version of the installer being tested.'
}
if (-not $env:APP_TEST_VERSION) {
  throw 'APP_TEST_VERSION must be set to the next version used for repeated-update testing.'
}

$stagedRelease = Join-Path $env:RUNNER_TEMP "TribeNetManager-release-$env:APP_VERSION"
$firstInstallerPath = Join-Path $stagedRelease "TribeNet Manager Setup $env:APP_VERSION.exe"
$secondInstallerPath = Join-Path $PWD "release/TribeNet Manager Setup $env:APP_TEST_VERSION.exe"
foreach ($installerPath in @($firstInstallerPath, $secondInstallerPath)) {
  if (-not (Test-Path $installerPath)) {
    throw "Built installer not found: $installerPath"
  }
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

function Install-ThroughUpdater([string] $Path, [string] $Destination) {
  # Match electron-updater's NsisUpdater.doInstall arguments. --updated selects
  # electron-builder's in-place update/uninstall path; --force-run mirrors
  # quitAndInstall(true, true), which starts the app when installation ends.
  $process = Start-Process -FilePath $Path -ArgumentList @('--updated', '/S', '--force-run', "/D=$Destination") -Wait -PassThru
  if ($process.ExitCode -ne 0) {
    throw "Updater installer '$Path' exited with code $($process.ExitCode)."
  }
}

function Wait-ForInstalledApp([string] $AppPath) {
  $deadline = (Get-Date).AddSeconds(30)
  do {
    $app = Get-CimInstance Win32_Process -Filter "Name='TribeNet Manager.exe'" |
      Where-Object { $_.ExecutablePath -eq $AppPath } |
      Select-Object -First 1
    if ($app) { return $app }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  throw "Updater did not launch the installed app at $AppPath"
}

function Close-InstalledApp([string] $AppPath) {
  $app = Get-CimInstance Win32_Process -Filter "Name='TribeNet Manager.exe'" |
    Where-Object { $_.ExecutablePath -eq $AppPath } |
    Select-Object -First 1
  if (-not $app) { return }

  $process = Get-Process -Id $app.ProcessId
  if ($process.MainWindowHandle -ne 0) {
    [void] $process.CloseMainWindow()
    if ($process.WaitForExit(15000)) { return }
  }

  # Ensure no app process can keep files open when the following update begins.
  Stop-Process -Id $app.ProcessId -Force -ErrorAction SilentlyContinue
  $process.WaitForExit(10000)
  $stillRunning = Get-CimInstance Win32_Process -Filter "Name='TribeNet Manager.exe'" |
    Where-Object { $_.ExecutablePath -eq $AppPath }
  if ($stillRunning) { throw "Could not stop installed app process $($app.ProcessId) before the next update." }
}

Write-Host "Installing previous released build $($previousInstaller.name)..."
$oldInstallProcess = Start-Process -FilePath $oldInstallerPath -ArgumentList @('/S', "/D=$installDirectory") -Wait -PassThru
if ($oldInstallProcess.ExitCode -ne 0) {
  throw "Previous installer '$oldInstallerPath' exited with code $($oldInstallProcess.ExitCode)."
}
$appPath = Join-Path $installDirectory 'TribeNet Manager.exe'
if (-not (Test-Path $appPath)) {
  throw "Previous release did not install the app at $appPath"
}

Write-Host "Applying first updater-style install to $env:APP_VERSION..."
Install-ThroughUpdater $firstInstallerPath $installDirectory
Wait-ForInstalledApp $appPath | Out-Null
Close-InstalledApp $appPath

Write-Host "Applying next-version updater-style install to $env:APP_TEST_VERSION in the same Windows session..."
Install-ThroughUpdater $secondInstallerPath $installDirectory
Wait-ForInstalledApp $appPath | Out-Null
Close-InstalledApp $appPath

if (-not (Test-Path $appPath)) {
  throw "Repeated updates removed the app executable from $installDirectory"
}
if (-not (Test-Path (Join-Path $installDirectory 'Uninstall TribeNet Manager.exe'))) {
  throw 'Repeated updates did not leave a usable uninstaller in the installation directory.'
}

Write-Host "Repeated updater regression passed: $($release.tag_name) -> $env:APP_VERSION -> $env:APP_TEST_VERSION, without rebooting."
