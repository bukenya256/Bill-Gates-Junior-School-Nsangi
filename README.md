# BGS School System – Bill Gates Junior School Nsangi

## What you received
- `BGS-School-System-Portable-1.0.0.exe` – a single program. Copy it to each PC and double-click (no installer).
- This source folder (for a developer; `npm install`, `npm start`, `npm test`). `.github/workflows/build.yml` builds a proper Setup installer on a free GitHub account if you want one.

## First start (once per PC)
1. **Headteacher's PC** → choose "Headteacher's PC", create the password.
2. **Teachers' PC** → choose "Teachers' PC".
3. HM: Settings & Backup shows the **address** (e.g. `192.168.1.10:4750`) and the **school key**.
4. Teachers' PC: Connection page → type your name, the address and the key → Save & connect.
   Both PCs must be on the same WiFi/cable. When Windows shows a firewall question on the HM PC, tick *Private networks* → Allow.
   (Windows may also show "Windows protected your PC" for an unsigned program: More info → Run anyway.)

## How it behaves
| Need | What the system does |
|---|---|
| Admission fee UGX 30,000 | Application saved as PENDING showing Paid / Balance. At 30,000 it flips to PAID · ACTIVE automatically. |
| Term fees | Nursery 200,000 · P1–P4 day 250,000 · P5–P7 day 300,000 · Boarding 500,000. Defined in `src/shared/rules.js`. |
| Day ↔ Boarding | Button on each student. Current-term fee and balance recalculate; earlier terms unchanged. |
| Payments | Each part payment shows Paid + Balance and makes a numbered receipt (ADM / FEE / SAL), printable, stored on the HM PC. |
| Students / workers | Never deleted – Active / Inactive buttons (reason saved). |
| Salaries | HM enters monthly salary (shown red = owed). Payments reduce the balance per month. |
| Years & terms | Header selectors; each term's fees/receipts stay in that term; unpaid balances show as "earlier terms owed". |
| Marks | Teachers' PC saves locally and sends to HM PC at once (retries if the network is down). HM view is read-only; HM can print any year/term/exam, individual or class. |
| Teachers' PC privacy | Receives only name, admission no., class. Never fees, phones, salaries. |
| Backup | Local backup every 6 h to `Documents\BGS-Backups`; every change is also queued to the cloud and retried until it succeeds. |

## Cloud (recommended: Supabase – free tier, Postgres, works well from Uganda)
Settings & Backup → "How to set up…" has the exact steps and SQL. Paste Project URL + `service_role` key, press **Test connection**.
Note: the cloud holds a complete, readable copy of every record (students, fees, salaries, marks, receipts). Restore from Supabase is now available in Settings & Backup with a preview, validation and safety backup. Test on a spare PC first.

## Known limits (v1)
- Not tested on real Windows PCs by the builder – please test both PCs on your network before real use.
- Only one HM PC is the master. Class promotion at year end is done manually (Students → Edit → Class), and fees follow the new class automatically.
- Teacher-entered marks are accepted for any term/year (no term locking).


## New in 1.1.0
See `CHANGES_2026_RECOVERY_AND_PROMOTIONS.md` for cloud restoration, class rosters, discipline records, year-end promotions and print updates.
