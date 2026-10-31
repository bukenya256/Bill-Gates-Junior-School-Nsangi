'use strict';
// Excel (.xlsx) files for the Teachers' PC:
//   1. class lists (one sheet per class)
//   2. a marks sheet for one class / year / term / exam that class teachers fill in
//   3. reading that sheet back so the marks enter the system by themselves
const ExcelJS = require('exceljs');
const R = require('../shared/rules');

const NAVY = 'FF0F2747', ORANGE = 'FFE77722', LIGHT = 'FFEAF0F8', ENTRY = 'FFFFF8DC';
const MAX_ROWS = 3000, MAX_BYTES = 10 * 1024 * 1024;
const norm = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().toLowerCase();
const normId = v => String(v == null ? '' : v).trim().toUpperCase().replace(/[\s\-_\\]+/g, '/');
const safeSheetName = (n, used) => {
  let b = String(n).replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || 'Sheet', x = b, i = 2;
  while (used.has(x.toLowerCase())) x = b.slice(0, 25) + ' ' + i++;
  used.add(x.toLowerCase()); return x;
};
const fileSafe = s => String(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');

// What the cell holds, whatever Excel wrapped it in (formula results, rich text, hyperlinks, dates).
function cellValue(c) {
  let v = c && c.value;
  if (v == null) return null;
  if (typeof v === 'object') {
    if (v instanceof Date) return v;
    if ('result' in v) v = v.result;
    else if (Array.isArray(v.richText)) v = v.richText.map(t => t.text).join('');
    else if ('text' in v) v = v.text;
    else if ('error' in v) return { error: v.error };
    else return null;
  }
  return v;
}

function titleBlock(ws, cols, subtitle) {
  ws.mergeCells(1, 1, 1, cols); ws.getCell(1, 1).value = R.SCHOOL.name.toUpperCase();
  ws.getCell(1, 1).font = { bold: true, size: 15, color: { argb: NAVY } }; ws.getCell(1, 1).alignment = { horizontal: 'center' };
  ws.mergeCells(2, 1, 2, cols); ws.getCell(2, 1).value = subtitle;
  ws.getCell(2, 1).font = { bold: true, size: 11, color: { argb: ORANGE } }; ws.getCell(2, 1).alignment = { horizontal: 'center' };
}
function headerRow(ws, rowNo, labels) {
  const r = ws.getRow(rowNo); labels.forEach((l, i) => { const c = r.getCell(i + 1); c.value = l; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; c.alignment = { horizontal: i < 4 ? 'left' : 'center', vertical: 'middle', wrapText: true }; c.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }; });
  r.height = 22;
}
const thin = { top: { style: 'thin', color: { argb: 'FFB9C5D6' } }, bottom: { style: 'thin', color: { argb: 'FFB9C5D6' } }, left: { style: 'thin', color: { argb: 'FFB9C5D6' } }, right: { style: 'thin', color: { argb: 'FFB9C5D6' } } };

async function toBuffer(wb) { return Buffer.from(await wb.xlsx.writeBuffer()); }
function newBook() { const wb = new ExcelJS.Workbook(); wb.creator = R.SCHOOL.name; wb.created = new Date(); return wb; }

// ---------------------------------------------------------------- class lists
// students: [{id, first, last, className, status}]
async function classListsWorkbook(students, year) {
  const wb = newBook(), used = new Set();
  const byClass = new Map(R.CLASSES.map(c => [c, []]));
  for (const s of students) if (s.status === 'active' && byClass.has(s.className)) byClass.get(s.className).push(s);
  const sum = wb.addWorksheet(safeSheetName('All classes', used));
  titleBlock(sum, 3, `CLASS LISTS ${year}`);
  headerRow(sum, 4, ['Class', 'Number of learners', 'Sheet']);
  let r = 5, total = 0;
  for (const c of R.CLASSES) { const n = byClass.get(c).length; total += n; sum.getRow(r).values = [c, n, c]; for (let i = 1; i <= 3; i++) sum.getCell(r, i).border = thin; r++; }
  sum.getRow(r).values = ['TOTAL', total]; sum.getRow(r).font = { bold: true };
  sum.columns = [{ width: 22 }, { width: 22 }, { width: 18 }];
  for (const c of R.CLASSES) {
    const list = byClass.get(c).slice().sort((a, b) => (a.last + a.first).localeCompare(b.last + b.first));
    const ws = wb.addWorksheet(safeSheetName(c, used));
    titleBlock(ws, 5, `${c.toUpperCase()} – CLASS LIST ${year}`);
    ws.getCell(3, 1).value = 'Class:'; ws.getCell(3, 2).value = c; ws.getCell(3, 3).value = 'Year:'; ws.getCell(3, 4).value = Number(year);
    ws.getCell(3, 1).font = ws.getCell(3, 3).font = { bold: true };
    headerRow(ws, 5, ['No.', 'Admission No.', 'Surname', 'First name', 'Class']);
    list.forEach((s, i) => { const row = ws.getRow(6 + i); row.values = [i + 1, s.id, s.last, s.first, c]; for (let k = 1; k <= 5; k++) row.getCell(k).border = thin; });
    ws.columns = [{ width: 6 }, { width: 18 }, { width: 24 }, { width: 24 }, { width: 16 }];
    ws.views = [{ state: 'frozen', ySplit: 5 }];
    ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  }
  return toBuffer(wb);
}

// ---------------------------------------------------------------- marks sheet (download)
// roster: [{id, first, last}], subjects: [name], existing: Map<studentId|subject, {score, absent}>
async function marksSheetWorkbook({ cls, year, term, exam, roster, subjects, existing }) {
  const ex = R.EXAMS.find(e => e.id === exam) || { id: exam, name: exam };
  const wb = newBook(), ws = wb.addWorksheet(safeSheetName(cls, new Set()));
  const cols = 4 + subjects.length;
  titleBlock(ws, Math.max(cols, 8), 'MARKS SHEET');
  const meta = [['Class:', cls], ['Year:', Number(year)], ['Term:', Number(term)], ['Exam:', ex.name]];
  meta.forEach(([k, v], i) => { const a = ws.getCell(3, 1 + i * 2), b = ws.getCell(3, 2 + i * 2); a.value = k; a.font = { bold: true }; b.value = v; b.font = { bold: true, color: { argb: NAVY } }; b.alignment = { horizontal: 'left' }; });
  ws.mergeCells(4, 1, 4, Math.max(cols, 8));
  ws.getCell(4, 1).value = 'Type each learner\'s mark (0 to 100) under the subject, in the yellow cells. Type A if the learner was absent. Leave the cell empty if there is no mark yet. Do not change the Admission No. column, the headings, or the Class / Year / Term / Exam above.';
  ws.getCell(4, 1).alignment = { wrapText: true, vertical: 'top' }; ws.getCell(4, 1).font = { italic: true, size: 10, color: { argb: 'FF44556B' } }; ws.getRow(4).height = 42;
  headerRow(ws, 6, ['No.', 'Admission No.', 'Surname', 'First name', ...subjects]);
  roster.forEach((s, i) => {
    const row = ws.getRow(7 + i); row.values = [i + 1, s.id, s.last, s.first];
    for (let k = 1; k <= 4; k++) { const c = row.getCell(k); c.border = thin; if (k <= 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT } }; }
    subjects.forEach((sub, j) => {
      const c = row.getCell(5 + j), m = existing && existing.get(s.id + '|' + sub);
      if (m) c.value = m.absent ? 'A' : m.score;
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ENTRY } }; c.border = thin; c.alignment = { horizontal: 'center' };
    });
  });
  ws.columns = [{ width: 6 }, { width: 18 }, { width: 24 }, { width: 24 }, ...subjects.map(s => ({ width: Math.max(14, Math.min(26, s.length + 4)) }))];
  ws.views = [{ state: 'frozen', xSplit: 4, ySplit: 6 }];
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  ws.getRow(6).alignment = { wrapText: true, vertical: 'middle' };
  return toBuffer(wb);
}

// ---------------------------------------------------------------- marks sheet (upload)
const ADM_HEADERS = new Set(['admission no', 'admission number', 'admission', 'adm no', 'adm number', 'admno', 'admission id', 'student id']);
const ALIASES = { maths: 'mathematics', math: 'mathematics', mtc: 'mathematics', eng: 'english', sci: 'science', sst: 'social studies', 'social study': 'social studies', 'p.e': 'physical exercise (pe)', pe: 'physical exercise (pe)', 'physical education': 'physical exercise (pe)', 'physical exercise': 'physical exercise (pe)', ict: 'computer' };
function subjectKey(h, subjects) {
  const n = norm(h).replace(/[.#]/g, ''); if (!n) return null;
  const by = new Map(subjects.map(s => [norm(s), s]));
  if (by.has(n)) return by.get(n);
  const a = ALIASES[n]; if (a && by.has(a)) return by.get(a);
  for (const s of subjects) { const l = norm(s), m = l.match(/^(.*?)\s*\((.*)\)$/); if (m && (n === m[1] || n === m[2])) return s; }
  return null;
}
function parseMark(v) {
  if (v == null) return { skip: true };
  if (v instanceof Date) return { error: 'a date, not a mark' };
  if (typeof v === 'object' && v.error) return { error: 'an Excel error value' };
  if (typeof v === 'number') { if (!Number.isFinite(v) || v < 0 || v > R.MAX_MARK) return { error: `"${v}" is not between 0 and 100` }; return { score: Math.round(v * 10) / 10 }; }
  if (typeof v === 'boolean') return { error: 'not a mark' };
  const t = String(v).trim(); if (!t || /^[-–—.]+$/.test(t)) return { skip: true };
  if (/^(a|abs|absent)$/i.test(t)) return { absent: true };
  if (/^\d+([.,]\d+)?$/.test(t)) { const n = Number(t.replace(',', '.')); if (n > R.MAX_MARK) return { error: `"${t}" is more than 100` }; return { score: Math.round(n * 10) / 10 }; }
  return { error: `"${t.slice(0, 20)}" is not a mark (use 0–100, or A for absent)` };
}
function examMatches(txt, id) { const e = R.EXAMS.find(x => x.id === id); const n = norm(txt); return !!e && [e.id, e.short, e.name].some(x => norm(x) === n); }

// Returns {meta, rows:[{row, admission, marks:[{subject, value}]}], ignoredColumns, subjectColumns}
async function readMarksSheet(buffer, subjects) {
  if (!buffer || !buffer.length) throw new Error('The file is empty.');
  if (buffer.length > MAX_BYTES) throw new Error('The file is too large (limit 10 MB).');
  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buffer); } catch (e) { throw new Error('This is not a readable Excel (.xlsx) file. Open it in Excel, choose Save As → Excel Workbook (.xlsx), then try again.'); }
  for (const ws of wb.worksheets) {
    let hdr = 0, admCol = 0;
    for (let r = 1; r <= Math.min(ws.rowCount, 25) && !hdr; r++) for (let c = 1; c <= Math.min(ws.columnCount, 30); c++) { const v = cellValue(ws.getCell(r, c)); if (typeof v === 'string' && ADM_HEADERS.has(norm(v).replace(/[.#]/g, ''))) { hdr = r; admCol = c; break; } }
    if (!hdr) continue;
    const meta = {};
    for (let r = 1; r < hdr; r++) for (let c = 1; c <= Math.min(ws.columnCount, 20); c++) {
      const v = cellValue(ws.getCell(r, c)); if (typeof v !== 'string') continue;
      const m = norm(v).replace(/:$/, '').trim();
      const key = { class: 'class', year: 'year', term: 'term', exam: 'exam', examination: 'exam' }[m];
      if (key && meta[key] == null) { const nv = cellValue(ws.getCell(r, c + 1)); if (nv != null && nv !== '') meta[key] = nv; }
    }
    const subjectColumns = [], ignoredColumns = [], seen = new Set();
    for (let c = 1; c <= ws.columnCount; c++) {
      if (c === admCol) continue; const h = cellValue(ws.getCell(hdr, c)); if (h == null || h === '') continue;
      const hs = String(h).trim(), nh = norm(hs);
      if (['no', 'no.', '#', 'surname', 'last name', 'first name', 'name', 'student', 'student name', 'learner', 'class', 'full name', 'names'].includes(nh)) continue;
      const sub = subjectKey(hs, subjects);
      if (sub && !seen.has(sub)) { seen.add(sub); subjectColumns.push({ col: c, subject: sub }); } else ignoredColumns.push(hs);
    }
    const rows = [];
    for (let r = hdr + 1; r <= ws.rowCount; r++) {
      if (rows.length > MAX_ROWS) throw new Error('Too many rows in the file.');
      const a = cellValue(ws.getCell(r, admCol)), admission = a == null ? '' : String(a).trim();
      const marks = subjectColumns.map(sc => ({ subject: sc.subject, value: cellValue(ws.getCell(r, sc.col)) }));
      const any = marks.some(m => m.value != null && String(m.value).trim() !== '');
      if (!admission && !any) continue;
      rows.push({ row: r, admission, marks });
    }
    return { sheet: ws.name, meta, rows, ignoredColumns, subjectColumns: subjectColumns.map(x => x.subject) };
  }
  throw new Error('Could not find the "Admission No." heading in this file. Please use the sheet downloaded from "Download marks sheet".');
}

module.exports = { classListsWorkbook, marksSheetWorkbook, readMarksSheet, parseMark, normId, examMatches, fileSafe, subjectKey };
