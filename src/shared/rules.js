'use strict';

const SCHOOL = { name: 'Bill Gates Junior School Nsangi', address: 'Nsangi' };
const CLASSES = ['Baby Class', 'Middle Class', 'Top Class', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];
const NURSERY = ['Baby Class', 'Middle Class', 'Top Class'];
const LOWER = ['P1', 'P2', 'P3', 'P4'];
const SUBJECTS_NURSERY = ['English', 'Physical Exercise (PE)', 'Art', 'Mathematics'];
const SUBJECTS_LOWER = ['Mathematics', 'Science', 'English', 'Social Studies', 'Computer', 'Art'];
const SUBJECTS_UPPER = ['Mathematics', 'Science', 'English', 'Social Studies'];
const DEFAULT_SUBJECTS = Object.fromEntries(CLASSES.map(c => [c, [...(NURSERY.includes(c) ? SUBJECTS_NURSERY : LOWER.includes(c) ? SUBJECTS_LOWER : SUBJECTS_UPPER)]]));
let configuredSubjects = null;
const subjectsFor = c => (configuredSubjects && Array.isArray(configuredSubjects[c]) ? configuredSubjects[c] : DEFAULT_SUBJECTS[c] || []).slice();
const configureAcademics = (subjects, grades) => { configuredSubjects = subjects || null; if (Array.isArray(grades) && grades.length) GRADES.splice(0, GRADES.length, ...grades.map(g => ({min:Number(g.min),g:String(g.g),label:String(g.label)}))); else GRADES.splice(0,GRADES.length,...DEFAULT_GRADES); }; 
const EXAMS = [
  { id: 'BOT', name: 'Beginning of Term', short: 'BOT' },
  { id: 'MID', name: 'Mid Term Exams', short: 'MID' },
  { id: 'EOT', name: 'End of Term Exams', short: 'EOT' },
];
const MAX_MARK = 100;
const GRADES = [
  { min: 80, g: 'A', label: 'Excellent' }, { min: 70, g: 'B', label: 'Very Good' }, { min: 60, g: 'C', label: 'Good' },
  { min: 50, g: 'D', label: 'Fair' }, { min: 40, g: 'E', label: 'Weak' }, { min: 0, g: 'F', label: 'Very Weak' },
];
const DEFAULT_GRADES = GRADES.map(g => ({...g}));
const gradeOf = m => (m == null ? null : GRADES.find(x => m >= x.min));


const ADMISSION_FEE = 30000;
const FEE_TABLE = { nursery: 200000, lower: 250000, upper: 300000, boarding: 500000 };
function feeFor(className, type) {
  if (type === 'boarding') return FEE_TABLE.boarding;
  if (NURSERY.includes(className)) return FEE_TABLE.nursery;
  if (LOWER.includes(className)) return FEE_TABLE.lower;
  return FEE_TABLE.upper;
}


const num = n => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const money = n => 'UGX ' + num(n);
const parseMoney = s => Number(String(s == null ? '' : s).replace(/[^\d]/g, '')) || 0;


function termsFor(y) {
  return [
    { id: 1, name: 'Term 1', start: `${y}-02-02`, end: `${y}-05-01` },
    { id: 2, name: 'Term 2', start: `${y}-05-25`, end: `${y}-08-21` },
    { id: 3, name: 'Term 3', start: `${y}-09-14`, end: `${y}-12-04` },
  ];
}
function localISO(d = new Date()) { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
function detectTerm(today) {
  const year = Number(today.slice(0, 4)), terms = termsFor(year);
  for (const t of terms) t.status = today < t.start ? 'upcoming' : today > t.end ? 'completed' : 'current';
  let cur = terms.find(t => t.status === 'current');
  if (!cur) cur = [...terms].reverse().find(t => t.status === 'completed') || terms[0];
  return { year, term: cur.id };
}
const termIdx = (y, t) => Number(y) * 3 + Number(t);
const prettyDate = iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });


const markKey = (y, t, e, sid, sub) => `${y}|${t}|${e}|${sid}|${sub}`;
function rosterFor(students, marks, year, cls, currentYear) {
  const ids = new Set();
  for (const m of marks) if (Number(m.year) === Number(year) && m.className === cls && !m.cleared) ids.add(m.studentId);
  return students.filter(s => ids.has(s.id) || (Number(year) === Number(currentYear) && s.status === 'active' && s.className === cls))
    .map(s => ({ id: s.id, first: s.first, last: s.last, className: cls }))
    .sort((a, b) => (a.last + a.first).localeCompare(b.last + b.first));
}
function resultFor(st, y, t, e, marksMap) {
  const subs = subjectsFor(st.className);
  const rows = subs.map(subject => {
    const m = marksMap.get(markKey(y, t, e, st.id, subject)); const has = !!m && !m.cleared;
    return { subject, score: has && !m.absent ? m.score : null, absent: has && !!m.absent, entered: has };
  });
  const sat = rows.filter(r => r.score != null), total = sat.reduce((a, r) => a + r.score, 0);
  return { st, rows, sat: sat.length, total, avg: sat.length ? total / sat.length : null, entered: rows.filter(r => r.entered).length, of: subs.length, pos: null };
}
function classResults(roster, y, t, e, marksMap) {
  const list = roster.map(s => resultFor(s, y, t, e, marksMap));
  const key = r => Math.round(r.avg * 100);
  for (const r of list) if (r.avg != null) r.pos = 1 + list.filter(o => o.avg != null && key(o) > key(r)).length;
  return list;
}
const marksToMap = marks => { const m = new Map(); for (const x of marks) m.set(x.id, x); return m; };

if (typeof module !== 'undefined') module.exports = { SCHOOL, CLASSES, NURSERY, LOWER, DEFAULT_SUBJECTS, configureAcademics, subjectsFor, EXAMS, MAX_MARK, GRADES, gradeOf, ADMISSION_FEE, FEE_TABLE, feeFor, num, money, parseMoney, termsFor, localISO, detectTerm, termIdx, prettyDate, markKey, rosterFor, resultFor, classResults, marksToMap };
