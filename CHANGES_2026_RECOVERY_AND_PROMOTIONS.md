# BGS 2026 — Cloud recovery, classes, discipline and promotion

## Recovery
Headteacher PC → Settings & Backup → enter saved Supabase URL + server-only key → **Restore from Supabase**. Preview record counts; type `RESTORE SCHOOL` to confirm. Local safety backup is created before the replacement. Do NOT click Send everything now on a blank installation. Reconnect Teachers' PC only after recovery is checked. The Headteacher password is intentionally NOT stored in Supabase; use the replacement PC password during restoration.

**Important:** Recovery and cloud sync need end-to-end testing on a spare Windows computer with synthetic records before production. Supabase Free does not itself guarantee point-in-time backups. Keep independent encrypted backups.

## School changes
- Classes: Headteacher has clickable class overview and class roster filtered by academic year.
- Discipline: dated suspension/expulsion records, suspension end date, official printable notice and permanent history; expulsion makes student inactive.
- Term 3 promotion: on Teachers' PC, End-of-Term marks must be present before choosing Promoted or Repeat Class. The decision is queued locally and forwarded to Headteacher; at next year's Term 1 a promoted student advances one class, a repeat stays. P7 graduates inactive. Undecided students stay in their class for Headteacher review.
- Professional print: compact 105 mm receipt within A4 paper and cleaned school-only branding on receipts and report cards.

## Cautions
1. Do not switch current school term backwards; historical records are viewed through academic-year/term selectors.
2. The `service_role` key must not be placed in GitHub, screenshots or on Teachers' PCs.
3. Restore uses paginated Supabase rows and validates keys and student/payment records, but a full realistic disaster recovery drill is still required.
4. Teacher LAN communication remains HTTP on a trusted private network; do not expose its port to the internet.
5. Unsigned Windows builds are for controlled testing, not production rollout.
