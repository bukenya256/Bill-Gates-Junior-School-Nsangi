# BGS Test 2 — Mojave + Headteacher/Teachers Synchronization

This source release builds an Intel macOS Mojave DMG through `.github/workflows/build-mac-mojave.yml` using Electron 26.6.10. The Windows GitHub Actions workflow remains separate with Electron 33.

## Changes
- Teacher client synchronizes approximately every 2 seconds while running and connected (previously 8 seconds). The Headteacher PC remains the LAN server; teachers store local marks and retry pending changes.
- Incoming student lists, subjects, grading scales and current academic year/term update the local teacher database automatically.
- Teachers' Enter Marks view refreshes when academic settings or student lists change, so updated subject choices and grade displays become visible. Refresh is deferred while a mark input has focus to avoid interrupting typing.
- Report Cards & Class Results refreshes when academic settings, marks, comments or promotion records change.
- Redundant UI notifications on unchanged sync polls are avoided.
- Network tests now verify that changed Headteacher subjects and grade boundaries reach an already-paired teacher client.

## Build and install
1. Upload the contents of this source folder, including `.github/workflows/build-mac-mojave.yml` and `electron-builder-mojave.json`, to the repository root.
2. GitHub Actions > Build BGS macOS Mojave DMG > Run workflow on main.
3. Download the BGS-Mojave-Intel-DMG artifact if the job succeeds.
4. On Mojave, open the DMG, drag the application to Applications, then choose Teachers' PC on the first-run setup.
5. Pair to the Headteacher PC once, keep the Windows Headteacher application running, and connect both over direct Ethernet or a trusted LAN. The saved pairing and automatic reconnection are preserved.

## Testing
`npm test` passed: core, network, recovery, and SMS tests. Tests are simulated LAN tests, NOT physical Windows-to-Mojave connectivity verification. The DMG has NOT been compiled here or opened on macOS Mojave.

## Security and operational notes
Electron 26 is no longer security-supported and should only be used for a constrained legacy Mojave installation. School systems should use a supported macOS version for production. The LAN currently uses HTTP with a shared school key; restrict the network to trusted devices and keep payment and student data on the HM PC. The teacher receives only the authorized student/academic subset.

## Important
Changes are received on the next successful sync, normally within a few seconds, not by an always-open real-time push channel. If offline, updates are received on reconnection. An updated subject list does not automatically migrate marks entered under a removed subject; old marks remain in historical records and should be reviewed before changing curriculum settings.
