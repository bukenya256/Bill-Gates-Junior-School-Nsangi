# BGS v1.3 — Change notes

- Uses the supplied icon images for Headteacher and Teachers navigation, and the school icon for login and branding.
- Compact printed receipts no longer display signature fields.
- Discipline records now use a student search-and-select control; cancellation reverses a case without deleting its history. Reversing an expulsion reactivates the student only if the student is still inactive due to that exact expulsion. Suspensions remain recorded even when cancelled.
- Local primary JSON records are still saved immediately on each completed entry. Every 30 seconds the Headteacher computer checks for changes and writes a separate dated backup only when the data differs. The existing backup retention is 40 files.
- Supabase uploads start shortly after changes and retry at most about every 15 seconds while configured and running. They require internet and a reachable service; manual Send Everything Now remains available. The system does not guarantee uploads while the PC is switched off, and network restoration is detected by retry rather than OS connectivity events.
- The current Supabase `records` schema is unchanged, so existing cloud records and restore logic remain compatible.

Before installing a rebuilt EXE, keep a separate copy of the existing school data and test on fictional records. The icon source images supplied by the user are included in `src/assets`.
