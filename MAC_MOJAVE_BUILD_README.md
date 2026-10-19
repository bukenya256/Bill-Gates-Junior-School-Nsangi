# BGS School System — macOS Mojave (Intel) build

This source ZIP includes the original Windows workflow and a **separate** Mac build:
`.github/workflows/build-mojave.yml`.

## Build without using Terminal on your Mac

1. Extract this ZIP and upload the contents to the root of your BGS GitHub repository. Ensure GitHub shows `.github/workflows/build-mojave.yml` and `electron-builder-mojave.json`.
2. In **Actions**, choose **Build BGS macOS Mojave DMG**, then **Run workflow** for `main`.
3. When successful, download **BGS-Mojave-Intel-DMG** under the run's Artifacts.
4. Unzip the artifact, open the `.dmg`, and drag **BGS School System** to Applications.
5. For an unsigned app on Mojave, use Finder **Control-click → Open** and accept the warning if you trust the build. Do not disable Gatekeeper system-wide.

## Compatibility and safety

- The normal app uses Electron **33.2.1**, which does **not** support Mojave. This workflow changes Electron to **26.6.10 only on the temporary Mac build machine**, leaving the Windows lockfile and workflow unchanged.
- Electron 26 is obsolete and no longer receives modern security fixes. Use only on a trusted computer and private school network; prefer a supported macOS for production and protect Supabase credentials.
- The DMG is **unsigned and unnotarized**. This is for testing, not an Apple-certified installer.
- The macOS UI and data layer are untested on real Mojave hardware. A successful build does not guarantee Mojave runtime compatibility; test first with fictional data.
- The Mac application uses its own local `userData` folder. It does not automatically read or copy a Windows school's local database. Set up the role and connection explicitly, and don't replace your working Headteacher PC database.
- Do not commit database files, Supabase service-role keys, backups, or `.env` secrets.
