const tabIcon = k => `<img class="tab-icon" src="${({"dashboard":"../assets/dashboard.png","applications":"../assets/applications.png","students":"../assets/students.png","classes":"../assets/classes.jpeg","discipline":"../assets/discipline.png","fees":"../assets/fees.png","staff":"../assets/staff.svg","receipts":"../assets/receipts.png","reports":"../assets/reports.png","settings":"../assets/settings.png","logout":"../assets/logout.png","login":"../assets/login.png","school":"../assets/bgs-icon.png","marks":"../assets/reports.png","promotions":"../assets/grading.png","conn":"../assets/settings.png"})[k] || "../assets/school.png"}" alt="">`;
'use strict';
const T = { page: 'marks', st: null, year: null, term: null, exam: 'BOT', cls: 'P1', subject: null };
const root = $('#root'); let rv = null;
const NAV = [['marks', 'Enter Marks'], ['reports', 'Report Cards & Class Results'], ['students', 'Student List'], ['promotions', 'Term 3 Promotions'], ['conn', 'Connection']];

async function boot() {
  const a=await api('auth.status');
  if(!a.authed){root.innerHTML=`<div class="center-body"><form class="login" id="teacherLogin"><div class="logo"><img class="login-icon" src="../assets/bgs-icon.png" alt=""></div><h2>Teachers' Portal</h2><p class="muted">${a.hasPassword?'Enter your password':'Create a password for this Teachers PC'}</p><input type="password" id="teacherPW" required placeholder="Password (minimum 8 characters)">${a.hasPassword?'':'<input type="password" id="teacherConfirm" placeholder="Confirm password" required>'}<button class="pri">${a.hasPassword?'Unlock Teachers Portal':'Create password'}</button><p class="err" id="teacherErr"></p></form></div>`;$('#teacherLogin').onsubmit=async e=>{e.preventDefault();try{const pw=$('#teacherPW').value;if(!a.hasPassword&&pw!==$('#teacherConfirm').value)throw new Error('Passwords do not match');await api(a.hasPassword?'auth.login':'auth.setup',{pw});boot();}catch(err){$('#teacherErr').textContent=err.message;}};return;}
  T.st = await api('t.state');
  if (!T.st.cfg.teacher || !T.st.cfg.key) { T.page = 'conn'; }
  configureAcademics(T.st.academic?.subjects,T.st.academic?.grades);
  T.year = T.st.current.year; T.term = T.st.current.term;
  root.innerHTML = `<div class="app"><aside class="side"><div class="brand"><i><img class="school-icon" src="../assets/bgs-icon.png" alt=""></i><div>Bill Gates Junior<small>Nsangi · Teachers' PC</small></div></div><nav class="nav" id="nav"></nav>
  <div class="bottom"><button id="teacherLock">${tabIcon("logout")} Lock / log out</button><div id="who" style="color:#9db6d8;font-size:.8rem;padding:0 6px 8px"></div></div></aside><section class="main"><div class="top"><b style="color:var(--navy)" id="ttl"></b><span class="sp"></span><span id="conn"></span></div><div class="page" id="page"></div></section></div>`;
  $('#teacherLock').onclick=async()=>{await api('auth.logout');location.reload();};
  window.bgs.on(async () => {
    const was = T.st; T.st = await api('t.state'); configureAcademics(T.st.academic?.subjects, T.st.academic?.grades); paintConn();
    // The Headteacher started a new year / changed the term: this PC follows automatically.
    if (was && (was.current.year !== T.st.current.year || was.current.term !== T.st.current.term)) {
      const newYear = was.current.year !== T.st.current.year;
      T.year = T.st.current.year; T.term = T.st.current.term; rv = null;
      if (newYear) toast(`The Headteacher has started ${T.year}. This PC is now on ${T.year}, Term ${T.term}.`);
      if (!$('#modal')) draw(); return;
    }
    // The Headteacher added/removed a subject: show it straight away.
    if (was && JSON.stringify(was.academic) !== JSON.stringify(T.st.academic) && !$('#modal')) {
      toast('The Headteacher updated the subjects. They are now shown here.');
      if (T.page === 'reports') rv = null;
      if (T.page === 'marks' || T.page === 'reports') { draw(); return; }
    }
    if (T.page === 'conn' && PG.paintConnPage) PG.paintConnPage();
    if (T.page === 'students' || T.page === 'promotions' || (T.page === 'reports' && rv)) { if (!$('#modal') && T.page === 'reports') rv.refresh(); else if (T.page === 'students') draw(); }
  });
  draw();
}
function paintConn() {
  const c = T.st.conn, el = $('#conn'); if (!el) return;
  el.innerHTML = c.state === 'online' ? `<span class="syncdot c-green">Connected to Headteacher PC${c.pending ? ` · sending ${c.pending}` : ' · all marks delivered'}</span>` : `<span class="syncdot c-red" title="${esc(c.error)}">${c.searching ? 'Searching for Headteacher PC…' : 'Not connected'}${c.pending ? ` · ${c.pending} mark(s) saved here, waiting to send` : ''}</span>`;
  $('#who').textContent = T.st.cfg.teacher ? T.st.cfg.teacher : '';
}
function draw() {
  $('#nav').innerHTML = NAV.map(n => `<button data-p="${n[0]}" class="${T.page === n[0] ? 'on' : ''}">${tabIcon(n[0])}${n[1]}</button>`).join('');
  $$('#nav button').forEach(b => b.onclick = () => { T.page = b.dataset.p; rv = null; draw(); });
  $('#ttl').textContent = NAV.find(n => n[0] === T.page)[1]; paintConn(); PG[T.page]();
}
const page = h => { $('#page').innerHTML = h; };
const yearsList = () => { const a = []; for (let y = T.st.current.year + 1; y >= 2026; y--) a.push(y); return a; };

const PG = {
  marks() {
    const st = T.st, subs = subjectsFor(T.cls); if (!subs.includes(T.subject)) T.subject = subs[0];
    const map = marksToMap(st.marks), roster = rosterFor(st.students, st.marks, T.year, T.cls, st.current.year).filter(s => T.year !== st.current.year || st.students.find(x => x.id === s.id && x.status === 'active') || st.marks.some(m => m.studentId === s.id && m.year === T.year));
    const done = () => roster.filter(s => { const m = marksToMap(T.st.marks).get(markKey(T.year, T.term, T.exam, s.id, T.subject)); return m && !m.cleared; }).length;
    page(`<div class="card"><div class="bar" style="margin:0">
      <div><label>Year</label><select id="y">${yearsList().map(y => `<option ${y === T.year ? 'selected' : ''}>${y}</option>`).join('')}</select></div><div><label>Term</label><select id="t">${[1, 2, 3].map(t => `<option value="${t}" ${t === T.term ? 'selected' : ''}>Term ${t}</option>`).join('')}</select></div>
      <div><label>Examination</label><select id="e">${EXAMS.map(e => `<option value="${e.id}" ${e.id === T.exam ? 'selected' : ''}>${e.name}</option>`).join('')}</select></div><div><label>Class</label><select id="c">${CLASSES.map(c => `<option ${c === T.cls ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <div><label>Subject</label><select id="s">${subs.map(s => `<option ${s === T.subject ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div></div></div>
    <div class="banner info">Type each mark (0–100) and press <b>Enter</b> to go to the next student. Every mark is saved on this PC immediately and sent to the Headteacher's PC automatically. Tick <b>Absent</b> if the child missed the paper.</div>
    <div class="card xl"><div class="bar" style="margin:0"><b>Excel</b><button id="dlsheet">⬇ Download marks sheet for ${esc(T.cls)}</button><button class="pri" id="upsheet">⬆ Upload filled marks sheet</button><span class="muted">Give the downloaded sheet to the class teachers. When they bring it back filled in, upload it here for <b>${esc(T.cls)} · ${EXAMS.find(e => e.id === T.exam).short} · Term ${T.term} ${T.year}</b> and the marks enter by themselves. You can still type marks by hand below.</span></div></div>
    <div class="pagehead"><h3>${esc(T.cls)} · ${esc(T.subject)} · ${EXAMS.find(e => e.id === T.exam).short} Term ${T.term} ${T.year}</h3><span class="sp"></span><span id="prog" class="chip c-blue"></span></div>
    ${roster.length ? `<table class="t"><thead><tr><th>#</th><th>Student</th><th>Admission No.</th><th style="width:120px">Mark / 100</th><th>Absent</th><th>Grade</th><th></th></tr></thead><tbody>${roster.map((s, i) => { const m = map.get(markKey(T.year, T.term, T.exam, s.id, T.subject)), has = m && !m.cleared; return `<tr data-sid="${esc(s.id)}"><td>${i + 1}</td><td><b>${esc(s.last)}</b> ${esc(s.first)}</td><td>${esc(s.id)}</td><td><input class="markin" inputmode="numeric" value="${has && !m.absent ? m.score : ''}" ${has && m.absent ? 'disabled' : ''}></td><td><input type="checkbox" class="abs" ${has && m.absent ? 'checked' : ''}></td><td class="gr">${has && !m.absent ? gradeChip(m.score) : ''}</td><td class="sv muted">${has ? '✓ saved' : ''}</td></tr>`; }).join('')}</tbody></table>` : `<div class="empty">${st.conn.state === 'online' ? 'No students in this class yet.' : 'No students to show yet. Open the Connection page and make sure this PC is connected to the Headteacher PC.'}</div>`}`);
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
    rv = ReportsView($('#rv'), { note: 'Print any learner\'s report card, or the whole class results sheet. Reports use the marks saved on this PC.', getData: async y => { const s = await api('t.state'); T.st = s; return { students: s.students, marks: s.marks.filter(m => m.year === y), comments: s.comments.filter(c => c.id.startsWith(y + '|')), promotions: s.promotions.filter(p => p.year === y), academic: s.academic, current: s.current }; }, saveRemark: (id, teacher, head) => api('t.setComment', { id, teacher, head }) });
    await rv.start({ year: T.year, term: T.term });
  },
  students() {
    const q = (T.q || '').toLowerCase(), cls = T.fcls || '';
    const list = T.st.students.filter(s => s.status === 'active' && (!cls || s.className === cls) && (!q || (s.first + ' ' + s.last + ' ' + s.id).toLowerCase().includes(q)));
    page(`<div class="bar"><input type="search" id="q" placeholder="Search student…" value="${esc(T.q || '')}"><select id="fc"><option value="">All classes</option>${CLASSES.map(c => `<option ${c === cls ? 'selected' : ''}>${c}</option>`).join('')}</select><span class="muted">${list.length} students · Year ${T.st.current.year}</span><span class="sp"></span><button class="pri" id="dlclasses">⬇ Download class lists (Excel)</button></div>
    ${list.length ? `<table class="t"><thead><tr><th>Admission No.</th><th>Name</th><th>Class</th><th>Year</th></tr></thead><tbody>${list.map(s => `<tr><td>${esc(s.id)}</td><td><b>${esc(s.last)}</b> ${esc(s.first)}</td><td>${esc(s.className)}</td><td>${s.year || T.st.current.year}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No students yet. Check the Connection page.</div>'}`);
    $('#dlclasses').onclick = () => run(async () => { await saveXlsx(await api('t.exportClassLists')); });
    $('#q').oninput = e => { T.q = e.target.value; PG.students(); const n = $('#q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }; $('#fc').onchange = e => { T.fcls = e.target.value; PG.students(); };
  },
  promotions() {
    const st=T.st, yr=st.current.year;
    const can=st.current.term===3;
    const list=st.students.filter(s=>s.status==='active');
    page(`${'<div class="pagehead"><h2>End-of-year promotion decisions</h2></div>'}<div class="banner info">Decisions are recorded during Term 3 of ${yr}. A promoted learner advances at the start of ${yr+1}; Repeat Class stays in the same class. The Headteacher cannot edit examination marks.</div>${!can?'<div class="banner">Promotion decisions are available only when the Headteacher has opened Term 3.</div>':''}<table class="t"><thead><tr><th>Student</th><th>Current class</th><th>Decision</th></tr></thead><tbody>${list.map(s=>{const k=yr+'|'+s.id,rec=(st.promotions||[]).find(r=>r.key===k);return `<tr><td>${esc(s.first+' '+s.last)}<span class="sub">${esc(s.id)}</span></td><td>${esc(s.className)}</td><td><select data-prom="${esc(s.id)}" ${can?'':'disabled'}><option value="">Not decided</option><option value="promoted" ${rec?.decision==='promoted'?'selected':''}>Promoted</option><option value="repeat" ${rec?.decision==='repeat'?'selected':''}>Repeat Class</option></select><span class="muted" data-status="${esc(s.id)}">${rec?rec.applied?'Applied':'Saved':(st.promoErrors||{})[k]?'':'Pending'}</span>${(st.promoErrors||{})[k]&&!rec?`<span class="owe"> ${esc(st.promoErrors[k])}</span>`:''}</td></tr>`}).join('')}</tbody></table>`);
    $$('[data-prom]').forEach(e=>e.onchange=async()=>{if(!e.value)return;try{const r=await api('t.setPromotion',{studentId:e.dataset.prom,year:yr,term:3,decision:e.value});T.st.promotions=(T.st.promotions||[]).filter(p=>p.key!==r.key).concat(r);$(`[data-status="${e.dataset.prom}"]`).textContent='Saved · syncing';}catch(err){toast(err.message,true);e.value=((T.st.promotions||[]).find(p=>p.key===yr+'|'+e.dataset.prom)||{}).decision||'';}});
  },
  conn() {
    const c = T.st.cfg, paired = !!(c.key && c.teacher);
    page(`<div class="card conn-card"><h3>Connect to the Headteacher's PC</h3>
    
    <div id="cstat"></div>
    <div class="field"><label>Your name (shown on the marks you enter)</label><input id="tn" value="${esc(c.teacher)}" placeholder="e.g. Mr. Okello (Director of Studies)"></div>
    <div class="field"><label>School key</label><input id="hk" value="${esc(c.key)}" placeholder="XXXX-XXXX" autocomplete="off" spellcheck="false" style="text-transform:uppercase;letter-spacing:.12em"></div>
    <details><summary>Advanced: enter the Headteacher PC address manually</summary><div class="field" style="margin-top:8px"><label>Address (optional)</label><input id="ha" value="${esc(c.hm)}" placeholder="Leave empty – found automatically"></div></details>
    <div class="bar" style="margin-top:14px"><button class="pri" id="sv">${paired ? 'Save changes' : 'Save &amp; connect'}</button><button id="fd">Find Headteacher PC again</button></div>
    </div>`);
    PG.paintConnPage = () => {
      const el = $('#cstat'); if (!el) return;
      const s = T.st.conn, k = T.st.cfg;
      if (s.state === 'online') el.innerHTML = `<div class="banner ok"><b>Connected.</b> Headteacher PC found at ${esc(s.address || k.hm)}.</div>`;
      else if (s.searching) el.innerHTML = '<div class="banner info"><b>Searching…</b> Looking for the Headteacher PC on the cable or network.</div>';
      else if (k.key) el.innerHTML = `<div class="banner"><b>Not connected yet.</b> ${esc(s.error || '')}</div>`;
      else el.innerHTML = '';
    };
    PG.paintConnPage();
    const refreshState = async () => { T.st = await api('t.state'); configureAcademics(T.st.academic?.subjects, T.st.academic?.grades); paintConn(); PG.paintConnPage(); if (T.st.cfg.key) $('#hk').value = T.st.cfg.key; };
    $('#sv').onclick = () => run(async () => {
      if (!$('#tn').value.trim() || !$('#hk').value.trim()) throw new Error('Enter your name and the school key.');
      await api('t.setConfig', { teacher: $('#tn').value, hm: $('#ha').value, key: $('#hk').value });
      $('#cstat').innerHTML = '<div class="banner info"><b>Connecting…</b></div>';
      await api('t.find'); await refreshState();
      if (T.st.conn.state === 'online') toast('Connected. This computer is now paired.');
    });
    $('#fd').onclick = () => run(async () => { $('#cstat').innerHTML = '<div class="banner info"><b>Searching…</b></div>'; const r = await api('t.find'); await refreshState(); if (!r.found && T.st.conn.state !== 'online') toast(r.note || 'Headteacher PC not found yet. Check the cable and that the program is open on that computer.', true); });
  },
};
async function saveXlsx(f) { const r = await window.bgs.saveFile(f.name, f.data); if (r.ok) toast('Saved: ' + r.path); else if (r.error) throw new Error(r.error); }
function showImportPreview(pv, fileName) {
  const ign = pv.ignoredColumns.length ? `<p class="muted">Columns not used (not a subject of ${esc(T.cls)}): ${pv.ignoredColumns.map(esc).join(', ')}</p>` : '';
  const errs = pv.errorCount ? `<div class="banner"><b>${pv.errorCount} problem${pv.errorCount === 1 ? '' : 's'} – these cells will NOT be saved:</b><ul style="margin:6px 0 0 18px;max-height:170px;overflow:auto">${pv.errors.map(e => `<li>Row ${e.row}: ${esc(e.text)}</li>`).join('')}</ul>${pv.errorCount > pv.errors.length ? '<div class="muted">…and more.</div>' : ''}</div>` : '';
  const m = modal('Upload marks – check before saving', `<p style="margin-top:0">File: <b>${esc(fileName || pv.sheet)}</b> · ${esc(T.cls)} · ${EXAMS.find(e => e.id === T.exam).name} · Term ${T.term} ${T.year}</p>
    <div class="sumbox"><div><span>Subjects found in the sheet</span><b>${pv.subjects.map(esc).join(', ')}</b></div><div><span>New marks to save</span><b class="paid">${pv.fresh}</b></div><div><span>Marks that will replace an earlier mark</span><b class="${pv.changed ? 'owe' : ''}">${pv.changed}</b></div><div><span>Already the same (unchanged)</span><b>${pv.same}</b></div>${pv.absent ? `<div><span>Marked absent</span><b>${pv.absent}</b></div>` : ''}</div>${errs}${ign}
    <p class="muted">Empty cells are left alone. Saved marks are sent to the Headteacher's PC like any other mark, and you can still change any mark by hand afterwards.</p>
    <div class="mf" style="padding:0"><button data-x2>Cancel</button><button class="pri" id="doimp" ${pv.toSave ? '' : 'disabled'}>${pv.toSave ? `Save ${pv.toSave} mark${pv.toSave === 1 ? '' : 's'}` : 'Nothing to save'}</button></div>`, { wide: true, sticky: true });
  $('[data-x2]', m).onclick = closeModal;
  $('#doimp').onclick = () => run(async () => { $('#doimp').disabled = true; const r = await api('t.applyMarksImport', { token: pv.token }); closeModal(); T.st = await api('t.state'); toast(`${r.saved} marks saved and being sent to the Headteacher PC.`); PG.marks(); });
}
const gradeChip = s => { const g = gradeOf(s); return g ? `<span class="chip g-${g.g}">${g.g}</span>` : ''; };
boot();
