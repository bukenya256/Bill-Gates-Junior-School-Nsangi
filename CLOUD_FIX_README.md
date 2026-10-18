# BGS cloud synchronization hotfix

## Fixed
- Removes duplicate `records.key` values within each Supabase upsert batch, preventing PostgreSQL `ON CONFLICT DO UPDATE command cannot affect row a second time`.
- Tracks each local dirty-record revision so a change made during an upload stays queued and is not accidentally acknowledged.
- Regression-tested duplicate audit/meta keys against a mock API rejecting duplicate keys.

## Updating the Windows application
This is **source code**, not a patched Windows executable. Your existing `BGS-School-System-Portable-1.0.0.exe` remains unchanged until rebuilt.

1. Back up `Documents\\BGS-Backups` and the application's normal data directory on the Headteacher's computer before updating. Do not clear the cloud queue or reinstall with data removal.
2. Unzip this source code into your private GitHub BGS repository, preserving `.github/workflows/build.yml`.
3. Go to GitHub -> Actions -> Build Windows installer -> Run workflow (or push to `main`).
4. Download the `BGS-School-System` workflow artifact; extract the new portable EXE and/or Setup EXE.
5. Close the old app, launch the rebuilt EXE on Headteacher's PC, then Settings & Backup -> Test connection -> Send everything now.
6. Check Supabase Table Editor -> records and verify sample student, receipt and mark rows. Confirm `pending` reaches zero.

Alternatively, on a Windows machine with Node.js 20 and npm installed: `npm ci`, `npm test`, `npm run dist`; collect the EXEs from `dist`.

The Supabase service_role key must remain ONLY on the trusted Headteacher PC; never commit credentials or school records to GitHub.
