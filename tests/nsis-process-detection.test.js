const assert = require('assert');
const fs = require('fs');
const path = require('path');

const appBuilderVersion = require('electron-builder/package.json').version;
const packageBuilderVersion = require('../package.json').devDependencies['electron-builder'];
assert.strictEqual(appBuilderVersion, packageBuilderVersion, 'The installed electron-builder version must match the release build dependency.');

const nsisProcessCheckPath = require.resolve('app-builder-lib/templates/nsis/include/allowOnlyOneInstallerInstance.nsh');
const nsisProcessCheck = fs.readFileSync(nsisProcessCheckPath, 'utf8');
const customProcessCheck = fs.readFileSync(require.resolve('../build/installer.nsh'), 'utf8');

assert(customProcessCheck.includes('!macro customCheckAppRunning'), 'The installer must use its app-specific process check.');
assert(customProcessCheck.includes('findstr.exe'), 'The app-specific process check must use exact image-name matching.');
assert(customProcessCheck.includes('/B /I /C:'), 'The app-specific process check must anchor process-name matches.');
assert(!customProcessCheck.includes('StartsWith('), 'The app-specific check must not flag arbitrary processes launched from the installation directory.');

assert(!nsisProcessCheck.includes('find.exe'), 'NSIS process detection must not use substring matching via find.exe.');
assert(!nsisProcessCheck.includes('${nsProcess::FindProcess}'), 'NSIS process detection must not invoke prefix matching via nsProcess::FindProcess.');
assert(nsisProcessCheck.includes('findstr.exe'), 'The non-PowerShell fallback must use exact process-name matching.');
assert(nsisProcessCheck.includes('/B /I /C:'), 'The process-name match must be anchored to the start of the CSV row.');
assert(nsisProcessCheck.includes('Get-CimInstance -ClassName Win32_Process'), 'PowerShell process checks should inspect executable paths.');

const cleanupMacro = customProcessCheck.match(/!macro customRemoveFiles([\s\S]*?)!macroend/);
assert(cleanupMacro, 'The updater must provide its own previous-installation cleanup macro.');
const cleanup = cleanupMacro[1];
const removeIndex = cleanup.indexOf('Call un.atomicRMDir');
const restoreIndex = cleanup.indexOf('Call un.restoreFiles');
const retryIndex = cleanup.indexOf('Goto TribeNetRetryRemoveFiles');
assert(removeIndex >= 0, 'The update cleanup must use electron-builder’s atomic directory removal.');
assert(restoreIndex > removeIndex, 'A failed cleanup attempt must restore moved files.');
assert(retryIndex > restoreIndex, 'A retry must happen only after restoring the installation.');
assert(cleanup.includes('$R4 < 6'), 'The update cleanup must retry several times before aborting.');
assert(cleanup.includes('Sleep 1000'), 'The update cleanup must allow transient file locks time to clear between attempts.');

const releaseWorkflow = fs.readFileSync(path.join(__dirname, '..', '.github/workflows/release.yml'), 'utf8');
const upgradeTest = fs.readFileSync(path.join(__dirname, 'windows-installer-upgrade.ps1'), 'utf8');
assert(releaseWorkflow.includes('npm run dist -- --publish always'), 'The release workflow must use the configured build publisher after the upgrade test passes.');
assert(!releaseWorkflow.includes('electron-builder publish --files'), 'The release workflow must not use the unsupported separate publish subcommand.');
const tagIndex = releaseWorkflow.indexOf('git push origin $tag');
const publishIndex = releaseWorkflow.indexOf('npm run dist -- --publish always');
assert(tagIndex >= 0 && publishIndex > tagIndex, 'The tested version tag must exist before electron-builder publishes a stable release.');
assert(upgradeTest.includes('TribeNet Manager Setup $env:APP_VERSION.exe'), 'The upgrade regression must target the built installer filename.');
assert(upgradeTest.includes('^TribeNet(?:-Manager-Setup-| Manager Setup ).+\\.exe$'), 'The upgrade regression must locate both legacy and current release installer names.');
assert(upgradeTest.includes('/releases?per_page=100'), 'The upgrade regression must search past incomplete releases that contain no setup executable.');

console.log(`NSIS process detection and update cleanup retries are configured for electron-builder ${appBuilderVersion}.`);
