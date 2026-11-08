# BGS School System – Bill Gates Junior School Nsangi

## What you received
- This source folder (for a developer: `npm ci`, `npm start`, `npm test`, `npm run dist` builds the Windows installer / portable .exe). `.github/workflows/build.yml` builds a proper Setup installer on a free GitHub account if you want one.

## One computer, two logins
The whole school runs on **one PC**. When the program opens, choose who you are:
- **Headteacher** – students, applications, fees, receipts, staff & salaries, discipline, classes, notifications, reports, settings, backups, **New Year**.
- **Teachers** – enter marks (by hand or Excel), print report cards / class results, class lists, and the **Term 3 Promotions** decisions. Teachers never see fees, phone numbers or salaries.

First time: the Headteacher creates her password; the first teacher to log in creates the Teachers' password (and types their name, which is saved with the marks they enter). The Headteacher can reset the Teachers' password in Settings & Backup. There is nothing to connect, pair or configure: both logins work on the same records, so a mark typed by a teacher is in the Headteacher's records immediately.

## Years and promotions (the strict rule)
- The Headteacher sets the year (**New Year ▶**, only available in Term 3).
- A learner is in the next year **only** if a teacher marked them **Promoted** or **Repeat Class** in Term 3, and that learner has **Term 3 End-of-Term (EOT) marks**. BOT / MID marks, or EOT of another term, do not count.
- Promoted → next class. Repeat → same class. P7 promoted → leaves the school.
- Everyone else (no decision) is **not carried into the new year**: they do not appear in 2027 students, classes, fee sheets, SMS lists or mark sheets. They stay in the 2026 records exactly as they were and are marked "Not carried into 2027". The Headteacher sees their names before confirming.
- Children admitted in 2027 join 2027 when they pay the admission fee.
- Any past year can be viewed from the Academic year box, exactly as it was.
- A child left out by mistake: the Headteacher can press **Make active** on that child (Students → Inactive); they are placed back in their old class for the current year. This is a deliberate, logged action.

## How it behaves
| Need | What the system does |
|---|---|
| Admission fee UGX 30,000 | Application saved as PENDING showing Paid / Balance. At 30,000 it flips to PAID · ACTIVE automatically. |
| Term fees | Nursery 200,000 · P1–P4 day 250,000 · P5–P7 day 300,000 · Boarding 500,000. Defined in `src/shared/rules.js`. |
| Day ↔ Boarding | Button on each student. Current-term fee and balance recalculate; earlier terms unchanged. |
| Payments | Each part payment shows Paid + Balance and makes a numbered receipt (ADM / FEE / SAL), printable. |
| Students / workers | Never deleted – Active / Inactive buttons (reason saved). |
| Salaries | HM enters monthly salary (shown red = owed). Payments reduce the balance per month. |
| Marks | Teachers type marks or upload a filled Excel sheet; saved immediately. The Headteacher's report view is read-only for marks. |
| SMS to parents | Headteacher only. Settings & Backup -> SMS (Africa's Talking key), then Notifications -> Send SMS. Only learners in the current year are listed. |
| Backup | Local backup every 30 s when something changed (kept in `Documents\BGS-Backups`); every change is also queued to the cloud and retried until it succeeds. A safety backup is made before New Year. |

## Cloud (recommended: Supabase – free tier, Postgres, works well from Uganda)
Settings & Backup → "How to set up…" has the exact steps and SQL. Paste Project URL + `service_role` key, press **Test connection**.
Note: the cloud holds a complete, readable copy of every record (students, fees, salaries, marks, receipts). Restore from Supabase is now available in Settings & Backup with a preview, validation and safety backup. Test on a spare PC first.

## Known limits
- Only one PC holds the records. Keep the cloud backup / `BGS-Backups` copies.
- Starting a new year cannot be undone from inside the program (restore the automatic safety backup if needed).
- Teacher-entered marks are accepted for any term of the current or an earlier year (no term locking).

## New in 1.7.0
See `UPDATE_V1.7.md`: one-computer design (no more "failed to connect"), strict year/promotion logic, website files removed.
Earlier notes: `UPDATE_V1.6.md`, `UPDATE_V1.5.md` (two-computer pairing – no longer used), `CHANGES_2026_RECOVERY_AND_PROMOTIONS.md`.
