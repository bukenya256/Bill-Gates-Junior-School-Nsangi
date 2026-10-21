'use strict';
const crypto = require('crypto');
const R = require('../shared/rules');
const SMS = require('./sms');

const DEFAULTS = {
  meta: { createdAt: null, pw: null, lanKey: null, hmId: null, counters: {}, current: null, seq: 0, admSeq: {} },
  students: {}, staff: {}, payments: {}, bills: {}, salaryBills: {}, marks: {}, comments: {}, discipline: {}, promotions: {}, notifications: {}, academic: {subjects: null, grades: null}, audit: [], dirty: {},
};
const nowISO = () => new Date().toISOString();
class Fail extends Error {}
const fail = m => { throw new Fail(m); };

class HM {
  constructor(store, hooks = {}) {
    this.s = store; this.d = store.data; this.hooks = hooks;
    this.d.academic ||= {subjects:null,grades:null}; this.d.notifications ||= {}; R.configureAcademics(this.d.academic.subjects,this.d.academic.grades);
    const m = this.d.meta;
    if (!m.createdAt) m.createdAt = nowISO();
    if (!m.lanKey) m.lanKey = crypto.randomBytes(4).toString('hex').toUpperCase().replace(/(.{4})/, '$1-');
    if (!m.hmId) m.hmId = crypto.randomBytes(8).toString('hex');
    if (!m.current) m.current = R.detectTerm(R.localISO());
    store.save(true);
  }
  /* ---------- plumbing ---------- */
  touch(col, id) { this.d.dirty[col + ':' + id] = (this.d.dirty[col + ':' + id] || 0) + 1; }
  log(action, detail) { this.d.audit.push({ at: nowISO(), action, detail }); if (this.d.audit.length > 3000) this.d.audit.splice(0, 500); this.touch('audit', this.d.audit.length); }
  done(now = true) { this.s.save(now); this.hooks.onChange && this.hooks.onChange(); }
  cur() { return this.d.meta.current; }

  /* ---------- password ---------- */
  hasPassword() { return !!this.d.meta.pw; }
  _hash(pw, salt) { return crypto.scryptSync(pw, salt, 32).toString('hex'); }
  setPassword(pw, old) {
    if (String(pw || '').length < 6) fail('Password must be at least 6 characters.');
    if (this.d.meta.pw && !this.checkPassword(old)) fail('The current password is wrong.');
    const salt = crypto.randomBytes(16).toString('hex'); this.d.meta.pw = { salt, hash: this._hash(pw, salt) }; this.done();
  }
  checkPassword(pw) {
    const p = this.d.meta.pw; if (!p) return false;
    const a = Buffer.from(this._hash(String(pw || ''), p.salt), 'hex'), b = Buffer.from(p.hash, 'hex');
    return crypto.timingSafeEqual(a, b);
  }

  /* ---------- fees / bills ---------- */
  sumPaid(pred) { let t = 0; for (const p of Object.values(this.d.payments)) if (!p.void && pred(p)) t += p.amount; return t; }
  admissionPaid(sid) { return this.sumPaid(p => p.kind === 'admission' && p.studentId === sid); }
  feesPaid(sid, y, t) { return this.sumPaid(p => p.kind === 'fees' && p.studentId === sid && p.year === y && p.term === t); }
  bill(s, y, t, create = true) {
    const key = `${y}|${t}|${s.id}`; let b = this.d.bills[key];
    if (b) return b;
    const c = this.cur();
    if (!create || s.status !== 'active' || !s.enrolled) return null;
    if (R.termIdx(y, t) > R.termIdx(c.year, c.term) || R.termIdx(y, t) < R.termIdx(s.enrolled.year, s.enrolled.term)) return null;
    b = this.d.bills[key] = { key, studentId: s.id, year: y, term: t, due: R.feeFor(s.className, s.type), type: s.type, className: s.className };
    this.touch('bills', key); return b;
  }
  refreshCurrentBill(s) {
    const c = this.cur(), b = this.d.bills[`${c.year}|${c.term}|${s.id}`];
    if (b) { b.due = R.feeFor(s.className, s.type); b.type = s.type; b.className = s.className; this.touch('bills', b.key); }
  }
  feeRow(s, y, t) {
    const b = this.bill(s, y, t); const idx = R.termIdx(y, t);
    let arrears = 0;
    for (const x of Object.values(this.d.bills)) if (x.studentId === s.id && R.termIdx(x.year, x.term) < idx) arrears += Math.max(0, x.due - this.feesPaid(s.id, x.year, x.term));
    const paid = this.feesPaid(s.id, y, t), due = b ? b.due : 0;
    return { has: !!b, due, paid, balance: Math.max(0, due - paid), arrears, type: b ? b.type : s.type, status: !b ? 'none' : due - paid <= 0 ? 'paid' : paid > 0 ? 'partial' : 'unpaid' };
  }

  /* ---------- salaries ---------- */
  salaryDemand(st, period) {
    const sb = this.d.salaryBills[`${st.id}|${period}`];
    if (sb) return sb.demand;
    return st.employedOn && period < st.employedOn.slice(0, 7) ? 0 : st.salary;
  }
  salaryPaid(stid, period) { return this.sumPaid(p => p.kind === 'salary' && p.staffId === stid && p.period === period); }

  /* ---------- state for the screens ---------- */
  getState({ year, term, period } = {}) {
    const c = this.cur(); year = Number(year) || c.year; term = Number(term) || c.term;
    period = period || `${year}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    // make sure everybody active has this term's bill (only for terms up to the current one)
    const students = Object.values(this.d.students).map(s => {
      const fee = this.feeRow(s, year, term), ap = this.admissionPaid(s.id);
      return { ...s, admission: { fee: R.ADMISSION_FEE, paid: ap, balance: Math.max(0, R.ADMISSION_FEE - ap), status: ap >= R.ADMISSION_FEE ? 'paid' : 'pending' }, fee, termFee: R.feeFor(s.className, s.type) };
    }).sort((a, b) => (a.last + a.first).localeCompare(b.last + b.first));
    this.s.save();
    const staff = Object.values(this.d.staff).map(w => {
      const demand = this.salaryDemand(w, period), paid = this.salaryPaid(w.id, period);
      return { ...w, period: { key: period, demand, paid, balance: Math.max(0, demand - paid) } };
    }).sort((a, b) => (a.last + a.first).localeCompare(b.last + b.first));
    const payments = Object.values(this.d.payments).sort((a, b) => b.ts.localeCompare(a.ts));
    return { school: R.SCHOOL, current: c, view: { year, term, period }, students, staff, payments, discipline: Object.values(this.d.discipline).sort((a,b)=>b.at.localeCompare(a.at)), promotions: Object.values(this.d.promotions), lanKey: this.d.meta.lanKey, academic: this.d.academic, notifications: Object.values(this.d.notifications).sort((a,b)=>b.at.localeCompare(a.at)), seq: this.d.meta.seq };
  }

  setSubjects(cls, subjects) {
    if (!R.CLASSES.includes(cls)) fail('Invalid class.');
    if (!Array.isArray(subjects) || !subjects.length || subjects.length > 20) fail('Add 1 to 20 subjects.');
    const names=subjects.map(x=>String(x).trim());
    if(names.some(x=>!x || x.length>65) || new Set(names.map(x=>x.toLowerCase())).size!==names.length) fail('Subjects must be unique and non-empty.');
    this.d.academic.subjects ||= structuredClone(R.DEFAULT_SUBJECTS);
    this.d.academic.subjects[cls]=names;
    R.configureAcademics(this.d.academic.subjects,this.d.academic.grades);
    this.touch('academic','current');this.log('subjects',cls);this.done(); return this.d.academic;
  }
  setGrades(grades) {
    if(!Array.isArray(grades)||grades.length<2||grades.length>15) fail('Define 2 to 15 grades.');
    const a=grades.map(x=>({min:Number(x.min),g:String(x.g||'').trim(),label:String(x.label||'').trim()}));
    if(a.some((x,i)=>!Number.isInteger(x.min)||x.min<0||x.min>100||!x.g||x.g.length>8||!x.label||x.label.length>60||(i && a[i-1].min<=x.min))||a.at(-1).min!==0) fail('Grades must descend from at most 100 to 0 with unique boundaries.');
    this.d.academic.grades=a;R.configureAcademics(this.d.academic.subjects,a);
    this.touch('academic','current');this.log('grades','Grading scale updated');this.done();return a;
  }
  saveNotification(f) {
    const allowed=['School fees reminder','School fees warning','Send child home for school fees','Suspension','Expulsion','Custom'];
    if(!allowed.includes(f.category)) fail('Choose notification category.');
    const groups=['balances','all','discipline','manual'];
    if(!groups.includes(f.recipients||'manual')) fail('Choose who receives the message.');
    if((f.recipients||'manual')==='manual' && !this.d.students[f.studentId]) fail('Search for and select a student.');
    const subject=String(f.subject||'').trim(), body=String(f.message||'').trim();
    if(!subject||subject.length>120||!body||body.length>1200) fail('Enter a subject and message (maximum 1,200 characters).');
    const id=require('crypto').randomUUID();
    const rec={id,category:f.category,subject,message:body,recipients:f.recipients||'manual',studentId:f.studentId||null,at:nowISO(),status:'draft',sent:0,failed:0,skipped:0,log:[]};
    this.d.notifications[id]=rec;this.touch('notifications',id);this.log('notification draft',subject);this.done();return rec;
  }
  notificationRecipients(rec) {
    const all = this.getState().students;
    let list;
    if (rec.recipients === 'all') list = all.filter(s => s.status === 'active');
    else if (rec.recipients === 'balances') list = all.filter(s => s.status === 'active' && s.fee.has && (s.fee.balance + s.fee.arrears) > 0);
    else if (rec.recipients === 'discipline') { const ids = new Set(Object.values(this.d.discipline).filter(x => !x.cancelledAt).map(x => x.studentId)); list = all.filter(s => ids.has(s.id)); }
    else list = all.filter(s => s.id === rec.studentId);
    const done = new Set((rec.log || []).filter(x => x.ok).map(x => x.studentId));
    return list.filter(s => !done.has(s.id)).map(s => ({
      studentId: s.id, student: s.first + ' ' + s.last, className: s.className, parent: s.parent, phone: SMS.normalizePhone(s.phone),
      text: SMS.fillTemplate(rec.message, { parent: s.parent || 'Parent', student: s.first + ' ' + s.last, class: s.className, balance: R.num(s.fee.balance + s.fee.arrears) }),
    }));
  }
  previewNotification(id) {
    const rec = this.d.notifications[id] || fail('Notification not found.');
    const rs = this.notificationRecipients(rec), ok = rs.filter(r => r.phone);
    return { id, subject: rec.subject, total: rs.length, sendable: ok.length, noPhone: rs.length - ok.length, segments: ok.reduce((a, r) => a + SMS.segments(r.text), 0), sample: ok[0] ? { to: ok[0].phone, student: ok[0].student, text: ok[0].text } : null, missing: rs.filter(r => !r.phone).slice(0, 8).map(r => r.student + ' (' + r.studentId + ')') };
  }
  async sendNotification(id, creds, sendBatch = SMS.sendBatch) {
    const rec = this.d.notifications[id] || fail('Notification not found.');
    if (!creds || !creds.username || !creds.key) fail('Set up the SMS account first (Settings & Backup).');
    const rs = this.notificationRecipients(rec), ok = rs.filter(r => r.phone);
    if (!ok.length) fail(rs.length ? 'None of these parents has a valid phone number saved.' : 'Everyone on this list has already been sent this message.');
    let sent = 0, failed = 0, firstError = '';
    const byText = new Map();
    for (const r of ok) { if (!byText.has(r.text)) byText.set(r.text, []); byText.get(r.text).push(r); }
    for (const [text, group] of byText) {
      for (let i = 0; i < group.length; i += 50) {
        const part = group.slice(i, i + 50);
        try {
          const res = await sendBatch(creds, part.map(r => r.phone), text);
          for (const r of part) {
            const x = res.find(y => y.phone === r.phone);
            const good = !!(x && x.ok);
            rec.log.push({ studentId: r.studentId, phone: r.phone, ok: good, status: x ? x.status : 'No answer', at: nowISO() });
            if (good) sent++; else failed++;
          }
        } catch (e) {
          firstError = firstError || e.message;
          for (const r of part) { rec.log.push({ studentId: r.studentId, phone: r.phone, ok: false, status: e.message, at: nowISO() }); failed++; }
        }
      }
    }
    rec.log = rec.log.slice(-2000);
    rec.sent = rec.log.filter(x => x.ok).length;
    rec.failed = failed; rec.skipped = rs.length - ok.length;
    rec.status = failed ? (rec.sent ? 'partial' : 'failed') : 'sent'; rec.sentAt = nowISO();
    this.touch('notifications', id); this.log('notification sent', `${rec.subject}: ${sent} sent, ${failed} failed`); this.done();
    return { sent, failed, skipped: rec.skipped, error: firstError, status: rec.status };
  }
  /* ---------- admissions & students ---------- */
  _need(v, label) { if (!String(v || '').trim()) fail(`${label} is required.`); return String(v).trim(); }
  addApplication(f) {
    const first = this._need(f.first, 'First name'), last = this._need(f.last, 'Surname');
    if (!R.CLASSES.includes(f.className)) fail('Choose the class applied for.');
    const type = f.type === 'boarding' ? 'boarding' : 'day', c = this.cur();
    const n = (this.d.meta.admSeq[c.year] = (this.d.meta.admSeq[c.year] || 0) + 1);
    const id = `BGS/${c.year}/${String(n).padStart(3, '0')}`;
    const s = this.d.students[id] = { id, first, last, className: f.className, type, gender: f.gender || '', dob: f.dob || '', parent: String(f.parent || '').trim(), phone: String(f.phone || '').trim(), address: String(f.address || '').trim(),
      status: 'pending', enrolled: null, typeHistory: [{ year: c.year, term: c.term, type, at: nowISO() }], appliedOn: R.localISO(), createdAt: nowISO() };
    this.touch('students', id); this.log('application', `${id} ${first} ${last}`);
    let receipt = null; const amt = R.parseMoney(f.paidNow);
    if (amt > 0) receipt = this._payAdmission(s, amt, f.method, '');
    this.done(); return { student: s, receipt };
  }
  _payAdmission(s, amount, method, note) {
    const before = this.admissionPaid(s.id), left = R.ADMISSION_FEE - before;
    if (left <= 0) fail('The admission fee is already fully paid.');
    if (amount <= 0) fail('Enter the amount received.');
    if (amount > left) fail(`Amount is more than the remaining admission balance (${R.money(left)}).`);
    const p = this._receipt({ kind: 'admission', studentId: s.id, studentName: `${s.first} ${s.last}`, className: s.className, type: s.type, year: this.cur().year, term: this.cur().term, amount, method, note, due: R.ADMISSION_FEE, paidBefore: before, paidTotal: before + amount, balance: left - amount });
    if (before + amount >= R.ADMISSION_FEE && s.status === 'pending') {
      s.status = 'active'; s.enrolled = { year: this.cur().year, term: this.cur().term }; s.activatedOn = R.localISO();
      this.touch('students', s.id); this.bill(s, this.cur().year, this.cur().term); this.log('admitted', `${s.id} admission fee complete – now ACTIVE`);
    }
    return p;
  }
  payAdmission(sid, amount, method, note) { const s = this.d.students[sid] || fail('Student not found.'); const p = this._payAdmission(s, R.parseMoney(amount), method, note); this.done(); return p; }
  updateStudent(sid, f) {
    const s = this.d.students[sid] || fail('Student not found.');
    for (const k of ['first', 'last', 'parent', 'phone', 'address', 'gender', 'dob']) if (f[k] !== undefined) s[k] = String(f[k]).trim();
    if (!s.first || !s.last) fail('Name cannot be empty.');
    if (f.className && f.className !== s.className) { if (!R.CLASSES.includes(f.className)) fail('Unknown class.'); this.log('class change', `${sid}: ${s.className} → ${f.className}`); s.className = f.className; this.refreshCurrentBill(s); }
    this.touch('students', sid); this.done(); return s;
  }
  setType(sid, type) {
    const s = this.d.students[sid] || fail('Student not found.');
    if (!['day', 'boarding'].includes(type)) fail('Type must be day or boarding.');
    if (s.type === type) return s;
    const c = this.cur(); s.type = type; s.typeHistory.push({ year: c.year, term: c.term, type, at: nowISO() });
    this.refreshCurrentBill(s); this.touch('students', sid); this.log('type change', `${sid} → ${type}`); this.done(); return s;
  }
  setStudentStatus(sid, status, reason) {
    const s = this.d.students[sid] || fail('Student not found.');
    if (s.status === 'pending') fail('This applicant has not completed the admission fee yet.');
    if (!['active', 'inactive'].includes(status)) fail('Bad status.');
    s.status = status; s.statusNote = String(reason || '').trim(); s.statusChangedOn = R.localISO();
    if (status === 'active') this.bill(s, this.cur().year, this.cur().term);
    this.touch('students', sid); this.log('student ' + status, `${sid} ${s.statusNote}`); this.done(); return s;
  }

  addDiscipline({ studentId, action, reason, date, end, notes }) {
    const s = this.d.students[studentId] || fail('Student not found.');
    if (!['suspension', 'expulsion'].includes(action)) fail('Choose suspension or expulsion.');
    if (!String(reason || '').trim()) fail('Give the disciplinary reason.');
    if (action === 'suspension' && end && end < (date || R.localISO())) fail('Suspension return date must not precede the start date.');
    const id = crypto.randomUUID();
    const rec = { end: action === 'suspension' ? (end || '') : '', id, studentId, studentName: s.first + ' ' + s.last, className: s.className, action, reason: String(reason).trim().slice(0,1200), notes: String(notes || '').trim().slice(0,1200), date: date || R.localISO(), at: nowISO(), recordedBy: 'Headteacher' };
    this.d.discipline[id] = rec; this.touch('discipline', id);
    if (action === 'expulsion') { s.status = 'inactive'; s.statusNote = 'Expelled: ' + rec.reason; s.statusChangedOn = rec.date; this.touch('students', s.id); }
    // Suspension is a recorded temporary action, not an irreversible deletion or expulsion.
    this.log('disciplinary ' + action, `${s.id}: ${rec.reason}`); this.done(); return rec;
  }
  cancelDiscipline({id,reason}) {
    const rec=this.d.discipline[id] || fail('Disciplinary case not found.');
    if(rec.cancelledAt) fail('This disciplinary action has already been cancelled.');
    reason=String(reason||'').trim(); if(!reason) fail('Give a reason for cancelling the action.');
    rec.cancelledAt=nowISO(); rec.cancelReason=reason.slice(0,1200); rec.cancelledBy='Headteacher';
    this.touch('discipline',id);
    const s=this.d.students[rec.studentId];
    if(s && rec.action==='expulsion' && s.status==='inactive' && String(s.statusNote||'').startsWith('Expelled: '+rec.reason)) {
      s.status='active'; s.statusNote='Expulsion reversed: '+reason.slice(0,250); s.statusChangedOn=R.localISO();
      this.touch('students',s.id); this.bill(s,this.cur().year,this.cur().term);
    }
    this.log('disciplinary action reversed',id+': '+reason); this.done(); return rec;
  }
  recordPromotion({studentId, year, term, decision, by}) {
    const s = this.d.students[studentId] || fail('Student not found.');
    year = Number(year); term = Number(term);
    if (term !== 3 || year < 2026 || year > 2099) fail('Promotion decisions are for Term 3 only.');
    if (!['promoted','repeat'].includes(decision)) fail('Choose Promoted or Repeat Class.');
    if (s.status !== 'active') fail('Only active students can receive a promotion decision.');
    if (year !== this.cur().year || this.cur().term !== 3) fail('Promotion decisions must be for the current academic year in Term 3.');
    if (!Object.values(this.d.marks).some(m => m.studentId === studentId && m.year === year && m.term === 3 && m.exam === 'EOT' && !m.cleared)) fail('Record Term 3 End of Term exam marks before making a promotion decision.');
    const key = `${year}|${studentId}`;
    const rec = { key, studentId, year, term: 3, className: s.className, decision, by: String(by || 'Director of Studies').slice(0,80), at: nowISO(), applied: false };
    const old = this.d.promotions[key];
    if (old && old.applied) fail('This promotion has already been applied.');
    this.d.promotions[key] = rec; this.touch('promotions', key); this.log('promotion decision', `${studentId}: ${decision} for ${year}`); this.done(); return rec;
  }

  /* ---------- school fees ---------- */
  payFees(sid, year, term, amount, method, note) {
    const s = this.d.students[sid] || fail('Student not found.'); year = Number(year); term = Number(term);
    if (s.status === 'pending') fail('Complete the admission fee first.');
    const b = this.bill(s, year, term); if (!b) fail('No school fees bill exists for this student in that term.');
    amount = R.parseMoney(amount); if (amount <= 0) fail('Enter the amount received.');
    const before = this.feesPaid(sid, year, term), left = b.due - before;
    if (left <= 0) fail('This term is already fully paid.');
    if (amount > left) fail(`Amount is more than the balance (${R.money(left)}).`);
    const p = this._receipt({ kind: 'fees', studentId: sid, studentName: `${s.first} ${s.last}`, className: b.className, type: b.type, year, term, amount, method, note, due: b.due, paidBefore: before, paidTotal: before + amount, balance: left - amount });
    this.done(); return p;
  }

  /* ---------- staff ---------- */
  addStaff(f) {
    const first = this._need(f.first, 'First name'), last = this._need(f.last, 'Surname'), title = this._need(f.title, 'Job title'), salary = R.parseMoney(f.salary);
    if (salary <= 0) fail('Enter the monthly salary.');
    const n = Object.keys(this.d.staff).length + 1; let id = `STF-${String(n).padStart(3, '0')}`; while (this.d.staff[id]) id += 'x';
    const w = this.d.staff[id] = { id, first, last, title, salary, phone: String(f.phone || '').trim(), status: 'active', employedOn: f.employedOn || R.localISO(), salaryHistory: [{ salary, on: R.localISO() }], createdAt: nowISO() };
    this.touch('staff', id); this.log('staff added', `${id} ${first} ${last} ${salary}`); this.done(); return w;
  }
  updateStaff(id, f) {
    const w = this.d.staff[id] || fail('Worker not found.');
    for (const k of ['first', 'last', 'title', 'phone']) if (f[k] !== undefined) w[k] = String(f[k]).trim();
    if (f.salary !== undefined) { const v = R.parseMoney(f.salary); if (v <= 0) fail('Enter the monthly salary.'); if (v !== w.salary) { w.salary = v; w.salaryHistory.push({ salary: v, on: R.localISO() }); } }
    this.touch('staff', id); this.log('staff updated', id); this.done(); return w;
  }
  setStaffStatus(id, status) {
    const w = this.d.staff[id] || fail('Worker not found.');
    if (!['active', 'inactive'].includes(status)) fail('Bad status.');
    w.status = status; w.statusChangedOn = R.localISO(); this.touch('staff', id); this.log('staff ' + status, id); this.done(); return w;
  }
  paySalary(id, period, amount, method, note) {
    const w = this.d.staff[id] || fail('Worker not found.');
    if (!/^\d{4}-\d{2}$/.test(period || '')) fail('Choose the month being paid.');
    amount = R.parseMoney(amount); if (amount <= 0) fail('Enter the amount paid.');
    const demand = this.salaryDemand(w, period), before = this.salaryPaid(id, period), left = demand - before;
    if (demand <= 0) fail('No salary is due for that month.');
    if (left <= 0) fail('This month is already fully paid.');
    if (amount > left) fail(`Amount is more than the salary still owed (${R.money(left)}).`);
    const k = `${id}|${period}`; if (!this.d.salaryBills[k]) { this.d.salaryBills[k] = { key: k, staffId: id, period, demand }; this.touch('salaryBills', k); }
    const p = this._receipt({ kind: 'salary', staffId: id, staffName: `${w.first} ${w.last}`, title: w.title, period, year: this.cur().year, term: this.cur().term, amount, method, note, due: demand, paidBefore: before, paidTotal: before + amount, balance: left - amount });
    this.done(); return p;
  }
  voidPayment(id, reason) {
    const p = this.d.payments[id] || fail('Receipt not found.');
    if (p.kind === 'admission') fail('Admission payments cannot be cancelled here.');
    if (p.void) fail('Already cancelled.'); if (!String(reason || '').trim()) fail('Give a reason for cancelling.');
    p.void = true; p.voidReason = String(reason).trim(); p.voidAt = nowISO(); this.touch('payments', id); this.log('receipt cancelled', `${id}: ${p.voidReason}`); this.done(); return p;
  }

  /* ---------- receipts ---------- */
  _receipt(p) {
    const pre = { admission: 'ADM', fees: 'FEE', salary: 'SAL' }[p.kind], c = this.d.meta.counters; c[p.kind] = (c[p.kind] || 0) + 1;
    const no = `BGS-${pre}-${String(c[p.kind]).padStart(5, '0')}`; const now = new Date();
    const rec = { id: no, receiptNo: no, date: R.localISO(now), ts: now.toISOString(), method: p.method || 'Cash', receivedBy: 'Headteacher', ...p };
    this.d.payments[no] = rec; this.touch('payments', no); this.log('receipt', `${no} ${rec.amount}`); return rec;
  }

  /* ---------- term control ---------- */
  setCurrentTerm(year, term) {
    year = Number(year); term = Number(term); if (![1, 2, 3].includes(term) || year < 2020 || year > 2100) fail('Invalid year/term.');
    const previous = this.cur();
    if (R.termIdx(year,term) < R.termIdx(previous.year,previous.term)) fail('Cannot roll back the current term. Use the year and term selectors to view historical records.');
    if (year > previous.year) {
      if (term !== 1 || year !== previous.year + 1 || previous.term !== 3) fail('Finish Term 3 and start the next academic year at Term 1.');
      // Only recorded decisions move pupils. Others remain in the same class pending review.
      for (const s of Object.values(this.d.students)) {
        const rec = this.d.promotions[`${previous.year}|${s.id}`];
        if (!rec || rec.applied || s.status !== 'active') continue;
        if (rec.decision === 'promoted') {
          const i = R.CLASSES.indexOf(s.className);
          if (i >= 0 && i < R.CLASSES.length - 1) s.className = R.CLASSES[i + 1];
          else if (i === R.CLASSES.length - 1) { s.status = 'inactive'; s.statusNote = 'Completed Primary 7'; }
        }
        s.classHistory = s.classHistory || {};
        s.classHistory[previous.year] = rec.className;
        s.classHistory[year] = s.className;
        rec.applied = true; rec.appliedAt = nowISO(); this.touch('promotions', rec.key); this.touch('students', s.id);
      }
    }
    this.d.meta.current = { year, term }; this.log('current term', `${year} T${term}`);
    for (const s of Object.values(this.d.students)) if (s.status === 'active') this.bill(s, year, term);   // new term bills use today's class & day/boarding type
    this.touch('meta', 'current'); this.done(); return this.d.meta.current;
  }

  /* ---------- marks from teachers (read-only on this PC) ---------- */
  nextSeq() { return ++this.d.meta.seq; }
  acceptMarks(marks = [], comments = [], device = '') {
    let a = 0;
    for (const m of marks) {
      if (!m || !m.id || !m.studentId || typeof m.at !== 'string') continue;
      if (!m.cleared && !m.absent && !(Number.isFinite(m.score) && m.score >= 0 && m.score <= R.MAX_MARK)) continue;
      const old = this.d.marks[m.id]; if (old && old.at > m.at) continue;
      this.d.marks[m.id] = { id: m.id, year: +m.year, term: +m.term, exam: m.exam, studentId: m.studentId, className: m.className, subject: m.subject, score: m.cleared || m.absent ? null : m.score, absent: !!m.absent, cleared: !!m.cleared, by: String(m.by || device).slice(0, 60), at: m.at, seq: this.nextSeq() };
      this.touch('marks', m.id); a++;
    }
    for (const c of comments) {
      if (!c || !c.id || typeof c.at !== 'string') continue;
      const old = this.d.comments[c.id]; if (old && old.at > c.at) continue;
      this.d.comments[c.id] = { id: c.id, teacher: String(c.teacher ?? '').slice(0, 600), head: String(c.head ?? '').slice(0, 600), at: c.at, seq: this.nextSeq() }; this.touch('comments', c.id); a++;
    }
    if (a) this.done(false); return a;
  }
  saveHeadRemark(id, teacher, head) { this.acceptMarks([], [{ id, teacher, head, at: nowISO() }]); this.s.save(true); }
  marksFor(year) { return Object.values(this.d.marks).filter(m => m.year === Number(year)); }
  getMarks(year) { return { marks: this.marksFor(year), comments: Object.values(this.d.comments).filter(c => c.id.startsWith(year + '|')), promotions: Object.values(this.d.promotions).filter(p => p.year === Number(year)), academic: this.d.academic, students: Object.values(this.d.students).map(s => ({ id: s.id, first: s.first, last: s.last, className: s.className, classHistory: s.classHistory || {}, status: s.status })) }; }
  teacherSnapshot(since) {
    since = Number(since) || 0;
    return { current: this.cur(), academic: this.d.academic, students: Object.values(this.d.students).filter(s => s.status !== 'pending').map(s => ({ id: s.id, first: s.first, last: s.last, className: s.className, classHistory: s.classHistory || {}, status: s.status, year: this.cur().year })),
      promotions: Object.values(this.d.promotions), marks: Object.values(this.d.marks).filter(m => m.seq > since), comments: Object.values(this.d.comments).filter(c => c.seq > since), maxSeq: this.d.meta.seq };
  }
}
module.exports = { HM, Fail, DEFAULTS };
