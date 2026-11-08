'use strict';
// The Teachers' portal. It runs inside the same program as the Headteacher's screens and works directly on the
// same school records, so there is nothing to connect, pair or synchronise. A mark typed here is in the
// Headteacher's records the moment it is saved.
const R = require('../shared/rules');
const X = require('./xlsx');
const nowISO = () => new Date().toISOString();

class Teacher {
  constructor(hm, getName) { this.hm = hm; this.getName = getName || (() => 'Teacher'); this._imports = new Map(); }
  // A live view of the school records, shaped the way the Excel helpers expect.
  get d() {
    const hm = this.hm;
    return { get students() { return hm.teacherStudents(); }, marks: hm.d.marks, comments: hm.d.comments, promotions: hm.d.promotions, current: hm.cur(), academic: hm.d.academic, cfg: { teacher: this.getName() } };
  }
  state() {
    const d = this.d;
    return { cfg: { teacher: d.cfg.teacher }, students: d.students, academic: d.academic, current: d.current, marks: Object.values(d.marks), comments: Object.values(d.comments), promotions: Object.values(d.promotions), conn: { state: 'online', pending: 0 } };
  }
  _rec(m) {
    const year = +m.year, st = this.hm.d.students[m.studentId];
    if (!st) throw new Error('Student not found.');
    if (year > this.hm.cur().year) throw new Error('That year has not started yet.');
    if (!this.hm.classFor(st, year)) throw new Error(`${st.first} ${st.last} was not in the school in ${year}.`);
    const id = R.markKey(year, m.term, m.exam, m.studentId, m.subject);
    const rec = { id, year, term: +m.term, exam: m.exam, studentId: m.studentId, className: m.className, subject: m.subject, score: m.absent || m.cleared ? null : Number(m.score), absent: !!m.absent, cleared: !!m.cleared, by: this.getName() || 'Teacher', at: nowISO() };
    if (!rec.cleared && !rec.absent && !(rec.score >= 0 && rec.score <= R.MAX_MARK)) throw new Error('Marks must be 0–100.');
    return rec;
  }
  setMark(m) { const rec = this._rec(m); this.hm.acceptMarks([rec], [], rec.by); return this.hm.d.marks[rec.id] || rec; }
  // Save many marks at once (used by the Excel upload).
  setMarks(list) { const recs = list.map(m => this._rec(m)); this.hm.acceptMarks(recs, [], this.getName()); return recs.map(r => this.hm.d.marks[r.id] || r); }
  setComment(id, teacher, head) { this.hm.acceptMarks([], [{ id, teacher, head, at: nowISO() }]); }
  setPromotion({ studentId, year, term, decision }) { return this.hm.recordPromotion({ studentId, year, term, decision, by: this.getName() || 'Director of Studies' }); }
  clearPromotion({ studentId, year }) { return this.hm.removePromotion({ studentId, year }); }

  // ---- Excel: class lists, marks sheet download, marks upload ----------------------------------
  _roster(year, cls) { return R.rosterFor(this.d.students, Object.values(this.d.marks), Number(year), cls, this.d.current.year); }
  _ctx({ year, term, exam, cls }) {
    year = Number(year); term = Number(term);
    if (!R.CLASSES.includes(cls)) throw new Error('Choose a class.');
    if (![1, 2, 3].includes(term) || !(year >= 2020 && year <= 2100)) throw new Error('Choose the year and term.');
    if (!R.EXAMS.some(e => e.id === exam)) throw new Error('Choose the examination.');
    return { year, term, exam, cls };
  }
  async exportClassLists() {
    const year = this.d.current.year;
    const data = await X.classListsWorkbook(this.d.students.filter(s => s.inYear), year);
    return { name: `BGS-Class-Lists-${year}.xlsx`, data: data.toString('base64') };
  }
  async exportMarksSheet(a) {
    const { year, term, exam, cls } = this._ctx(a), subjects = R.subjectsFor(cls), roster = this._roster(year, cls);
    if (!roster.length) throw new Error('There are no students in this class for that year yet.');
    const existing = new Map();
    for (const m of Object.values(this.d.marks)) if (m.year === year && m.term === term && m.exam === exam && !m.cleared && m.className === cls) existing.set(m.studentId + '|' + m.subject, m);
    const data = await X.marksSheetWorkbook({ cls, year, term, exam, roster, subjects, existing });
    return { name: `BGS-${X.fileSafe(cls)}-Marks-Term${term}-${exam}-${year}.xlsx`, data: data.toString('base64') };
  }
  // Step 1: read the filled sheet and report what WOULD be saved. Nothing is changed yet.
  async previewMarksImport(a) {
    const ctx = this._ctx(a), subjects = R.subjectsFor(ctx.cls);
    const parsed = await X.readMarksSheet(Buffer.from(String(a.data || ''), 'base64'), subjects);
    const m = parsed.meta, wrong = [];
    if (m.class != null && String(m.class).trim().toLowerCase() !== ctx.cls.toLowerCase()) wrong.push(`class ${m.class} (you are in ${ctx.cls})`);
    if (m.year != null && Number(m.year) !== ctx.year) wrong.push(`year ${m.year} (you chose ${ctx.year})`);
    if (m.term != null && Number(String(m.term).replace(/\D/g, '')) !== ctx.term) wrong.push(`Term ${m.term} (you chose Term ${ctx.term})`);
    if (m.exam != null && !X.examMatches(m.exam, ctx.exam)) wrong.push(`${m.exam} (you chose ${R.EXAMS.find(e => e.id === ctx.exam).name})`);
    if (wrong.length) throw new Error('This sheet is for a different class or exam: ' + wrong.join('; ') + '. Choose the matching Year, Term, Examination and Class on the Enter Marks page, then upload again.');
    if (!parsed.subjectColumns.length) throw new Error('None of the headings in this sheet match the subjects of ' + ctx.cls + ' (' + subjects.join(', ') + '). Use the sheet from "Download marks sheet".');
    const roster = this._roster(ctx.year, ctx.cls), byAdm = new Map(roster.map(s => [X.normId(s.id), s]));
    const errors = [], entries = [], seen = new Set(), unknown = [];
    let same = 0, fresh = 0, changed = 0, absent = 0, studentsWithMarks = new Set();
    for (const row of parsed.rows) {
      const st = row.admission && byAdm.get(X.normId(row.admission));
      const parsedMarks = row.marks.map(x => ({ subject: x.subject, p: X.parseMark(x.value) }));
      if (!st) { if (parsedMarks.some(x => !x.p.skip)) { errors.push({ row: row.row, text: row.admission ? `Admission No. "${row.admission}" is not in ${ctx.cls} for ${ctx.year}` : 'A row has marks but no Admission No.' }); unknown.push(row.admission); } continue; }
      if (seen.has(st.id)) { errors.push({ row: row.row, text: `${st.first} ${st.last} (${st.id}) is listed twice – the second row was ignored` }); continue; }
      seen.add(st.id);
      for (const { subject, p } of parsedMarks) {
        if (p.skip) continue;
        if (p.error) { errors.push({ row: row.row, text: `${st.first} ${st.last}, ${subject}: ${p.error}` }); continue; }
        const old = this.d.marks[R.markKey(ctx.year, ctx.term, ctx.exam, st.id, subject)], has = old && !old.cleared;
        if (has && (p.absent ? old.absent : (!old.absent && old.score === p.score))) { same++; continue; }
        has ? changed++ : fresh++; if (p.absent) absent++; studentsWithMarks.add(st.id);
        entries.push({ year: ctx.year, term: ctx.term, exam: ctx.exam, studentId: st.id, className: ctx.cls, subject, ...(p.absent ? { absent: true } : { score: p.score }) });
      }
    }
    const token = require('crypto').randomBytes(8).toString('hex');
    this._imports = this._imports || new Map(); for (const [k, v] of this._imports) if (Date.now() - v.at > 30 * 60000) this._imports.delete(k);
    this._imports.set(token, { at: Date.now(), entries });
    return { token, sheet: parsed.sheet, subjects: parsed.subjectColumns, ignoredColumns: parsed.ignoredColumns, rows: parsed.rows.length, toSave: entries.length, fresh, changed, same, absent, students: studentsWithMarks.size, errors: errors.slice(0, 60), errorCount: errors.length, noStudent: unknown.length };
  }
  // Step 2: the person confirmed – save every mark exactly as if typed in by hand, into the school records.
  applyMarksImport({ token }) {
    const job = this._imports && this._imports.get(token); if (!job) throw new Error('This upload has expired. Please choose the file again.');
    this._imports.delete(token);
    const saved = this.setMarks(job.entries); return { saved: saved.length };
  }
}
module.exports = { Teacher };
