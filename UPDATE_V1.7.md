# BGS update 1.7.0

## 1. One computer – "failed to connect to the Headteacher's PC" is gone
Earlier versions were two programs (a Headteacher PC and a Teachers' PC) that talked over a cable using a school key. On a single computer there was nothing for the Teachers' side to connect to, so it always reported "failed to connect". 
Now there is **one program with two logins** (Headteacher / Teachers). The Teachers' screens work directly on the Headteacher's records: no network, no key, no pairing, no Windows firewall step. The server, discovery and sync code was removed.
- Existing installs (set up as "Headteacher's PC") open normally with all their data.
- Teachers see only names, admission numbers, classes and marks. Teacher actions are refused when someone is logged in as Headteacher, and the other way round.
- Wrong-password lock: 6 wrong attempts => 1 minute pause.

## 2. Year logic: only promoted / repeating learners are in the next year
See README ("Years and promotions"). Summary: when the Headteacher starts 2027, only learners that teachers marked Promoted or Repeat (which requires their Term 3 EOT marks) are in 2027. Everyone else stays in the 2026 records only and appears nowhere in 2027: students list, class lists, fee sheets, SMS recipients, mark sheets, Excel class lists, dashboard totals.
- A learner promoted P1 → P2 is in P1 when you view 2026 and in P2 when you view 2027.
- New Year dialog lists every learner who will be left out (with the reason) and requires a tick before it can proceed. If nobody has been promoted, 2027 starts empty.
- Teachers' Promotions page: the decision box is locked until the learner has Term 3 EOT marks; a decision can be undone before the new year; if the marks are later removed the decision stops counting.
- Dashboard (Term 3) shows how many are promoted / repeating / undecided.
- The Academic-year boxes no longer offer a year that has not started.
- Marks can only be saved for learners who were in the school in that year.

## 3. Website files removed
The `01-WEBSITE` folder, the web release notes and the desktop's import of web-origin payments/marks were removed. (Nothing was changed in your Supabase project.)

## 4. Tests
`npm test` runs six test files, including `test-year-logic.js` (the Bukenya scenario and the one-computer logins). Two old tests were date-dependent / timing-dependent and were fixed.

## 5. Build fix (Mac "Cannot find module 'call-bind-apply-helpers'")
The installed Mac app was missing a tiny library file that the Excel library needs, so it crashed at start-up. The build now bundles the program and the Excel library into one file (`npm run bundle` -> `src/main.bundle.js`), so the installed app needs no `node_modules` folder and this kind of missing-file crash cannot happen (Windows included). `test-bundle.js` checks this. The two GitHub workflows run the bundle step; the Windows one also retries on temporary GitHub download errors.
