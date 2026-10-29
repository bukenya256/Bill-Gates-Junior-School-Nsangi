# BGS secure cloud migration — implementation and deployment status

## Implemented in desktop source

- Desktop cloud API requests now use a Supabase **user access token**, not the API key as a Bearer token.
- Headteacher signs in from Settings using a Supabase Auth email and password. The server checks `bgs_my_profile` for the active `headteacher` role before accepting the session.
- Refresh-token renewal is automatic when connected, with credentials stored through the existing encrypted config handler.
- Existing non-publishable keys must be replaced; service-role/secret keys are no longer accepted for new desktop settings.
- Logout clears the saved cloud session. Desktop offline-only login remains separate, so local data protection must be audited independently.

## Deployment order

1. Back up the BGS Postgres database and local Headteacher data; create a staging clone.
2. Run `web/supabase/SECURITY_AUDIT_READONLY.sql` in **staging**. Review every RLS policy, exposed view, function grant, and privileged key.
3. Confirm the project is BGS (not Universal Mgt or another shared project). Apply the original `web/supabase/schema.sql` in staging if needed; audit its SECURITY DEFINER functions and tighten teacher class/subject authorization.
4. Create the Headteacher Supabase Auth user and add an **active** row for their UUID in `bgs_portal_users` with role `headteacher`; create teacher users as needed.
5. Review any existing `records` policies. `BGS_RLS_STAGE_ONLY.sql` deliberately refuses to replace unknown policies and will abort. Explicitly remove reviewed legacy policies before staging RLS.
6. Test website login, HM login, web fee write, desktop download, desktop offline-then-online upload, Teacher access denial to fees, Teacher assigned-subject limits, and Director read-only access where applicable.
7. Only after all tests pass, deploy reviewed migration to BGS production and rebuild installers. Rotate any service-role key that has ever been embedded in or copied into a desktop app.

## Remaining production blockers

- `schema.sql` includes elevated SECURITY DEFINER RPCs and currently does not fully restrict Teacher mark entry to assigned classes and subjects; this must be corrected before internet-facing school use.
- The web portal does not contain every desktop feature.
- The desktop sync still uses last-write-wins upserts; versioned conflict reconciliation and immutable payment event handling are not finished.
- Real Supabase integration and physical Windows/Mac network tests have not been performed.
- The existing config encryption and local authentication must be evaluated for at-rest protections and staff revocation.

No live Supabase project was modified.
