# TribeNet Manager

A local Windows desktop application for TribeNet. The first module is an interactive mapper.

## Current mapper features

- Launcher with room for future TribeNet modules.
- World overview covering **A–P columns × A–Z rows** (416 submaps).
- Each submap is **30 across × 21 down**.
- TribeNet coordinates such as `PK1614`, `OM0703`, and `OM3004`.
- Detailed map is a continuous panning canvas: opening one submap also allows movement into neighbouring submaps without rendering the whole world at once.
- Every untouched hex starts as **Fog of War**.
- Mapped hexes can be set to a Mandate terrain code or **Unknown**.
- Notes per hex.
- Local SQLite database kept outside the install directory.
- Manual database backup button.
- Schema migrations automatically back up the database before a future schema change.
- In-app update button. Installed builds check GitHub Releases and download the newest release.

## Data location

The SQLite database is stored under Electron's Windows user-data directory, typically similar to:

`%APPDATA%\TribeNet Manager\data\tribenet.sqlite`

It is deliberately separate from the installed program so application updates do not replace map data.

## One-time development setup

1. Install Node.js 22 or newer.
2. In the project folder run `npm install`.
3. Run `npm start`.

## Automated updates / releases

The project expects the GitHub repository:

`Endalos89/TribeNetManager`

The included GitHub Actions workflow builds an unsigned x64 Windows installer after every push to `main`, assigns an increasing version, and publishes it to GitHub Releases. Once an installed release exists, the application's **Check for Updates** button can download the latest release; **Restart & Update** installs it.

For this workflow to remain completely free and for installed clients to fetch update files without storing a GitHub token, the simplest setup is for the repository to be **public**. A private source repository would need a different public release/update channel or authentication.

## Terrain list in v0.1

Unknown, ALPS, AR, BH, BR, CH, DE, D, DH, GH, GHP, HSM, JG, JH, L, LAM, LCM, LJM, LSM, LVM, O, PP, PGH, PI, PR, PPR, RH, SH, SW, TU.

Rivers, fords and passes are intentionally deferred until their visual/hex-side representation is established.
