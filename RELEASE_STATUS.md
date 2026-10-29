# BGS system — engineering status (29 October 2026)

This source release is NOT certified for use with live school fees or student records.

## Implemented here
- Web Headteacher read-only register, staff, disciplinary, and promotion views (in addition to the prior fee recording and marks-entry views).
- Additional role-gated `bgs_management_snapshot` function for these views.
- Desktop pull protection: pending locally edited marks are not silently overwritten by downloaded marks.
- Network integration test mock now responds to GET polling requests; the desktop test suite passes.

## Cannot honestly claim complete
- Full Headteacher desktop functionality on web (admissions, salaries, report cards, fees amendments, year/term rollover, discipline editing, messaging, SMS, printing) is NOT implemented.
- Teachers have no enforced per-class/subject allocation. Authenticated teachers can currently view all students and marks. Do NOT deploy to production.
- Existing Supabase `records` grants / RLS policies and desktop key permissions have NOT been audited against the live database. Applying restrictive RLS without migrating desktop credentials would break sync.
- Upload still does unconditional upserts and could overwrite newer cloud changes following an offline desktop edit. No end-to-end merge or transaction ledger is implemented.
- Financial double-entry and concurrent web/desktop fee recordings are not reconciled, and live data integrity tests were not run.
- Website production build was not verified; Vite dependency installation timed out in this environment.
- No Windows EXE / Intel macOS DMG binary was built in this environment. The project provides GitHub Actions builders.

## Deployment warning
Never copy Supabase service_role, secret, or database passwords into the browser or a publicly distributed desktop binary. Do not expose the desktop `records` API to anonymous users. Upgrade the desktop integration to a narrowly scoped authenticated backend/Edge Function with idempotent mutation IDs and explicit conflict acknowledgements before enforcing tightened records policies.

## Setup
Website variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (public publishable key only). Run reviewed SQL in `web/supabase/schema.sql` on a staging copy first. Do not blindly apply to production. Build website using `cd web && npm install && npm run build` on a machine with npm registry access. Upload contents of `web/dist` to InfinityFree `htdocs` after successful build and validation. To compile desktop binaries, use `.github/workflows` in GitHub Actions.
