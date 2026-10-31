# BGS update 1.6.0

## 1. Phone numbers (Headteacher PC)
New application and Edit student now accept **exactly 10 digits** (e.g. 0772123456). The box stops at 10 digits and ignores letters; the system also refuses anything else when saving. Phone stays optional. Old records saved in another format can still be edited; the rule applies when the number is changed.

## 2. Subjects reach the Teachers' PC
Subjects added/removed under *Subjects* on the Headteacher PC were already sent, but the Teachers' PC only showed them after reopening the page. The Enter Marks and Report pages now refresh by themselves (within about 8 seconds) and show a short message.

## 3. New Year button (Headteacher PC)
* Button **New Year ▶** in the top bar, and **Start new year** in Settings & Backup.
* The system reads the current year (2026) and moves everyone to the next (2027), Term 1. Only available in Term 3 (that is when teachers record promotions).
* A summary is shown first: how many are Promoted, Repeat, and how many have no decision yet.
* Promoted learners move up one class (P7 promoted becomes inactive). **Repeat and undecided learners stay in their class.** Children admitted in 2027 appear only from 2027.
* A safety backup is made automatically before the change.
* Going back to 2026 (Academic year box) shows classes, students, fees, marks and report cards as they were.
* Teachers' PCs follow automatically: they switch to 2027 / Term 1 within seconds.
* Fix: a promotion without Term 3 End-of-Term marks used to be refused by the Headteacher PC in a way that also blocked that teacher's other marks. Now the Teachers' PC checks first, and one refused promotion can never block marks.
* Fix: learners with no promotion decision now also have their 2026 class saved, so 2026 views stay correct in later years.

## 4. Excel on the Teachers' PC
* **Student List → Download class lists (Excel)**: one workbook, one sheet per class.
* **Enter Marks → Download marks sheet**: a sheet for the chosen Year / Term / Exam / Class with every learner and every subject of that class. Marks already entered are filled in.
* **Enter Marks → Upload filled marks sheet**: choose the same Year / Term / Exam / Class, upload the sheet that came back from the class teachers. The system shows what will be saved and any problems, then saves after you confirm. Empty cells are left alone; type **A** for absent. A sheet made for another class/term/exam is refused. Manual typing of marks is unchanged.
* Uses the `exceljs` library (run `npm ci` before building).
