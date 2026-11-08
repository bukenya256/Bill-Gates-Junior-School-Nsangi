const tabIcon = k => `<img class="tab-icon" src="${({"dashboard":"../assets/dashboard.png","applications":"../assets/applications.png","students":"../assets/students.png","classes":"../assets/classes.jpeg","discipline":"../assets/discipline.png","fees":"../assets/fees.png","staff":"../assets/staff.svg","receipts":"../assets/receipts.png","reports":"../assets/reports.png","settings":"../assets/settings.png","logout":"../assets/logout.png","login":"../assets/login.png","school":"../assets/bgs-icon.png","marks":"../assets/reports.png","promotions":"../assets/grading.png","conn":"../assets/settings.png"})[k] || "../assets/school.png"}" alt="">`;
'use strict';
const T = { page: 'marks', st: null, year: null, term: null, exam: 'BOT', cls: 'P1', subject: null };
const root = $('#root'); let rv = null;
const NAV = [['marks', 'Enter Marks'], ['reports', 'Report Cards & Class Results'], ['students', 'Student List'], ['promotions', 'Term 3 Promotions']];

async function boot() {
  const a = await api('auth.status');
  if (a.role !== 'teacher') { location.replace('../login.html'); return; }
  T.st = await api('t.state');
  configureAcademics(T.st.academic?.subjects, T.st.academic?.grades);
  T.year = T.st.current.year; T.term = T.st.current.term;
  root.innerHTML = `<div class="app"><aside class="side"><div class="brand"><i><img class="school-icon" src="../assets/bgs-icon.png" alt=""></i><div>Bill Gates Junior<small>Nsangi · Teachers</small></div></div><nav class="nav" id="nav"></nav>
  <div class="bottom"><button id="teacherLock">${tabIcon("logout")} Log out</button><div id="who" style="color:#9db6d8;font-size:.8rem;padding:0 6px 8px"></div></div></aside><section class="main"><div class="top"><b style="color:var(--navy)" id="ttl"></b><span class="sp"></span><span id="conn"></span></div><div class="page" id="page"></div></section></div>`;
  $('#teacherLock').onclick = async () => { await api('auth.logout'); location.replace('../login.html'); };
  draw();
}
function paintConn() {
  const el = $('#conn'); if (!el) return;
  el.innerHTML = `<span class="syncdot c-green">${T.st.current.year} · Term ${T.st.current.term} · marks are saved straight into the school records</span>`;
  $('#who').textContent = T.st.cfg.teacher || '';
}
function draw() {
  $('#nav').innerHTML = NAV.map(n => `<button data-p="${n[0]}" class="${T.page === n[0] ? 'on' : ''}">${tabIcon(n[0])}${n[1]}</button>`).join('');
  $$('#nav button').forEach(b => b.onclick = () => { T.page = b.dataset.p; rv = null; draw(); });
  $('#ttl').textContent = NAV.find(n => n[0] === T.page)[1]; paintConn(); PG[T.page]();
}
const page = h => { $('#page').innerHTML = h; };
const yearsList = () => { const a = []; for (let y = T.st.current.year; y >= 2026; y--) a.push(y); return a; };

const PG = {
  marks() {
    const st = T.st, subs = subjectsFor(T.cls); if (!subs.includes(T.subject)) T.subject = subs[0];
    const map = marksToMap(st.marks), roster = rosterFor(st.students, st.marks, T.year, T.cls, st.current.year).filter(s => T.year !== st.current.year || st.students.find(x => x.id === s.id && x.status === 'active') || st.marks.some(m => m.studentId === s.id && m.year === T.year));
    const done = () => roster.filter(s => { const m = marksToMap(T.st.marks).get(markKey(T.year, T.term, T.exam, s.id, T.subject)); return m && !m.cleared; }).length;
    page(`<div class="card"><div class="bar" style="margin:0">
      <div><label>Year</label><select id="y">${yearsList().map(y => `<option ${y === T.year ? 'selected' : ''}>${y}</option>`).join('')}</select></div><div><label>Term</label><select id="t">${[1, 2, 3].map(t => `<option value="${t}" ${t === T.term ? 'selected' : ''}>Term ${t}</option>`).join('')}</select></div>
      <div><label>Examination</label><select id="e">${EXAMS.map(e => `<option value="${e.id}" ${e.id === T.exam ? 'selected' : ''}>${e.name}</option>`).join('')}</select></div><div><label>Class</label><select id="c">${CLASSES.map(c => `<option ${c === T.cls ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div><label>Subject</label><select id="s">${subs.map(s => `<option ${s === T.subject ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div></div></div>
    <div class="banner info">Type each mark (0–100) and press <b>Enter</b> to go to the next student. Every mark is saved straight into the school records as soon as you press Enter. Tick <b>Absent</b> if the child missed the paper.</div>
    <div class="card xl"><div class="bar" style="margin:0"><b>Excel</b><button id="dlsheet">⬇ Download marks sheet for ${esc(T.cls)}</button><button class="pri" id="upsheet">⬆ Upload filled marks sheet</button><span class="muted">Give the downloaded sheet to the class teachers. When they bring it back filled in, upload it here for <b>${esc(T.cls)} · ${EXAMS.find(e => e.id === T.exam).short} · Term ${T.term} ${T.year}</b> and the marks enter by themselves. You can still type marks by hand below.</span></div></div>
    <div class="pagehead"><h3>${esc(T.cls)} · ${esc(T.subject)} · ${EXAMS.find(e => e.id === T.exam).short} Term ${T.term} ${T.year}</h3><span class="sp"></span><span id="prog" class="chip c-blue"></span></div>
    ${roster.length ? `<table class="t"><thead><tr><th>#</th><th>Student</th><th>Admission No.</th><th style="width:120px">Mark / 100</th><th>Absent</th><th>Grade</th><th></th></tr></thead><tbody>${roster.map((s, i) => { const m = map.get(markKey(T.year, T.term, T.exam, s.id, T.subject)), has = m && !m.cleared; return `<tr data-sid="${esc(s.id)}"><td>${i + 1}</td><td><b>${esc(s.last)}</b> ${esc(s.first)}</td><td>${esc(s.id)}</td><td><input class="markin" inputmode="numeric" value="${has && !m.absent ? m.score : ''}" ${has && m.absent ? 'disabled' : ''}></td><td><input type="checkbox" class="abs" ${has && m.absent ? 'checked' : ''}></td><td class="gr">${has && !m.absent ? gradeChip(m.score) : ''}</td><td class="sv muted">${has ? '✓ saved' : ''}</td></tr>`; }).join('')}</tbody></table>` : `<div class="empty">No students in ${esc(T.cls)} in ${T.year}.</div>`}`);
    $('#dlsheet').onclick = () => run(async () => { const f = await api('t.exportMarksSheet', { year: T.year, term: T.term, exam: T.exam, cls: T.cls }); await saveXlsx(f); });
    $('#upsheet').onclick = () => run(async () => {
      const f = await window.bgs.openFile(); if (!f.ok) { if (f.error) throw new Error(f.error); return; }
      const pv = await api('t.previewMarksImport', { year: T.year, term: T.term, exam: T.exam, cls: T.cls, data: f.data });
      showImportPreview(pv, f.name);
    });
    const prog = () => { $('#prog').textContent = `${done()} of ${roster.length} entered`; }; prog();
    for (const [id, k] of [['y', 'year'], ['t', 'term'], ['e', 'exam'], ['c', 'cls'], ['s', 'subject']]) $('#' + id).onchange = e => { T[k] = ['year', 'term'].includes(k) ? +e.target.value : e.target.value; PG.marks(); };
    const inputs = $$('.markin');
    $$('tr[data-sid]').forEach((tr, i) => {
      const inp = $('.markin', tr), ab = $('.abs', tr), sid = tr.dataset.sid, sv = $('.sv', tr), gr = $('.gr', tr);
      const save = async patch => {
        try { const rec = await api('t.setMark', { year: T.year, term: T.term, exam: T.exam, studentId: sid, className: T.cls, subject: T.subject, ...patch }); T.st.marks = T.st.marks.filter(m => m.id !== rec.id).concat(rec); sv.textContent = rec.cleared ? '' : '✓ saved'; gr.innerHTML = rec.absent || rec.cleared ? '' : gradeChip(rec.score); prog(); }
        catch (err) { sv.innerHTML = `<span class="owe">${esc(err.message)}</span>`; }
      };
      inp.onchange = () => { const v = inp.value.trim(); if (v === '') return save({ cleared: true }); const n = Number(v); if (!/^\d+(\.\d)?$/.test(v) || n > 100) { sv.innerHTML = '<span class="owe">Enter 0–100</span>'; inp.select(); return; } save({ score: n }); };
      inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); inp.onchange(); (inputs[i + 1] || inp).focus(); (inputs[i + 1] || inp).select(); } };
      inp.onfocus = () => inp.select();
      ab.onchange = () => { inp.disabled = ab.checked; if (ab.checked) { inp.value = ''; save({ absent: true }); } else save({ cleared: true }); };
    });
  },
  async reports() {
    page('<div id="rv"></div>');
    rv = ReportsView($('#rv'), { note: 'Print any learner\'s report card, or the whole class results sheet. Reports use the marks saved in the school records.', getData: async y => { const s = await api('t.state'); T.st = s; return { students: s.students, marks: s.marks.filter(m => m.year === y), comments: s.comments.filter(c => c.id.startsWith(y + '|')), promotions: s.promotions.filter(p => p.year === y), academic: s.academic, current: s.current }; }, saveRemark: (id, teacher, head) => api('t.setComment', { id, teacher, head }) });
    await rv.start({ year: T.year, term: T.term });
  },
  students() {
    const q = (T.q || '').toLowerCase(), cls = T.fcls || '';
    const list = T.st.students.filter(s => s.status === 'active' && s.inYear && (!cls || s.className === cls) && (!q || (s.first + ' ' + s.last + ' ' + s.id).toLowerCase().includes(q)));
    page(`<div class="bar"><input type="search" id="q" placeholder="Search student…" value="${esc(T.q || '')}"><select id="fc"><option value="">All classes</option>${CLASSES.map(c => `<option ${c === cls ? 'selected' : ''}>${c}</option>`).join('')}</select><span class="muted">${list.length} students · Year ${T.st.current.year}</span><span class="sp"></span><button class="pri" id="dlclasses">⬇ Download class lists (Excel)</button></div>
    ${list.length ? `<table class="t"><thead><tr><th>Admission No.</th><th>Name</th><th>Class</th><th>Year</th></tr></thead><tbody>${list.map(s => `<tr><td>${esc(s.id)}</td><td><b>${esc(s.last)}</b> ${esc(s.first)}</td><td>${esc(s.className)}</td><td>${s.year || T.st.current.year}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No students in the school for ${T.st.current.year} yet.</div>'}`);
    $('#dlclasses').onclick = () => run(async () => { await saveXlsx(await api('t.exportClassLists')); });
    $('#q').oninput = e => { T.q = e.target.value; PG.students(); const n = $('#q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }; $('#fc').onchange = e => { T.fcls = e.target.value; PG.students(); };
  },
  promotions() {
    const st = T.st, yr = st.current.year, can = st.current.term === 3, fc = T.pcls || '';
    const hasEot = new Set(st.marks.filter(m => m.year === yr && m.term === 3 && m.exam === 'EOT' && !m.cleared).map(m => m.studentId));
    const recOf = id => { const r = (st.promotions || []).find(p => p.key === yr + '|' + id); return r && ['promoted', 'repeat'].includes(r.decision) ? r : null; };
    const all = st.students.filter(s => s.status === 'active' && s.inYear).sort((a, b) => CLASSES.indexOf(a.className) - CLASSES.indexOf(b.className) || (a.last + a.first).localeCompare(b.last + b.first));
    const list = all.filter(s => !fc || s.className === fc);
    const valid = s => !!recOf(s.id) && hasEot.has(s.id);
    const nProm = all.filter(s => valid(s) && recOf(s.id).decision === 'promoted').length, nRep = all.filter(s => valid(s) && recOf(s.id).decision === 'repeat').length, nNone = all.length - nProm - nRep;
    page(`<div class="pagehead"><h2>End-of-year promotion decisions · ${yr}</h2></div>
    <div class="banner info"><b>Who will be in the school in ${yr + 1}?</b> Only learners you mark here as <b>Promoted</b> or <b>Repeat Class</b>. A decision can only be made after the learner's <b>Term 3 End-of-Term exam</b> marks are entered. Learners with no decision will <b>not</b> appear in ${yr + 1} at all (not in class lists, fees or marks). Promoted learners join the next class; Repeat learners stay in their class. The Headteacher then starts ${yr + 1}.</div>
    ${!can ? `<div class="banner">Promotion decisions are available only in Term 3. The school is now in Term ${st.current.term} ${yr}.</div>` : ''}
    <div class="bar"><select id="pf"><option value="">All classes</option>${CLASSES.map(c => `<option ${c === fc ? 'selected' : ''}>${c}</option>`).join('')}</select><span class="chip c-green">${nProm} promoted</span><span class="chip c-blue">${nRep} repeat</span><span class="chip ${nNone ? 'c-red' : 'c-grey'}">${nNone} not decided</span></div>
    ${list.length ? `<table class="t"><thead><tr><th>Student</th><th>Class</th><th>Term 3 EOT marks</th><th>Decision</th></tr></thead><tbody>${list.map(s => {
      const rec = recOf(s.id), eot = hasEot.has(s.id), lost = rec && !eot;
      return `<tr><td><b>${esc(s.last)}</b> ${esc(s.first)}<span class="sub">${esc(s.id)}</span></td><td>${esc(s.className)}</td><td>${eot ? '<span class="chip c-green">entered</span>' : '<span class="chip c-red">not entered</span>'}</td><td><select data-prom="${esc(s.id)}" ${can && eot ? '' : 'disabled'}><option value="">Not decided</option><option value="promoted" ${rec?.decision === 'promoted' && eot ? 'selected' : ''}>Promoted → ${esc(CLASSES[CLASSES.indexOf(s.className) + 1] || 'leaves school')}</option><option value="repeat" ${rec?.decision === 'repeat' && eot ? 'selected' : ''}>Repeat Class (${esc(s.className)})</option></select>${!eot ? ' <span class="muted">Enter this learner\'s Term 3 End-of-Term marks first</span>' : ''}${lost ? ' <span class="owe">Marks were removed – this decision will not count</span>' : ''}</td></tr>`;
    }).join('')}</tbody></table>` : `<div class="empty">No learners${fc ? ' in ' + esc(fc) : ''} for ${yr}.</div>`}`);
    $('#pf').onchange = e => { T.pcls = e.target.value; PG.promotions(); };
    $$('[data-prom]').forEach(e => e.onchange = async () => {
      try {
        const id = e.dataset.prom;
        if (!e.value) await api('t.clearPromotion', { studentId: id, year: yr }); else await api('t.setPromotion', { studentId: id, year: yr, term: 3, decision: e.value });
        T.st = await api('t.state'); PG.promotions(); toast(e.value ? 'Decision saved' : 'Decision removed');
      } catch (err) { toast(err.message, true); T.st = await api('t.state'); PG.promotions(); }
    });
  },
};
async function saveXlsx(f) { const r = await window.bgs.saveFile(f.name, f.data); if (r.ok) toast('Saved: ' + r.path); else if (r.error) throw new Error(r.error); }
function showImportPreview(pv, fileName) {
  const ign = pv.ignoredColumns.length ? `<p class="muted">Columns not used (not a subject of ${esc(T.cls)}): ${pv.ignoredColumns.map(esc).join(', ')}</p>` : '';
  const errs = pv.errorCount ? `<div class="banner"><b>${pv.errorCount} problem${pv.errorCount === 1 ? '' : 's'} – these cells will NOT be saved:</b><ul style="margin:6px 0 0 18px;max-height:170px;overflow:auto">${pv.errors.map(e => `<li>Row ${e.row}: ${esc(e.text)}</li>`).join('')}</ul>${pv.errorCount > pv.errors.length ? '<div class="muted">…and more.</div>' : ''}</div>` : '';
  const m = modal('Upload marks – check before saving', `<p style="margin-top:0">File: <b>${esc(fileName || pv.sheet)}</b> · ${esc(T.cls)} · ${EXAMS.find(e => e.id === T.exam).name} · Term ${T.term} ${T.year}</p>
    <div class="sumbox"><div><span>Subjects found in the sheet</span><b>${pv.subjects.map(esc).join(', ')}</b></div><div><span>New marks to save</span><b class="paid">${pv.fresh}</b></div><div><span>Marks that will replace an earlier mark</span><b class="${pv.changed ? 'owe' : ''}">${pv.changed}</b></div><div><span>Already the same (unchanged)</span><b>${pv.same}</b></div>${pv.absent ? `<div><span>Marked absent</span><b>${pv.absent}</b></div>` : ''}</div>${errs}${ign}
    <p class="muted">Empty cells are left alone. Saved marks go straight into the school records like any other mark, and you can still change any mark by hand afterwards.</p>
    <div class="mf" style="padding:0"><button data-x2>Cancel</button><button class="pri" id="doimp" ${pv.toSave ? '' : 'disabled'}>${pv.toSave ? `Save ${pv.toSave} mark${pv.toSave === 1 ? '' : 's'}` : 'Nothing to save'}</button></div>`, { wide: true, sticky: true });
  $('[data-x2]', m).onclick = closeModal;
  $('#doimp').onclick = () => run(async () => { $('#doimp').disabled = true; const r = await api('t.applyMarksImport', { token: pv.token }); closeModal(); T.st = await api('t.state'); toast(`${r.saved} marks saved.`); PG.marks(); });
}
const gradeChip = s => { const g = gradeOf(s); return g ? `<span class="chip g-${g.g}">${g.g}</span>` : ''; };
boot();
