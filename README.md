# BGS School System — Windows Single-Computer Edition

Desktop school-management software for Bill Gates Junior School Nsangi, packaged for Windows only.

## How it works

- The application runs on **one Windows computer** and stores school records locally.
- Every time the application opens, the user chooses **Log in as Headteacher** or **Log in as Teacher**.
- Headteacher and Teacher accounts use separate passwords. Passwords are stored as salted password hashes, not plain text.
- Both roles have a **Log out** option that returns to the role chooser.
- Teachers enter marks in the Teacher workspace. Marks are synchronized to the local school database so the Headteacher can review them after logging in on the same computer.
- The school logo is used in the application and Windows installer/desktop shortcut icon.
- Data and backups are stored outside the installation folder so normal app updates do not overwrite school records.

## First launch

1. Install or run the Windows executable.
2. Choose **Log in as Headteacher** and create the Headteacher password when prompted.
3. Log out, choose **Log in as Teacher**, and create the separate Teacher password.
4. Use Log out whenever the other role needs to use the same computer.
5. Make regular backups from the Headteacher's **Settings & Backup** area.

Keep both passwords private. Anyone with access to the Windows account and the computer's local data may still be able to access files outside the app; use a secured Windows user account and regular backups.

## Build on GitHub

The GitHub Actions workflow at `.github/workflows/build.yml` runs the test suite on a Windows runner and builds two x64 executables:

- `BGS-School-System-Setup-<version>.exe` — installable setup with a desktop shortcut.
- `BGS-School-System-Portable-<version>.exe` — portable executable.

To build locally on Windows with Node.js 20 installed:

```powershell
npm ci
npm test
npm run dist
```

Build outputs are written to `dist/`. On GitHub, open the repository's **Actions** tab, select a successful workflow run, and download the `BGS-Windows-EXE-Installer-and-Portable` artifact.

## Notes

- This edition is Windows-only. macOS build targets and the separate website source have been removed.
- School data is stored under Electron's per-user application data directory, not inside the app installation folder.
