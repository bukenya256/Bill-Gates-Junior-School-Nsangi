# Automatic BGS website / desktop synchronization (pilot)

The website saves directly into the same Supabase `public.records` table through authenticated RPC functions whenever the user presses **Save payment** or **Save** beside a mark. No separate Sync, Upload, Import or Download action is required. A positive on-screen save confirmation only appears after Supabase acknowledges the transaction. Internet connectivity is required for these website saves; they are not queued offline.

The Windows Headteacher desktop application automatically polls web-origin payments and marks at startup and approximately every 8 seconds while open and online. It imports new web payments only when the student exists locally, and uses deterministic keys to avoid importing the same payment twice. For marks, the edit with the later `at` timestamp wins in this pilot; any later local edit is uploaded by the existing dirty-record sync. The local application persists imported records to its normal data store. The Mac teacher desktop continues to synchronize through the Windows Headteacher server over LAN; the cloud sync is not installed on the teacher Mac.

## Important boundaries before production

* This is a **pilot**, not a verified production release. Supabase RLS and desktop API credentials must be reviewed. The desktop currently uses a configured key for records access. NEVER put a service-role secret into a public website.
* Repeated website writes to the same mark can race with local edits; timestamp ordering is not a rigorous conflict-resolution strategy. Clock skew and simultaneous conflicting edits need a revision-based protocol. A complete operational-grade implementation would use server-generated monotonic revisions / per-record change feed and transaction-safe synchronization.
* Payment balance validation uses the current cloud bills. If the Windows PC was offline and changed fee bills or accepted payments locally, cloud may be stale. The existing database functions cannot enforce a global balance under that partition. Reconciliation and a school-approved exception policy are required before live financial use.
* Sync depends on an operational server, Internet access, intact Supabase records, and the Windows app running. While the PC is off it cannot download anything. After reboot and successful login, it will retry automatically.
* There is no manual import action in the day-to-day web workflow. Manual disaster recovery controls in Settings are intentionally separate and should not be used for ordinary reconnection.

## Pilot validation

1. In a test Supabase project, seed a non-sensitive test student, fee bill, year/term and academic subjects; configure the Windows desktop project connection.
2. Turn Windows desktop off, open web portal on mobile data, submit a test fee and one test mark; verify the RPC acknowledges them.
3. Start desktop with Internet and confirm both appear in student payments / reports without using Restore or Import. Restart the desktop and verify no duplicates.
4. Disconnect and reconnect Internet and test a mark update; test two teachers changing the same mark and flag any unexpected overwrites.
5. Verify the teacher Mac gets marks after the Headteacher server is online and its Ethernet link is connected.

## Publishing

Run `web/supabase/schema.sql` after reviewing its security implications. Host `web` on Vercel with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; never use the service-role key in Vite. Provision school roles through `bgs_portal_users` using an administrator account.
