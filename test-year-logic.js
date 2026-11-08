// The year rules, written from the Headteacher's own example:
//   "Bukenya is promoted in Term 3 EOT 2026 -> in 2027 Bukenya is the ONLY one in the system, in P2."
const assert = require('node:assert/strict'), os = require('os'), path = require('path'), fs = require('fs');
const ExcelJS = require('exceljs');
const R = require('./src/shared/rules');
const { Store } = require('./src/core/store'), { HM, DEFAULTS } = require('./src/core/hm'), { Teacher } = require('./src/core/teacher'), { createApp } = require('./src/core/app');
const NOW = new Date().toISOString();
const mk = (hm, id, y, t, e, sub, score, cls) => hm.acceptMarks([{ id: R.markKey(y, t, e, id, sub), studentId: id, year: y, term: t, exam: e, className: cls, subject: sub, score, at: NOW }]);

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgs-yl-'));
  const hm = new HM(new Store(path.join(dir, 'hm.json'), DEFAULTS));
  hm.setCurrentTerm(2026, 3);
  const add = (first, cls, phone = '') => hm.addApplication({ first, last: 'T', className: cls, phone, paidNow: 30000 }).student;
  const bukenya = add('Bukenya', 'P1', '0772111111'), akello = add('Akello', 'P1', '0772222222'), dungu = add('Dungu', 'P1', '0772333333'),
    eve = add('Eve', 'P1', '0772444444'), gift = add('Gift', 'P7', '0772555555'), hana = add('Hana', 'P2', '0772666666'), ben = add('Ben', 'P3');
  const pendingKid = hm.addApplication({ first: 'Pending', last: 'T', className: 'P1', paidNow: 10000 }).student;
  const teacher = new Teacher(hm, () => 'Mr Okello');
  const S = id => hm.d.students[id];
  const state = (y, t) => hm.getState({ year: y, term: t }).students;
  const inClass = (v, c) => v.filter(s => s.viewClass === c).map(s => s.first).sort();
  const names = v => v.filter(s => s.inYear && s.status !== 'pending').map(s => s.first).sort();

  // ---------- 2026: everybody is in 2026, nobody is in 2027 yet ----------
  assert.deepEqual(names(state(2026, 3)), ['Akello', 'Ben', 'Bukenya', 'Dungu', 'Eve', 'Gift', 'Hana']);
  assert.deepEqual(names(state(2027, 1)), [], 'before the year changes, 2027 is empty');
  assert.equal(state(2027, 1).filter(s => s.fee.has).length, 0, 'no 2027 fee bills exist yet');

  // ---------- promotion needs Term 3 EOT marks (strictly) ----------
  assert.throws(() => teacher.setPromotion({ studentId: bukenya.id, year: 2026, term: 3, decision: 'promoted' }), /End of Term/);
  mk(hm, bukenya.id, 2026, 3, 'BOT', 'Mathematics', 90, 'P1');           // a BOT mark is NOT enough
  mk(hm, bukenya.id, 2026, 3, 'MID', 'Mathematics', 90, 'P1');           // neither is MID
  assert.throws(() => teacher.setPromotion({ studentId: bukenya.id, year: 2026, term: 3, decision: 'promoted' }), /End of Term/);
  mk(hm, bukenya.id, 2026, 2, 'EOT', 'Mathematics', 90, 'P1');           // nor an EOT of Term 2
  assert.throws(() => teacher.setPromotion({ studentId: bukenya.id, year: 2026, term: 3, decision: 'promoted' }), /End of Term/);
  for (const s of [bukenya, akello, dungu, gift, hana, ben]) mk(hm, s.id, 2026, 3, 'EOT', 'Mathematics', 70, S(s.id).className);   // Eve has none
  assert.throws(() => teacher.setPromotion({ studentId: eve.id, year: 2026, term: 3, decision: 'promoted' }), /End of Term/);
  assert.throws(() => teacher.setPromotion({ studentId: pendingKid.id, year: 2026, term: 3, decision: 'promoted' }));
  assert.throws(() => hm.recordPromotion({ studentId: bukenya.id, year: 2026, term: 2, decision: 'promoted' }), /Term 3 only/);
  assert.throws(() => teacher.setPromotion({ studentId: bukenya.id, year: 2026, term: 3, decision: 'maybe' }), /Promoted or Repeat/);

  teacher.setPromotion({ studentId: bukenya.id, year: 2026, term: 3, decision: 'promoted' });
  teacher.setPromotion({ studentId: akello.id, year: 2026, term: 3, decision: 'repeat' });
  teacher.setPromotion({ studentId: gift.id, year: 2026, term: 3, decision: 'promoted' });     // P7 -> leaves
  teacher.setPromotion({ studentId: hana.id, year: 2026, term: 3, decision: 'promoted' });
  teacher.setPromotion({ studentId: ben.id, year: 2026, term: 3, decision: 'promoted' });
  teacher.clearPromotion({ studentId: ben.id, year: 2026 });                                     // changed her mind: undo
  assert.equal(hm.d.promotions[`2026|${ben.id}`].decision, 'none');
  // Hana's EOT marks are removed afterwards: her decision must stop counting
  hm.acceptMarks([{ id: R.markKey(2026, 3, 'EOT', hana.id, 'Mathematics'), studentId: hana.id, year: 2026, term: 3, exam: 'EOT', className: 'P2', subject: 'Mathematics', cleared: true, at: new Date(Date.now() + 5).toISOString() }]);

  const pv = hm.newYearPreview();
  assert.deepEqual([pv.promoted, pv.repeat, pv.graduating, pv.undecided], [2, 1, 1, 4]);   // Bukenya+Gift / Akello / Gift / Dungu,Eve,Hana,Ben
  assert.deepEqual(pv.undecidedList.map(x => x.name.split(' ')[0]).sort(), ['Ben', 'Dungu', 'Eve', 'Hana']);
  assert.match(pv.undecidedList.find(x => x.name.startsWith('Eve')).reason, /no Term 3 End-of-Term marks/);
  assert.deepEqual([hm.promoProgress().promoted, hm.promoProgress().undecided], [2, 4]);

  // ---------- the Headteacher starts 2027 ----------
  const before2026 = state(2026, 3).filter(s => s.fee.has).map(s => s.first).sort();
  assert.deepEqual(hm.startNewYear(), { year: 2027, term: 1 });
  assert.deepEqual(names(state(2027, 1)), ['Akello', 'Bukenya'], 'ONLY promoted / repeating learners are in 2027');
  assert.equal(S(bukenya.id).className, 'P2'); assert.equal(S(akello.id).className, 'P1');
  assert.deepEqual(inClass(state(2027, 1), 'P2'), ['Bukenya']);
  assert.deepEqual(inClass(state(2027, 1), 'P1'), ['Akello']);
  assert.deepEqual(inClass(state(2027, 1), 'P3'), [], 'Ben (no decision) is not in P3 2027 and not in P3 2026-as-2027');
  // fees sheet: only the two
  assert.deepEqual(state(2027, 1).filter(s => s.inYear && s.fee.has).map(s => s.first).sort(), ['Akello', 'Bukenya']);
  assert.equal(state(2027, 1).find(s => s.id === bukenya.id).fee.due, 250000);
  // 2026 stays exactly as it was
  assert.deepEqual(names(state(2026, 3)), ['Akello', 'Ben', 'Bukenya', 'Dungu', 'Eve', 'Gift', 'Hana']);
  assert.deepEqual(state(2026, 3).filter(s => s.fee.has).map(s => s.first).sort(), before2026);
  assert.deepEqual(inClass(state(2026, 3), 'P1'), ['Akello', 'Bukenya', 'Dungu', 'Eve']);
  assert.equal(state(2026, 3).find(s => s.id === bukenya.id).viewClass, 'P1', 'in 2026 Bukenya was in P1');
  // the ones left behind cannot leak anywhere
  for (const s of [dungu, eve, hana, ben, gift]) { assert.equal(S(s.id).status, 'inactive'); assert.equal(hm.classFor(S(s.id), 2027), null); assert.equal(hm.d.bills[`2027|1|${s.id}`], undefined, 'no 2027 bill for ' + s.first); }
  for (const s of [dungu, eve, hana, ben]) assert.equal(S(s.id).notCarriedInto, 2027);
  assert.equal(S(gift.id).statusNote, 'Completed Primary 7');
  // SMS lists, discipline pickers use only the school's current learners
  hm.saveNotification({ category: 'Custom', subject: 'Hello', message: 'Hi {parent}', recipients: 'all' });
  const rec = Object.values(hm.d.notifications)[0];
  assert.deepEqual(hm.notificationRecipients(rec).map(r => r.student).sort(), ['Akello T', 'Bukenya T']);

  // ---------- Teachers' portal in 2027 ----------
  const ts = teacher.state();
  assert.deepEqual(ts.students.filter(s => s.inYear).map(s => s.first).sort(), ['Akello', 'Bukenya']);
  assert.deepEqual(R.rosterFor(ts.students, ts.marks, 2027, 'P2', 2027).map(s => s.first), ['Bukenya']);
  assert.deepEqual(R.rosterFor(ts.students, ts.marks, 2027, 'P1', 2027).map(s => s.first), ['Akello']);
  assert.deepEqual(R.rosterFor(ts.students, ts.marks, 2026, 'P1', 2027).map(s => s.first).sort(), ['Akello', 'Bukenya', 'Dungu', 'Eve'], '2026 roster unchanged');
  assert.throws(() => teacher.setMark({ year: 2027, term: 1, exam: 'BOT', studentId: dungu.id, className: 'P1', subject: 'English', score: 50 }), /not in the school in 2027/);
  assert.throws(() => teacher.setMark({ year: 2028, term: 1, exam: 'BOT', studentId: bukenya.id, className: 'P2', subject: 'English', score: 50 }), /not started/);
  teacher.setMark({ year: 2027, term: 1, exam: 'BOT', studentId: bukenya.id, className: 'P2', subject: 'English', score: 81 });
  assert.equal(hm.d.marks[R.markKey(2027, 1, 'BOT', bukenya.id, 'English')].score, 81, 'mark is in the school records at once');
  assert.equal(hm.d.marks[R.markKey(2027, 1, 'BOT', bukenya.id, 'English')].by, 'Mr Okello');
  teacher.setMark({ year: 2026, term: 3, exam: 'EOT', studentId: dungu.id, className: 'P1', subject: 'English', score: 66 });   // 2026 marks can still be corrected for 2026 members
  assert.throws(() => teacher.setPromotion({ studentId: bukenya.id, year: 2027, term: 3, decision: "promoted" }), /current academic year in Term 3/);
  assert.throws(() => teacher.setPromotion({ studentId: dungu.id, year: 2026, term: 3, decision: 'promoted' }), /current academic year in Term 3/);
  const lists = new ExcelJS.Workbook(); await lists.xlsx.load(Buffer.from((await teacher.exportClassLists()).data, 'base64'));
  assert.equal(lists.getWorksheet('P2').getCell(6, 2).value, bukenya.id); assert.equal(lists.getWorksheet('P3').getCell(6, 2).value, null);
  assert.equal(lists.getWorksheet('All classes').getCell(5 + R.CLASSES.length, 2).value, 2, 'class-list total = 2');
  await assert.rejects(teacher.exportMarksSheet({ year: 2027, term: 1, exam: 'BOT', cls: 'P3' }), /no students in this class/);

  // ---------- new children and explicit re-enrolment ----------
  const nw = hm.addApplication({ first: 'Newcomer', last: 'T', className: 'Baby Class', paidNow: 30000 }).student;
  assert.ok(nw.id.startsWith('BGS/2027/')); assert.equal(hm.classFor(S(nw.id), 2026), null); assert.equal(hm.classFor(S(nw.id), 2027), 'Baby Class');
  assert.deepEqual(names(state(2027, 1)), ['Akello', 'Bukenya', 'Newcomer']);
  assert.equal(hm.d.bills[`2027|1|${nw.id}`].due, 200000);
  hm.setStudentStatus(dungu.id, 'active', 'Parent came with the report');
  assert.equal(hm.classFor(S(dungu.id), 2027), 'P1'); assert.ok(hm.d.bills[`2027|1|${dungu.id}`]); assert.equal(S(dungu.id).notCarriedInto, undefined);
  assert.deepEqual(inClass(state(2027, 1), 'P1'), ['Akello', 'Dungu']);

  // ---------- later terms keep the same people ----------
  hm.setCurrentTerm(2027, 2);
  assert.deepEqual(state(2027, 2).filter(s => s.inYear && s.fee.has).map(s => s.first).sort(), ['Akello', 'Bukenya', 'Dungu', 'Newcomer']);

  // ---------- old data (before this version) is understood ----------
  const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'bgs-yl2-'));
  const old = new HM(new Store(path.join(dir2, 'hm.json'), DEFAULTS)); old.setCurrentTerm(2026, 3);
  const o1 = old.addApplication({ first: 'Old', last: 'One', className: 'P4', paidNow: 30000 }).student;
  for (const s of Object.values(old.d.students)) delete s.classHistory; old.d.meta.schema = 0;
  old.s.save(true);
  const reopened = new HM(new Store(path.join(dir2, 'hm.json'), DEFAULTS));
  assert.equal(reopened.classFor(reopened.d.students[o1.id], 2026), 'P4'); assert.equal(reopened.getState().students.filter(s => s.inYear).length, 1);

  // ---------- one computer, two logins (the "failed to connect" fix) ----------
  const app = createApp({ dataDir: path.join(dir, 'app'), backupDir: path.join(dir, 'bk') });
  const call = async (a, x) => app.call(a, x), ok = async (a, x) => { const r = await call(a, x); assert.equal(r.ok, true, a + ': ' + r.error); return r.data; }, bad = async (a, x, re) => { const r = await call(a, x); assert.equal(r.ok, false, a + ' should be refused'); if (re) assert.match(r.error, re); };
  await bad('hm.state', {}, /log in/); await bad('t.state', {}, /log in/);
  await ok('auth.setup', { role: 'hm', pw: 'headpass1' });
  await ok('hm.setCurrentTerm', { year: 2026, term: 3 });
  const a1 = (await ok('hm.addApplication', { first: 'Lone', last: 'Pupil', className: 'P2', paidNow: 30000 })).student;
  await bad('t.state', {}, /Teachers login/); await ok('auth.logout');
  await bad('hm.state', {}, /log in/);
  await bad('auth.login', { role: 'teacher', pw: 'x', name: 'A' }, /password first/);
  await bad('auth.setup', { role: 'teacher', pw: 'short', name: 'Ms Auma' }, /8 characters/);
  await bad('auth.setup', { role: 'teacher', pw: 'teachpass1', name: '' }, /name/);
  await ok('auth.setup', { role: 'teacher', pw: 'teachpass1', name: 'Ms Auma' });
  await bad('hm.state', {}, /Headteacher login/); await bad('hm.newYear', { confirm: true }, /Headteacher login/); await bad('settings.get', {}, /Headteacher login/);
  assert.ok(!JSON.stringify(await ok('t.state')).match(/phone|salary|0772|balance/i), 'teachers never see fees, phones or salaries');
  await ok('t.setMark', { year: 2026, term: 3, exam: 'EOT', studentId: a1.id, className: 'P2', subject: 'English', score: 77 });
  await ok('t.setPromotion', { studentId: a1.id, year: 2026, term: 3, decision: 'promoted' });
  await ok('auth.logout'); await bad('auth.login', { role: 'teacher', pw: 'nope', name: 'Ms Auma' }, /Wrong password/);
  await ok('auth.login', { role: 'hm', pw: 'headpass1' });
  assert.equal((await ok('hm.marks', { year: 2026 })).marks.length, 1, 'the Headteacher sees the teacher\'s mark immediately');
  assert.equal((await ok('hm.state', {})).promoProgress.promoted, 1);
  assert.equal((await ok('hm.newYearPreview')).promoted, 1);
  await bad('hm.newYear', {}, /confirm/);
  await ok('hm.newYear', { confirm: true });
  assert.equal((await ok('hm.state', {})).students.find(s => s.id === a1.id).viewClass, 'P3');
  await ok('teachers.resetPassword'); await ok('auth.logout');
  await ok('auth.setup', { role: 'teacher', pw: 'brandnew99', name: 'Mr Okello' });
  assert.equal((await ok('t.state')).cfg.teacher, 'Mr Okello');
  app.shutdown();
  // older installs that were set up as "Headteacher's PC" open as normal, with their data
  const app2 = createApp({ dataDir: path.join(dir, 'app'), backupDir: path.join(dir, 'bk') });
  assert.equal(app2.A.mode, 'single'); await ok2(app2, 'auth.login', { role: 'hm', pw: 'headpass1' }); app2.shutdown();
  async function ok2(a, act, x) { const r = await a.call(act, x); assert.equal(r.ok, true, r.error); }
  fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(dir2, { recursive: true, force: true });
  console.log('year logic / one-computer roles OK');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
