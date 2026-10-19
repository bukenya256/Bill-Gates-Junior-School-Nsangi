# BGS School System — Intel Mac / macOS Mojave build

This is a source-code package for GitHub Actions; it is **not** an already compiled DMG.

## On the GitHub website

1. Upload/replace all contents of this ZIP in the repository root (not as a nested folder).
2. In `.github/workflows`, create or replace `build-mac-mojave.yml` with the file included here. Finder may hide `.github`; use GitHub's **Add file → Create new file** if necessary.
3. If the repository still has an older broken `build-mojave.yml`, delete that obsolete workflow file from GitHub's Code page to avoid duplicate Mac workflows.
4. Open **Actions → Build BGS macOS Mojave DMG → Run workflow** on `main`.
5. After the run succeeds, download the `BGS-Mojave-Intel-DMG` artifact ZIP. Inside will be a `.dmg` installer.

## Fixes

- Uses the dedicated `electron-builder-mojave.json`, not a command-line `-c.files` override that previously excluded `src/main.js`.
- Explicitly includes the complete `src` tree and verifies `src/main.js` exists inside `app.asar`.
- Keeps Mac build output in `dist-mojave` and excludes Windows `dist` output from the application.
- Installs Electron 26.6.10 only during the Mac Actions build. The Windows package-lock and Windows build stay unchanged.

## Compatibility caveats

Electron 26 is the last Electron major supporting macOS 10.14. It is no longer security-supported; use this only on a trusted machine/network and test on the actual Mojave Intel Mac before using real school data. Unsigned/not-notarized DMGs may require Finder Control-click → Open. This workflow has **not** been run here on GitHub; first compilation and actual Mojave operation must still be verified.

Never commit private Supabase service-role keys, local databases, or backups to the repository.
