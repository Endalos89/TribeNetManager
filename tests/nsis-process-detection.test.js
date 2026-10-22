const assert = require('assert');
const fs = require('fs');

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

console.log(`NSIS process detection is exact in electron-builder ${appBuilderVersion}.`);
