'use strict';
const T = { page: 'marks', st: null, year: null, term: null, exam: 'BOT', cls: 'P1', subject: null };
const root = $('#root'); let rv = null;
const NAV = [['marks', '✏️', 'Enter Marks'], ['reports', '📊', 'Report Cards & Class Results'], ['students', '🎓', 'Student List'], ['promotions', '🎓', 'Term 3 Promotions'], ['conn', '🔗', 'Connection']];

async function boot() {
  T.st = await api('t.state');
  if (!T.st.cfg.teacher || !T.st.cfg.hm || !T.st.cfg.key) { T.page = 'conn'; }
  T.year = T.st.current.year; T.term = T.st.current.term;
  root.innerHTML = `<div class="app"><aside class="side"><div class="brand"><i>🎓</i><div>Bill Gates Junior<small>Nsangi · Teachers' PC</small></div></div><nav class="nav" id="nav"></nav>
  <div class="bottom"><div id="who" style="color:#9db6d8;font-size:.8rem;padding:0 6px 8px"></div></div></aside><section class="main"><div class="top"><b style="color:var(--navy)" id="ttl"></b><span class="sp"></span><span id="conn"></span></div><div class="page" id="page"></div></section></div>`;
  window.bgs.on(async () => { const was = T.st; T.st = await api('t.state'); paintConn(); if (T.page === 'students' || (T.page === 'reports' && rv)) { if (!$('#modal') && T.page === 'reports') rv.refresh(); else if (T.page === 'students') draw(); } });
  draw();
}
function paintConn() {
  const c = T.st.conn, el = $('#conn'); if (!el) return;
  el.innerHTML = c.state === 'online' ? `<span class="syncdot c-green">Connected to Headteacher PC${c.pending ? ` · sending ${c.pending}` : ' · all marks delivered'}</span>` : `<span class="syncdot c-red" title="${esc(c.error)}">Not connected${c.pending ? ` · ${c.pending} mark(s) saved here, waiting to send` : ''}</span>`;
  $('#who').textContent = T.st.cfg.teacher ? '👤 ' + T.st.cfg.teacher : '';
}
function draw() {
  $('#nav').innerHTML = NAV.map(n => `<button data-p="${n[0]}" class="${T.page === n[0] ? 'on' : ''}"><span>${n[1]}</span>${n[2]}</button>`).join('');
  $$('#nav button').forEach(b => b.onclick = () => { T.page = b.dataset.p; rv = null; draw(); });
  $('#ttl').textContent = NAV.find(n => n[0] === T.page)[2]; paintConn(); PG[T.page]();
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
    <div class="pagehead"><h3>${esc(T.cls)} · ${esc(T.subject)} · ${EXAMS.find(e => e.id === T.exam).short} Term ${T.term} ${T.year}</h3><span class="sp"></span><span id="prog" class="chip c-blue"></span></div>
    ${roster.length ? `<table class="t"><thead><tr><th>#</th><th>Student</th><th>Admission No.</th><th style="width:120px">Mark / 100</th><th>Absent</th><th>Grade</th><th></th></tr></thead><tbody>${roster.map((s, i) => { const m = map.get(markKey(T.year, T.term, T.exam, s.id, T.subject)), has = m && !m.cleared; return `<tr data-sid="${esc(s.id)}"><td>${i + 1}</td><td><b>${esc(s.last)}</b> ${esc(s.first)}</td><td>${esc(s.id)}</td><td><input class="markin" inputmode="numeric" value="${has && !m.absent ? m.score : ''}" ${has && m.absent ? 'disabled' : ''}></td><td><input type="checkbox" class="abs" ${has && m.absent ? 'checked' : ''}></td><td class="gr">${has && !m.absent ? gradeChip(m.score) : ''}</td><td class="sv muted">${has ? '✓ saved' : ''}</td></tr>`; }).join('')}</tbody></table>` : '<div class="empty">No students in this class yet. Make sure this PC is connected to the Headteacher PC (Connection).</div>'}`);
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
    rv = ReportsView($('#rv'), { note: 'Print any learner\'s report card, or the whole class results sheet. Reports use the marks saved on this PC.', getData: async y => { const s = await api('t.state'); T.st = s; return { students: s.students, marks: s.marks.filter(m => m.year === y), comments: s.comments.filter(c => c.id.startsWith(y + '|')), promotions: s.promotions.filter(p => p.year === y), current: s.current }; }, saveRemark: (id, teacher, head) => api('t.setComment', { id, teacher, head }) });
    await rv.start({ year: T.year, term: T.term });
  },
  students() {
    const q = (T.q || '').toLowerCase(), cls = T.fcls || '';
    const list = T.st.students.filter(s => s.status === 'active' && (!cls || s.className === cls) && (!q || (s.first + ' ' + s.last + ' ' + s.id).toLowerCase().includes(q)));
    page(`<div class="bar"><input type="search" id="q" placeholder="Search student…" value="${esc(T.q || '')}"><select id="fc"><option value="">All classes</option>${CLASSES.map(c => `<option ${c === cls ? 'selected' : ''}>${c}</option>`).join('')}</select><span class="muted">${list.length} students · Year ${T.st.current.year}</span></div>
    ${list.length ? `<table class="t"><thead><tr><th>Admission No.</th><th>Name</th><th>Class</th><th>Year</th></tr></thead><tbody>${list.map(s => `<tr><td>${esc(s.id)}</td><td><b>${esc(s.last)}</b> ${esc(s.first)}</td><td>${esc(s.className)}</td><td>${s.year || T.st.current.year}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No students yet. Check the Connection page.</div>'}`);
    $('#q').oninput = e => { T.q = e.target.value; PG.students(); const n = $('#q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }; $('#fc').onchange = e => { T.fcls = e.target.value; PG.students(); };
  },
  promotions() {
    const st=T.st, yr=st.current.year;
    const can=st.current.term===3;
    const list=st.students.filter(s=>s.status==='active');
    page(`${'<div class="pagehead"><h2>End-of-year promotion decisions</h2></div>'}<div class="banner info">Decisions are recorded during Term 3 of ${yr}. A promoted learner advances at the start of ${yr+1}; Repeat Class stays in the same class. The Headteacher cannot edit examination marks.</div>${!can?'<div class="banner">Promotion decisions are available only when the Headteacher has opened Term 3.</div>':''}<table class="t"><thead><tr><th>Student</th><th>Current class</th><th>Decision</th></tr></thead><tbody>${list.map(s=>{const k=yr+'|'+s.id,rec=(st.promotions||[]).find(r=>r.key===k);return `<tr><td>${esc(s.first+' '+s.last)}<span class="sub">${esc(s.id)}</span></td><td>${esc(s.className)}</td><td><select data-prom="${esc(s.id)}" ${can?'':'disabled'}><option value="">Not decided</option><option value="promoted" ${rec?.decision==='promoted'?'selected':''}>Promoted</option><option value="repeat" ${rec?.decision==='repeat'?'selected':''}>Repeat Class</option></select><span class="muted" data-status="${esc(s.id)}">${rec?rec.applied?'Applied':'Saved':'Pending'}</span></td></tr>`}).join('')}</tbody></table>`);
    $$('[data-prom]').forEach(e=>e.onchange=async()=>{if(!e.value)return;try{const r=await api('t.setPromotion',{studentId:e.dataset.prom,year:yr,term:3,decision:e.value});T.st.promotions=(T.st.promotions||[]).filter(p=>p.key!==r.key).concat(r);$(`[data-status="${e.dataset.prom}"]`).textContent='Saved · syncing';}catch(err){toast(err.message,true);}});
  },
  conn() {
    const c = T.st.cfg;
    page(`<div class="card" style="max-width:640px"><h3>Connection to the Headteacher's PC</h3><p class="muted">Ask the Headteacher for the <b>address</b> and the <b>school key</b> shown in her Settings page. Both computers must be on the same WiFi / network.</p>
    <div class="field"><label>Your name (shown on the marks you enter)</label><input id="tn" value="${esc(c.teacher)}" placeholder="e.g. Mr. Okello (Director of Studies)"></div>
    <div class="field"><label>Headteacher PC address</label><input id="ha" value="${esc(c.hm)}" placeholder="e.g. 192.168.1.10:4750"></div>
    <div class="field"><label>School key</label><input id="hk" value="${esc(c.key)}" placeholder="XXXX-XXXX" style="text-transform:uppercase;letter-spacing:.1em"></div>
    <div class="bar"><button class="pri" id="sv">Save & connect</button><span id="cs"></span></div>
    <p class="muted">This PC only receives the <b>student list (name, admission number, class)</b>. It never sees fees, payments, salaries or phone numbers.</p></div>`);
    const show = () => { const s = T.st.conn; $('#cs') && ($('#cs').innerHTML = s.state === 'online' ? '<span class="paid">✓ Connected</span>' : `<span class="owe">${esc(s.error || '')}</span>`); };
    show();
    $('#sv').onclick = () => run(async () => { await api('t.setConfig', { teacher: $('#tn').value, hm: $('#ha').value, key: $('#hk').value }); $('#cs').textContent = 'Connecting…'; await new Promise(r => setTimeout(r, 1500)); await api('t.syncNow'); T.st = await api('t.state'); paintConn(); show(); });
  },
};
const gradeChip = s => { const g = gradeOf(s); return g ? `<span class="chip g-${g.g}">${g.g}</span>` : ''; };
boot();
