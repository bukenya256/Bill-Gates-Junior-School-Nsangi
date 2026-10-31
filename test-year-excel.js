// Tests for: 10-digit phone rule, subjects reaching the Teachers' PC, the New Year button (promotions /
// repeats / history), and the Excel class lists + marks sheet upload.
const assert = require('node:assert/strict'), os = require('os'), path = require('path'), fs = require('fs');
const ExcelJS = require('exceljs');
const R = require('./src/shared/rules');
const { Store } = require('./src/core/store'), { HM, DEFAULTS } = require('./src/core/hm'), { startServer } = require('./src/core/server'), { Teacher, DEFAULTS: TD } = require('./src/core/teacher');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const until = async (f, ms = 6000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await f()) return true; await sleep(100); } return false; };

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgs-ye-'));
  const hm = new HM(new Store(path.join(dir, 'hm.json'), DEFAULTS));
  hm.setCurrentTerm(2026, 3);

  // ---------- 1. phone numbers: exactly 10 digits ----------
  const add = (first, cls, phone, paid = 30000) => hm.addApplication({ first, last: 'Test', className: cls, phone, paidNow: paid }).student;
  for (const bad of ['077212345', '07721234567', '+256772123456', '07721abc45', '0772 12345']) assert.throws(() => add('X', 'P1', bad), /exactly 10 digits/, bad);
  assert.equal(Object.keys(hm.d.students).length, 0, 'a rejected phone must not leave a half-saved application');
  const bukenya = add('Bukenya', 'Baby Class', '0772123456');
  assert.equal(bukenya.phone, '0772123456');
  assert.equal(add('Spaces', 'P1', '0772 123 456').phone, '0772123456');
  assert.equal(add('NoPhone', 'P1', '').phone, '');
  hm.updateStudent(bukenya.id, { first: 'Bukenya', last: 'Test', phone: '0701000000' });
  assert.throws(() => hm.updateStudent(bukenya.id, { phone: '12345' }), /10 digits/);
  assert.equal(hm.d.students[bukenya.id].phone, '0701000000');
  hm.d.students[bukenya.id].phone = '+256 700 111 222';            // an old record in the old format can still be edited
  hm.updateStudent(bukenya.id, { first: 'Bukenya', phone: '+256 700 111 222' });
  hm.updateStudent(bukenya.id, { phone: '0700111222' });

  // ---------- 2. network: subjects + year reach the Teachers' PC ----------
  const srv = startServer(hm, 4811);
  const t = new Teacher(new Store(path.join(dir, 't.json'), TD), () => { }, { discoveryPort: 4812 });
  t.setConfig({ hm: '127.0.0.1:4811', key: hm.d.meta.lanKey, teacher: 'Mr Okello' });
  assert(await until(() => t.conn.state === 'online'), 'teacher connects');
  hm.setSubjects('P1', ['Mathematics', 'English', 'Science', 'Handwriting']);
  await t.sync();
  assert.deepEqual(t.state().academic.subjects.P1, ['Mathematics', 'English', 'Science', 'Handwriting'], 'new subject reached the teacher PC');

  // ---------- 3. a class with marks, promotions, then NEW YEAR ----------
  const names = ['Akello', 'Babirye', 'Chandiru', 'Dungu'];
  const p1 = names.map(n => add(n, 'P1', '07000000' + names.indexOf(n) + '1'));
  await t.sync(); assert.equal(t.d.students.length, 1 + 1 + 1 + 4);
  const subjects = R.subjectsFor('P1');
  const eot = { year: 2026, term: 3, exam: 'EOT', cls: 'P1' };

  // excel: class lists
  const lists = Buffer.from((await t.exportClassLists()).data, 'base64');
  const wbL = new ExcelJS.Workbook(); await wbL.xlsx.load(lists);
  assert.equal(wbL.worksheets.length, 1 + R.CLASSES.length);
  assert.equal(wbL.getWorksheet('P1').getCell(6, 2).value, p1[0].id);
  assert.equal(wbL.getWorksheet('Baby Class').getCell(6, 3).value, 'Test');

  // excel: marks sheet -> teachers fill -> upload
  const sheetFile = await t.exportMarksSheet(eot); assert(/P1-Marks-Term3-EOT-2026\.xlsx$/.test(sheetFile.name));
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(Buffer.from(sheetFile.data, 'base64'));
  const ws = wb.worksheets[0];
  assert.equal(ws.getCell(3, 2).value, 'P1'); assert.equal(ws.getCell(3, 4).value, 2026);
  let hdr = 6; assert.equal(ws.getCell(hdr, 2).value, 'Admission No.');
  const colOf = s => { for (let c = 5; c <= 5 + subjects.length; c++) if (ws.getCell(hdr, c).value === s) return c; throw new Error('no col ' + s); };
  const rowOf = id => { for (let r = 7; r < 7 + 20; r++) if (ws.getCell(r, 2).value === id) return r; throw new Error('no row ' + id); };
  const [akello, babirye, chandiru, dungu] = p1;
  // only the MATHS teacher brings the sheet back (other subject columns empty)
  ws.getCell(rowOf(akello.id), colOf('Mathematics')).value = 91;
  ws.getCell(rowOf(babirye.id), colOf('Mathematics')).value = '67.5';          // typed as text
  ws.getCell(rowOf(chandiru.id), colOf('Mathematics')).value = 'A';            // absent
  ws.getCell(rowOf(dungu.id), colOf('Mathematics')).value = 140;               // invalid
  ws.getCell(rowOf(akello.id), colOf('English')).value = 'abc';                // invalid
  const unknown = ws.getRow(7 + 8); unknown.getCell(2).value = 'BGS/2026/999'; unknown.getCell(colOf('Mathematics')).value = 50;
  const filled = Buffer.from(await wb.xlsx.writeBuffer()).toString('base64');

  // a sheet for the wrong exam/class is refused
  await assert.rejects(t.previewMarksImport({ ...eot, exam: 'BOT', data: filled }), /different class or exam/);
  await assert.rejects(t.previewMarksImport({ ...eot, cls: 'P2', data: filled }), /different class or exam/);
  await assert.rejects(t.previewMarksImport({ ...eot, data: Buffer.from('not excel').toString('base64') }), /not a readable Excel/);

  const pv = await t.previewMarksImport({ ...eot, data: filled });
  assert.equal(pv.toSave, 3); assert.equal(pv.fresh, 3); assert.equal(pv.absent, 1); assert.equal(pv.errorCount, 3);
  assert.deepEqual(pv.subjects.slice().sort(), subjects.slice().sort());
  assert.equal(Object.keys(t.d.marks).length, 0, 'preview must not save anything');
  const ap = t.applyMarksImport({ token: pv.token }); assert.equal(ap.saved, 3);
  assert.throws(() => t.applyMarksImport({ token: pv.token }), /expired/);
  assert.equal(t.d.marks[R.markKey(2026, 3, 'EOT', akello.id, 'Mathematics')].score, 91);
  assert.equal(t.d.marks[R.markKey(2026, 3, 'EOT', babirye.id, 'Mathematics')].score, 67.5);
  assert.equal(t.d.marks[R.markKey(2026, 3, 'EOT', chandiru.id, 'Mathematics')].absent, true);
  assert(await until(() => t.pending() === 0), 'marks reach HM PC');
  assert.equal(hm.d.marks[R.markKey(2026, 3, 'EOT', akello.id, 'Mathematics')].score, 91, 'marks arrived on the Headteacher PC');
  // uploading the same sheet again changes nothing; re-download shows entered marks
  const pv2 = await t.previewMarksImport({ ...eot, data: filled }); assert.equal(pv2.toSave, 0); assert.equal(pv2.same, 3);
  const re = new ExcelJS.Workbook(); await re.xlsx.load(Buffer.from((await t.exportMarksSheet(eot)).data, 'base64'));
  assert.equal(re.worksheets[0].getCell(rowOf(akello.id), colOf('Mathematics')).value, 91);
  // manual entry still works and a different mark replaces
  t.setMark({ ...eot, studentId: dungu.id, className: 'P1', subject: 'Mathematics', score: 55 });
  const pv3 = await t.previewMarksImport({ ...eot, data: filled }); assert.equal(pv3.changed, 0);
  // finish marks for the promotion rule (everyone needs EOT marks)
  for (const s of p1) t.setMark({ ...eot, studentId: s.id, className: 'P1', subject: 'English', score: 60 });
  for (const s of [bukenya]) t.setMark({ year: 2026, term: 3, exam: 'EOT', studentId: s.id, className: 'Baby Class', subject: 'English', score: 70 });
  await t.sync();

  // teacher decisions: promotion needs EOT marks (teacher side check)
  assert.throws(() => t.setPromotion({ studentId: Object.values(hm.d.students).find(s => s.first === 'NoPhone').id, year: 2026, term: 3, decision: 'promoted' }), /End of Term marks first/);
  t.setPromotion({ studentId: bukenya.id, year: 2026, term: 3, decision: 'promoted' });
  t.setPromotion({ studentId: akello.id, year: 2026, term: 3, decision: 'promoted' });
  t.setPromotion({ studentId: babirye.id, year: 2026, term: 3, decision: 'repeat' });
  t.setPromotion({ studentId: chandiru.id, year: 2026, term: 3, decision: 'repeat' });
  // dungu: no decision at all
  assert(await until(() => Object.keys(hm.d.promotions).length === 4), 'decisions reach HM');

  const pre = hm.newYearPreview();
  assert.deepEqual([pre.from, pre.to, pre.canStart, pre.promoted, pre.repeat], [2026, 2027, true, 2, 2]);
  assert.equal(pre.undecided, pre.undecidedNames.length); assert(pre.undecided >= 1);

  const pending = hm.addApplication({ first: 'Pending', last: 'Applicant', className: 'P1', paidNow: 10000 }).student;
  const cur = hm.startNewYear();
  assert.deepEqual(cur, { year: 2027, term: 1 });
  const S = id => hm.d.students[id];
  assert.equal(S(bukenya.id).className, 'Middle Class', 'Bukenya was promoted -> Middle Class');
  assert.equal(S(akello.id).className, 'P2');
  assert.equal(S(babirye.id).className, 'P1', 'repeater stays');
  assert.equal(S(chandiru.id).className, 'P1', 'repeater stays');
  assert.equal(S(dungu.id).className, 'P1', 'undecided stays');
  assert.equal(S(bukenya.id).classHistory[2026], 'Baby Class'); assert.equal(S(bukenya.id).classHistory[2027], 'Middle Class');
  assert.equal(S(dungu.id).classHistory[2026], 'P1');
  assert(Object.values(hm.d.promotions).every(p => p.applied));
  assert.throws(() => hm.startNewYear(), /Term 3/, 'cannot start another year from Term 1');

  // a child admitted in 2027
  const nw = hm.addApplication({ first: 'Newcomer', last: 'Test', className: 'Baby Class', phone: '0777000111', paidNow: 30000 }).student;
  assert(nw.id.startsWith('BGS/2027/'));
  const v27 = hm.getState({ year: 2027, term: 1 }).students, v26 = hm.getState({ year: 2026, term: 3 }).students;
  const cls = (v, id) => v.find(s => s.id === id).viewClass;
  assert.equal(cls(v27, bukenya.id), 'Middle Class'); assert.equal(cls(v26, bukenya.id), 'Baby Class', '2026 shows Bukenya as he was');
  assert.equal(cls(v26, akello.id), 'P1'); assert.equal(cls(v27, akello.id), 'P2');
  assert.equal(cls(v27, nw.id), 'Baby Class'); assert.equal(cls(v26, nw.id), null, 'child admitted in 2027 is not in 2026');
  const inClass = (v, c) => v.filter(s => s.viewClass === c).map(s => s.first).sort();
  assert.deepEqual(inClass(v27, 'P1'), ['Babirye', 'Chandiru', 'Dungu', 'NoPhone', 'Spaces'], 'only repeaters / undecided remain in P1 in 2027');
  assert(!inClass(v27, 'P1').includes('Akello') && inClass(v27, 'P2').includes('Akello'));
  assert(inClass(v26, 'P1').includes('Akello') && inClass(v26, 'P1').includes('Dungu'));
  // fees: 2026 bill unchanged (Baby/nursery fee), 2027 bill follows the new class
  assert.equal(hm.d.bills[`2026|3|${akello.id}`].className, 'P1');
  assert.equal(hm.d.bills[`2027|1|${akello.id}`].className, 'P2');
  // old marks and reports for 2026 still come out right (roster by 2026 class)
  await t.sync();
  assert.deepEqual([t.state().current.year, t.state().current.term], [2027, 1], 'teacher PC followed to 2027');
  const marks26 = Object.values(t.d.marks);
  const r26 = R.rosterFor(t.d.students, marks26, 2026, 'P1', 2027).map(s => s.first).sort();
  assert(r26.includes('Akello') && r26.includes('Babirye') && r26.includes('Dungu'), '2026 P1 roster is complete: ' + r26);
  const r27p1 = R.rosterFor(t.d.students, marks26, 2027, 'P1', 2027).map(s => s.first);
  assert(!r27p1.includes('Akello') && r27p1.includes('Babirye'), '2027 P1 = repeaters only: ' + r27p1);
  assert(R.rosterFor(t.d.students, marks26, 2027, 'P2', 2027).some(s => s.first === 'Akello'));
  assert(R.rosterFor(t.d.students, marks26, 2027, 'Middle Class', 2027).some(s => s.first === 'Bukenya'));
  assert(!R.rosterFor(t.d.students, marks26, 2026, 'Baby Class', 2027).some(s => s.first === 'Newcomer'));
  // the teacher can now enter 2027 marks for the new roster via excel
  const sh = await t.exportMarksSheet({ year: 2027, term: 1, exam: 'BOT', cls: 'P2' });
  const w2 = new ExcelJS.Workbook(); await w2.xlsx.load(Buffer.from(sh.data, 'base64')); assert.equal(w2.worksheets[0].getCell(7, 2).value, akello.id);

  // ---------- 4. a rejected promotion must not block marks ----------
  t.d.promotions['2027|bad'] = { key: '2027|bad', studentId: akello.id, year: 2027, term: 3, decision: 'promoted', at: new Date().toISOString() }; t.d.unsynced.promotions['2027|bad'] = 1;
  t.setMark({ year: 2027, term: 1, exam: 'BOT', studentId: akello.id, className: 'P2', subject: 'English', score: 80 });
  assert(await until(() => t.pending() === 0), 'marks flow even if one promotion is rejected');
  assert(hm.d.marks[R.markKey(2027, 1, 'BOT', akello.id, 'English')]);
  assert(t.d.promoErrors['2027|bad']);

  t.stop(); srv.close();
  console.log('year/excel/phone OK');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
