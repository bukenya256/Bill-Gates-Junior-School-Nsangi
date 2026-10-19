# BGS visual refresh and cloud organization

## What changed
- Increased application font sizes, control heights, table spacing, and page-title hierarchy.
- Consistent navy, warm orange, and white administration styling.
- Compact receipt refinements, including an orange school header and clearer payment amount.
- Updated the printed academic report header and chart accents.
- Added `SUPABASE_ORGANIZED_VIEWS.sql`: optional separate read-only Supabase views grouped by school data category.

## Cloud data organization (safe, no migration)
1. Keep the existing `public.records` table intact: it remains the only automatic upload/restore source.
2. In your dedicated BGS Supabase project open **SQL Editor**, paste `SUPABASE_ORGANIZED_VIEWS.sql`, and run it once.
3. In Table Editor, find the `bgs_students`, `bgs_fee_payments`, `bgs_marks`, `bgs_discipline`, etc., views for organized browsing. Views show the same underlying records; they are **not additional backups**.
4. Do not delete the original table. Do not give users direct access to views without reviewing underlying RLS policies.
5. Only the trusted HM backend should hold the service_role key. Don't commit keys or school data to GitHub.

## Validation before school use
- `npm test` passed in this environment (core, network, cloud-recovery/promotion/discipline simulations).
- Electron compilation, live two-PC operation, cloud restore, and physical print layouts **have not** been tested here.
- Back up the HM computer before updating. Run the new build with fictional data first.
- The app currently stores cloud records as JSONB. The views group them but do not re-model them into relational school tables.
- Cloud synchronization is a replication mechanism, not a versioned, independent disaster-recovery backup; maintain offline copies and test restoration.
