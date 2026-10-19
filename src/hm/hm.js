const tabIcon = k => `<img class="tab-icon" src="${({"dashboard":"../assets/dashboard.png","applications":"../assets/applications.png","students":"../assets/students.png","classes":"../assets/classes.jpeg","discipline":"../assets/discipline.png","fees":"../assets/fees.png","staff":"../assets/staff.svg","receipts":"../assets/receipts.png","reports":"../assets/reports.png","settings":"../assets/settings.png","logout":"../assets/logout.png","login":"../assets/login.png","school":"../assets/school.png"})[k] || "../assets/dashboard.png"}" alt="">`;
'use strict';
const S = { page: 'dashboard', year: null, term: null, period: null, d: null, sync: null, f: { q: '', cls: '', st: 'active', ty: '', fee: '', rcpt: 'all', adm: 'pending', from: '', to: '' } };
const NAV = [['dashboard', '🏠', 'Dashboard'], ['g1', 'School'], ['applications', '📝', 'Applications'], ['students', '🎓', 'Students'], ['classes', '🏫', 'Classes'], ['discipline', '⚖️', 'Discipline'], ['fees', '💰', 'School Fees'], ['staff', '👩‍🏫', 'Staff & Salaries'], ['receipts', '🧾', 'Receipts'], ['g2', 'Academics'], ['reports', '📊', 'Academic Reports'], ['g3', 'System'], ['settings', '⚙️', 'Settings & Backup']];
let reportsView = null;
const root = $('#root');
const termTxt = (y, t) => `Term ${t} ${y}`;
const readOnlyViewNote = () => (S.d && (S.year !== S.d.current.year || S.term !== S.d.current.term)) ? `<div class="banner">You are viewing <b>${termTxt(S.year, S.term)}</b> – not the current term (${termTxt(S.d.current.year, S.d.current.term)}). Payments recorded here are saved against ${termTxt(S.year, S.term)}.</div>` : '';

/* ---------- start-up: setup password / login ---------- */
async function boot() {
  const a = await api('auth.status');
  if (a.authed) return enter();
  root.innerHTML = `<div class="center-body"><form class="login" id="lf"><div class="logo"><img src="../assets/school.png" alt="" class="login-icon"></div><h2>Bill Gates Junior School</h2><p class="muted">${a.hasPassword ? 'Headteacher login' : 'First time: create the Headteacher password'}</p>
  <input type="password" id="pw" placeholder="${a.hasPassword ? 'Password' : 'Choose a password (min 4 characters)'}" autofocus>${a.hasPassword ? '' : '<input type="password" id="pw2" placeholder="Repeat password">'}
  <button class="pri" type="submit">${a.hasPassword ? 'Log in' : 'Create password & start'}</button><p class="err" id="le"></p></form></div>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault(); const pw = $('#pw').value;
    try { if (!a.hasPassword) { if (pw !== $('#pw2').value) throw new Error('The two passwords do not match.'); await api('auth.setup', { pw }); } else await api('auth.login', { pw }); enter(); }
    catch (err) { $('#le').textContent = err.message; }
  };
}
async function enter() {
  const st = await api('hm.state'); S.year = st.current.year; S.term = st.current.term; S.period = `${st.current.year}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  root.innerHTML = `<div class="app"><aside class="side"><div class="brand"><i><img class="school-icon" src="../assets/school.png" alt=""></i><div>Bill Gates Junior<small>Nsangi · Headteacher</small></div></div><nav class="nav" id="nav"></nav>
    <div class="bottom"><button id="lock">${tabIcon("logout")} Lock / log out</button></div></aside>
    <section class="main"><div class="top"><b style="color:var(--navy)">Academic year</b><select id="selY"></select><select id="selT"></select><span id="curtag"></span><span class="sp"></span><span id="syncchip"></span></div><div class="page" id="page"></div></section></div>`;
  $('#lock').onclick = async () => { await api('auth.logout'); location.reload(); };
  $('#selY').onchange = e => { S.year = +e.target.value; refresh(); }; $('#selT').onchange = e => { S.term = +e.target.value; refresh(); };
  window.bgs.on(async k => { if (k === 'sync') { await loadSync(); } else if (k === 'changed') { if (!$('#modal') && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) refresh(); else if (S.page === 'reports') {} } });
  reportsView = null; await refresh(); loadSync();
}
async function loadSync() { try { S.sync = (await api('settings.get')).cloud.status; } catch (e) { return; } paintSync(); }
function paintSync() {
  const s = S.sync, el = $('#syncchip'); if (!el || !s) return; let c = 'c-grey', t = 'Cloud backup: not set up';
  if (s.state === 'ok') { c = 'c-green'; t = 'Backed up to cloud' + (s.last ? ' · ' + new Date(s.last).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''); }
  else if (s.state === 'pending') { c = 'c-amber'; t = `Syncing… ${s.pending} change${s.pending === 1 ? '' : 's'} waiting`; }
  else if (s.state === 'error') { c = 'c-red'; t = `Cloud offline – ${s.pending} waiting (kept safely, will retry)`; }
  el.innerHTML = `<span class="syncdot ${c}" title="${esc(s.error || '')}">${esc(t)}</span>`;
}
async function refresh() {
  S.d = await api('hm.state', { year: S.year, term: S.term, period: S.period });
  const ys = []; for (let y = S.d.current.year + 1; y >= 2026; y--) ys.push(y);
  $('#selY').innerHTML = ys.map(y => `<option ${y === S.year ? 'selected' : ''}>${y}</option>`).join('');
  $('#selT').innerHTML = [1, 2, 3].map(t => `<option value="${t}" ${t === S.term ? 'selected' : ''}>Term ${t}</option>`).join('');
  $('#curtag').innerHTML = (S.year === S.d.current.year && S.term === S.d.current.term) ? chip('CURRENT TERM', 'green') : `<button class="sm" id="viewcur">Back to current term (${termTxt(S.d.current.year, S.d.current.term)})</button>`;
  const vc = $('#viewcur'); if (vc) vc.onclick = () => { S.year = S.d.current.year; S.term = S.d.current.term; refresh(); };
  $('#nav').innerHTML = NAV.map(n => n.length === 2 ? `<div class="grp">${n[1]}</div>` : `<button data-p="${n[0]}" class="${S.page === n[0] ? 'on' : ''}">${tabIcon(n[0])}${n[2]}${n[0] === 'applications' && pendingCount() ? ` <span class="chip c-amber" style="margin-left:auto">${pendingCount()}</span>` : ''}</button>`).join('');
  $$('#nav button').forEach(b => b.onclick = () => { S.page = b.dataset.p; reportsView = null; refresh(); });
  paintSync(); await PAGES[S.page]();
}
const pendingCount = () => S.d.students.filter(s => s.status === 'pending').length;
const head = (t, extra = '') => `<div class="pagehead"><h2>${t}</h2><span class="sp"></span>${extra}</div>`;
const page = h => { $('#page').innerHTML = h; };
const nameCell = s => `<div class="nm"><span class="avatar">${esc(initials(s.first, s.last))}</span><span><b>${esc(s.first + ' ' + s.last)}</b><span class="sub">${esc(s.id)}</span></span></div>`;
const feeChip = f => f === 'paid' ? chip('PAID', 'green') : f === 'partial' ? chip('PARTIAL', 'amber') : f === 'unpaid' ? chip('NOT PAID', 'red') : chip('NO BILL', 'grey');
const stChip = s => s.status === 'active' ? chip('ACTIVE', 'green') : s.status === 'inactive' ? chip('INACTIVE', 'grey') : chip('PENDING', 'amber');
function bindSearch(id, key, redraw) { const el = $('#' + id); el.oninput = () => { S.f[key] = el.value; redraw(); const n = $('#' + id); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }; }
const hit = (s, q) => !q || (s.first + ' ' + s.last + ' ' + s.id + ' ' + (s.parent || '') + ' ' + (s.phone || '')).toLowerCase().includes(q.toLowerCase());
const clsOpts = sel => `<option value="">All classes</option>` + CLASSES.map(c => `<option ${c === sel ? 'selected' : ''}>${c}</option>`).join('');
const methodSel = () => `<div class="field"><label>Payment method</label><select id="fm"><option>Cash</option><option>Mobile Money</option><option>Bank</option></select></div>`;

const PAGES = {
  /* ================= Dashboard ================= */
  dashboard() {
    const d = S.d, act = d.students.filter(s => s.status === 'active'), withBill = d.students.filter(s => s.fee.has);
    const due = withBill.reduce((a, s) => a + s.fee.due, 0), paid = withBill.reduce((a, s) => a + s.fee.paid, 0);
    const sal = d.staff.filter(w => w.status === 'active'), sd = sal.reduce((a, w) => a + w.period.demand, 0), sp = sal.reduce((a, w) => a + w.period.paid, 0);
    const recent = d.payments.slice(0, 8);
    page(`${head('Dashboard — ' + termTxt(S.year, S.term))}${readOnlyViewNote()}
    <div class="kpis"><div class="kpi"><small>Active students</small><b>${act.length}</b></div><div class="kpi"><small>Day / Boarding</small><b>${act.filter(s => s.type === 'day').length} / ${act.filter(s => s.type === 'boarding').length}</b></div>
    <div class="kpi a"><small>Pending applications</small><b>${pendingCount()}</b></div><div class="kpi"><small>Active staff</small><b>${sal.length}</b></div></div>
    <div class="kpis"><div class="kpi"><small>School fees expected</small><b>${money(due)}</b></div><div class="kpi g"><small>Fees collected</small><b>${money(paid)}</b></div><div class="kpi r"><small>Fees outstanding</small><b>${money(due - paid)}</b></div>
    <div class="kpi"><small>Salaries due · ${monthName(S.period)}</small><b>${money(sd)}</b></div><div class="kpi g"><small>Salaries paid</small><b>${money(sp)}</b></div><div class="kpi r"><small>Salaries still owed</small><b>${money(sd - sp)}</b></div></div>
    <div class="card"><h3 style="margin-bottom:10px">Latest receipts</h3>${recent.length ? `<table class="t"><tbody>${recent.map(p => `<tr><td class="nowrap">${fmtDT(p.ts)}</td><td>${esc(p.receiptNo)}</td><td>${esc(p.studentName || p.staffName)}</td><td>${kindChip(p.kind)}</td><td class="n"><b>${money(p.amount)}</b></td></tr>`).join('')}</tbody></table>` : '<div class="empty">No payments recorded yet.</div>'}</div>`);
  },

  /* ================= Applications ================= */
  applications() {
    const draw = () => {
      const all = S.d.students.filter(s => (S.f.adm === 'pending' ? s.status === 'pending' : s.admission.paid > 0 && s.status !== 'pending') && hit(s, S.f.q));
      $('#tbl').innerHTML = all.length ? `<table class="t"><thead><tr><th>Applicant</th><th>Class</th><th>Type</th><th>Parent / Guardian</th><th class="n">Admission fee</th><th class="n">Paid</th><th class="n">Balance</th><th>Status</th><th></th></tr></thead><tbody>
      ${all.map(s => `<tr><td>${nameCell(s)}</td><td>${esc(s.className)}</td><td>${typeLabel(s.type)}</td><td>${esc(s.parent)}<span class="sub">${esc(s.phone)}</span></td><td class="n">${num(s.admission.fee)}</td><td class="n paid">${num(s.admission.paid)}</td><td class="n ${s.admission.balance ? 'owe' : ''}">${num(s.admission.balance)}</td>
      <td>${s.status === 'pending' ? chip('PENDING', 'amber') : chip('PAID · ACTIVE', 'green')}</td><td class="act">${s.admission.balance ? `<button class="pri sm" data-pay="${esc(s.id)}">Record payment</button>` : ''}</td></tr>`).join('')}</tbody></table>`
        : `<div class="empty">${S.f.adm === 'pending' ? 'No pending applications. Use “New application” when a parent comes.' : 'Nothing to show.'}</div>`;
      $$('[data-pay]').forEach(b => b.onclick = () => admissionPay(b.dataset.pay));
    };
    page(`${head('Applications & Admission Fee (UGX 30,000)', '<button class="pri" id="newapp">＋ New application</button>')}
    <div class="bar"><div class="seg"><button data-a="pending" class="${S.f.adm === 'pending' ? 'on' : ''}">Pending (${pendingCount()})</button><button data-a="paid" class="${S.f.adm === 'paid' ? 'on' : ''}">Admitted (fee paid)</button></div><input type="search" id="q" placeholder="Search name, number, parent…" value="${esc(S.f.q)}"></div><div id="tbl"></div>`);
    $$('[data-a]').forEach(b => b.onclick = () => { S.f.adm = b.dataset.a; PAGES.applications(); });
    bindSearch('q', 'q', draw); $('#newapp').onclick = newApplication; draw();
  },

  /* ================= Students ================= */
  students() {
    const draw = () => {
      const f = S.f, list = S.d.students.filter(s => hit(s, f.q) && (!f.cls || s.className === f.cls) && (!f.ty || s.type === f.ty) && (f.st === 'all' || s.status === f.st));
      $('#tbl').innerHTML = list.length ? `<table class="t"><thead><tr><th>Student</th><th>Class</th><th>Day / Boarding</th><th class="n">Fee per term</th><th>Status</th><th>Parent</th><th></th></tr></thead><tbody>
      ${list.map(s => `<tr><td>${nameCell(s)}</td><td>${esc(s.className)}</td><td>${s.type === 'boarding' ? chip('BOARDING', 'blue') : chip('DAY', 'grey')} ${s.status === 'pending' ? '' : `<button class="sm" data-ty="${esc(s.id)}">Switch to ${s.type === 'day' ? 'Boarding' : 'Day'}</button>`}</td>
      <td class="n">${num(s.termFee)}</td><td>${stChip(s)} ${s.status === 'pending' ? '' : s.status === 'active' ? `<button class="sm danger" data-st="${esc(s.id)}|inactive">Make inactive</button>` : `<button class="sm ok" data-st="${esc(s.id)}|active">Make active</button>`}</td>
      <td>${esc(s.parent)}<span class="sub">${esc(s.phone)}</span></td><td class="act"><button class="sm" data-ed="${esc(s.id)}">Edit</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty">No students match.</div>';
      $$('[data-ty]').forEach(b => b.onclick = () => switchType(b.dataset.ty)); $$('[data-st]').forEach(b => b.onclick = () => toggleStatus(...b.dataset.st.split('|'))); $$('[data-ed]').forEach(b => b.onclick = () => editStudent(b.dataset.ed));
    };
    const f = S.f;
    page(`${head('Students', `<span class="muted">${S.d.students.filter(s => s.status === 'active').length} active</span>`)}<div class="bar"><input type="search" id="q" placeholder="Search name, admission number, parent…" value="${esc(f.q)}">
    <select id="fc">${clsOpts(f.cls)}</select><select id="fy"><option value="">Day & Boarding</option><option value="day" ${f.ty === 'day' ? 'selected' : ''}>Day only</option><option value="boarding" ${f.ty === 'boarding' ? 'selected' : ''}>Boarding only</option></select>
    <select id="fs">${[['active', 'Active'], ['inactive', 'Inactive'], ['pending', 'Pending admission'], ['all', 'All']].map(o => `<option value="${o[0]}" ${f.st === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div><div id="tbl"></div>`);
    bindSearch('q', 'q', draw); $('#fc').onchange = e => { f.cls = e.target.value; draw(); }; $('#fy').onchange = e => { f.ty = e.target.value; draw(); }; $('#fs').onchange = e => { f.st = e.target.value; draw(); }; draw();
  },

  classes() {
    const list = S.d.students.filter(s=>s.status !== 'pending' && (S.year < S.d.current.year || s.status !== 'inactive'));
    const select = S.f.cls || CLASSES[0];
    const records = list.filter(s => (s.classHistory && s.classHistory[S.year] || s.className) === select);
    page(`${head('Classes — Year ' + S.year)}<div class="classgrid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:9px;margin-bottom:15px">${CLASSES.map(c=>`<button data-classcard="${esc(c)}" class="card" style="cursor:pointer;text-align:left;padding:12px"><b>${esc(c)}</b><span class="sub">${list.filter(s=>(s.classHistory?.[S.year]||s.className)===c).length} student(s)</span></button>`).join('')}</div><div class="bar"><label>Choose class</label><select id="classpick">${CLASSES.map(c=>`<option ${select === c ? 'selected' : ''}>${c}</option>`).join('')}</select><span class="muted">${records.length} active students</span></div>
    <div class="card"><h3>${esc(select)} · ${S.year}</h3>${records.length ? `<table class="t"><thead><tr><th>Admission no.</th><th>Student</th><th>Day / Boarding</th><th>Status</th></tr></thead><tbody>${records.map(s=>`<tr><td>${esc(s.id)}</td><td>${esc(s.first + ' ' + s.last)}</td><td>${typeLabel(s.type)}</td><td>${stChip(s)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No active students in this class.</div>'}</div>`);
    $('#classpick').onchange = e=>{S.f.cls=e.target.value;PAGES.classes();}; $$('[data-classcard]').forEach(b=>b.onclick=()=>{S.f.cls=b.dataset.classcard;PAGES.classes();});
  },
  discipline() {
    const sList = S.d.students.filter(s=>s.status !== 'pending');
    const rows = S.d.discipline || [];
    page(`${head('Disciplinary Records','<button class="pri" id="newdiscipline">＋ Record case</button>')}<div class="banner info">Record suspension or expulsion with a reason. Records are retained permanently; expulsion makes a student inactive without deleting admission or payment history.</div><div class="card">${rows.length ? `<table class="t"><thead><tr><th>Date</th><th>Student</th><th>Class</th><th>Decision</th><th>Reason</th><th>Return date</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.studentName)}<span class="sub">${esc(r.studentId)}</span></td><td>${esc(r.className)}</td><td>${chip(r.action.toUpperCase(),r.action === 'expulsion'?'red':'amber')}</td><td>${esc(r.reason)}</td><td>${esc(r.end || '—')}</td><td>${chip(r.cancelledAt ? 'REVERSED' : 'ACTIVE',r.cancelledAt ? 'grey' : 'amber')}</td><td><button class="sm" data-letter="${esc(r.id)}">Print notice</button>${r.cancelledAt ? '' : `<button class="sm danger" data-reverse="${esc(r.id)}">Cancel ${esc(r.action)}</button>`}</td></tr>`).join('')}</tbody></table>`:'<div class="empty">No disciplinary cases recorded.</div>'}</div>`);
    $$('[data-letter]').forEach(b=>b.onclick=()=>{
      const r=rows.find(x=>x.id===b.dataset.letter);if(!r)return;
      const body=`<main style="font:15px/1.8 Georgia,serif;max-width:175mm;margin:12mm auto;color:#15263e"><header style="text-align:center;border-bottom:3px double #172c50;padding-bottom:12px"><h2 style="margin:0">BILL GATES JUNIOR SCHOOL NSANGI</h2><small>OFFICIAL DISCIPLINARY NOTICE</small></header><p>Date: ${esc(r.date)}</p><p>To: Parent / Guardian of <b>${esc(r.studentName)}</b><br>Admission No.: ${esc(r.studentId)}<br>Class: ${esc(r.className)}</p><h3>RE: NOTICE OF ${esc(r.action.toUpperCase())}</h3><p>Dear Parent / Guardian,</p><p>This letter formally notifies you that ${esc(r.studentName)} has been ${r.action === 'suspension' ? 'suspended' : 'expelled'} from Bill Gates Junior School Nsangi.</p><p><b>Reason:</b> ${esc(r.reason)}</p><p><b>Effective date:</b> ${esc(r.date)}${r.end?`<br><b>Return date:</b> ${esc(r.end)}`:''}</p><p>Please contact the school administration for further guidance.</p><p style="margin-top:35px">Yours faithfully,<br>________________________<br>School Administration</p></main>`;
      printRaw(body,'@page{size:A4;margin:15mm}body{margin:0}', 'Disciplinary notice');
    });
    $$('[data-reverse]').forEach(b=>b.onclick=()=>{const r=rows.find(x=>x.id===b.dataset.reverse);if(!r)return;const m=modal('Cancel disciplinary action',`<p>The original ${esc(r.action)} case will remain in the history, marked as reversed.</p><div class="field"><label>Reason for cancelling *</label><textarea id="reverseReason" maxlength="1200" required></textarea></div><div class="mf"><button data-x2>Back</button><button class="pri" id="reverseGo">Confirm cancellation</button></div>`);$('[data-x2]',m).onclick=closeModal;$('#reverseGo').onclick=()=>run(async()=>{await api('hm.cancelDiscipline',{id:r.id,reason:$('#reverseReason').value});closeModal();toast('Action reversed; history retained');refresh();});});
    $('#newdiscipline').onclick = ()=>{
      const m=modal('Record disciplinary action',`<form id="disciplineForm"><div class="field"><label>Student</label><input type="search" id="disciplineStudentSearch" autocomplete="off" placeholder="Search student by name, class or admission number" required><input type="hidden" name="studentId" id="disciplineStudentId"><div id="disciplineMatches" class="student-matches"></div><div id="disciplineSelected" class="muted">No student selected</div></div><div class="grid2"><div class="field"><label>Decision</label><select name="action"><option value="suspension">Suspension</option><option value="expulsion">Expulsion</option></select></div><div class="field"><label>Date</label><input type="date" name="date" value="${localISO()}"></div><div class="field"><label>Suspension return date (if applicable)</label><input type="date" name="end"></div></div><div class="field"><label>Reason *</label><textarea name="reason" required maxlength="1200"></textarea></div><div class="field"><label>Additional notes</label><textarea name="notes" maxlength="1200"></textarea></div><div class="mf"><button type="button" data-x2>Cancel</button><button class="pri" type="submit">Save case</button></div></form>`);
      const search=$('#disciplineStudentSearch'), matches=$('#disciplineMatches'), chosen=$('#disciplineStudentId');
      const showMatches=()=>{const q=search.value.trim().toLowerCase();const filtered=q?sList.filter(s=>(s.first+' '+s.last+' '+s.id+' '+s.className).toLowerCase().includes(q)).slice(0,15):[];matches.innerHTML=filtered.map(s=>`<button type="button" class="student-hit" data-id="${esc(s.id)}">${esc(s.first+' '+s.last)} · ${esc(s.className)} · ${esc(s.id)}</button>`).join('')||(q?'<div class="muted">No matching students</div>':'');$$('[data-id]',matches).forEach(b=>b.onclick=()=>{const s=sList.find(x=>x.id===b.dataset.id);chosen.value=s.id;search.value=s.first+' '+s.last+' ('+s.id+')';$('#disciplineSelected').textContent='Selected: '+s.className+' · '+s.id;matches.innerHTML='';});};
      search.oninput=()=>{chosen.value='';$('#disciplineSelected').textContent='Choose a student from the search results';showMatches();};
      $('[data-x2]',m).onclick=closeModal;
      $('#disciplineForm').onsubmit=e=>{e.preventDefault();run(async()=>{const f=Object.fromEntries(new FormData(e.target));if(!f.studentId)throw new Error('Search and select a student first.');if(f.action==='expulsion'&&!confirm('Expel this student and mark them inactive?'))return;await api('hm.addDiscipline',f);closeModal();toast('Disciplinary case saved');refresh();});};
    };
  },
  /* ================= School fees ================= */
  fees() {
    const draw = () => {
      const f = S.f, list = S.d.students.filter(s => s.fee.has && hit(s, f.q) && (!f.cls || s.className === f.cls) && (!f.fee || s.fee.status === f.fee));
      const tot = list.reduce((a, s) => ({ due: a.due + s.fee.due, paid: a.paid + s.fee.paid, bal: a.bal + s.fee.balance, arr: a.arr + s.fee.arrears }), { due: 0, paid: 0, bal: 0, arr: 0 });
      $('#tbl').innerHTML = list.length ? `<table class="t"><thead><tr><th>Student</th><th>Class</th><th>Type</th><th class="n">Fees due</th><th class="n">Paid</th><th class="n">Balance</th><th class="n">Earlier terms owed</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map(s => `<tr><td>${nameCell(s)}${s.status === 'inactive' ? ' ' + chip('INACTIVE', 'grey') : ''}</td><td>${esc(s.className)}</td><td>${typeLabel(s.fee.type)}</td><td class="n">${num(s.fee.due)}</td><td class="n paid">${num(s.fee.paid)}</td><td class="n ${s.fee.balance ? 'owe' : 'paid'}">${num(s.fee.balance)}</td><td class="n ${s.fee.arrears ? 'owe' : ''}">${num(s.fee.arrears)}</td><td>${feeChip(s.fee.status)}</td>
      <td class="act">${s.fee.balance ? `<button class="pri sm" data-fp="${esc(s.id)}">Record payment</button>` : ''}<button class="sm" data-fh="${esc(s.id)}">History</button></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3">TOTAL (${list.length} students)</td><td class="n">${num(tot.due)}</td><td class="n">${num(tot.paid)}</td><td class="n">${num(tot.bal)}</td><td class="n">${num(tot.arr)}</td><td colspan="2"></td></tr></tfoot></table>` : '<div class="empty">No fee records for this term yet. Bills appear for every active student once the term is the current term.</div>';
      $$('[data-fp]').forEach(b => b.onclick = () => feePay(b.dataset.fp)); $$('[data-fh]').forEach(b => b.onclick = () => feeHistory(b.dataset.fh));
    };
    const f = S.f;
    page(`${head('School Fees — ' + termTxt(S.year, S.term))}${readOnlyViewNote()}<div class="banner info">Fees per term: Nursery (Baby–Top) <b>${money(FEE_TABLE.nursery)}</b> · P1–P4 day <b>${money(FEE_TABLE.lower)}</b> · P5–P7 day <b>${money(FEE_TABLE.upper)}</b> · Boarding (all classes) <b>${money(FEE_TABLE.boarding)}</b></div>
    <div class="bar"><input type="search" id="q" placeholder="Search student…" value="${esc(f.q)}"><select id="fc">${clsOpts(f.cls)}</select><select id="ff"><option value="">All payment states</option>${[['unpaid', 'Not paid'], ['partial', 'Partly paid'], ['paid', 'Fully paid']].map(o => `<option value="${o[0]}" ${f.fee === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div><div id="tbl"></div>`);
    bindSearch('q', 'q', draw); $('#fc').onchange = e => { f.cls = e.target.value; draw(); }; $('#ff').onchange = e => { f.fee = e.target.value; draw(); }; draw();
  },

  /* ================= Staff ================= */
  staff() {
    const draw = () => {
      const f = S.f, list = S.d.staff.filter(w => (f.st2 === 'all' || w.status === (f.st2 || 'active')) && (!f.q || (w.first + ' ' + w.last + ' ' + w.title).toLowerCase().includes(f.q.toLowerCase())));
      const act = list.filter(w => w.status === 'active'), t = list.reduce((a, w) => ({ d: a.d + w.period.demand, p: a.p + w.period.paid, b: a.b + w.period.balance }), { d: 0, p: 0, b: 0 });
      $('#tbl').innerHTML = list.length ? `<table class="t"><thead><tr><th>Worker</th><th>Job title</th><th class="n">Salary demanded (month)</th><th class="n">Paid</th><th class="n">Balance to pay</th><th>Status</th><th></th></tr></thead><tbody>
      ${list.map(w => `<tr><td><div class="nm"><span class="avatar">${esc(initials(w.first, w.last))}</span><span><b>${esc(w.first + ' ' + w.last)}</b><span class="sub">${esc(w.id)} · ${esc(w.phone)}</span></span></div></td><td>${esc(w.title)}</td>
      <td class="n owe">${num(w.period.demand)}</td><td class="n paid">${num(w.period.paid)}</td><td class="n ${w.period.balance ? 'owe' : 'paid'}">${w.period.demand ? (w.period.balance ? num(w.period.balance) : 'CLEARED') : '—'}</td><td>${w.status === 'active' ? chip('ACTIVE', 'green') : chip('INACTIVE', 'grey')}</td>
      <td class="act">${w.period.balance ? `<button class="pri sm" data-sp="${esc(w.id)}">Pay salary</button>` : ''}<button class="sm" data-se="${esc(w.id)}">Edit</button>${w.status === 'active' ? `<button class="sm danger" data-ss="${esc(w.id)}|inactive">Make inactive</button>` : `<button class="sm ok" data-ss="${esc(w.id)}|active">Make active</button>`}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="2">TOTAL</td><td class="n owe">${num(t.d)}</td><td class="n">${num(t.p)}</td><td class="n">${num(t.b)}</td><td colspan="2"></td></tr></tfoot></table>` : '<div class="empty">No workers yet. Use “Add worker”.</div>';
      $$('[data-sp]').forEach(b => b.onclick = () => salaryPay(b.dataset.sp)); $$('[data-se]').forEach(b => b.onclick = () => staffForm(b.dataset.se));
      $$('[data-ss]').forEach(b => b.onclick = () => run(async () => { const [id, st] = b.dataset.ss.split('|'); if (!confirm(`Make this worker ${st}? Their records are kept either way.`)) return; await api('hm.setStaffStatus', { id, status: st }); toast('Worker is now ' + st); refresh(); }));
    };
    const f = S.f;
    page(`${head('Staff & Salaries', '<button class="pri" id="addw">＋ Add worker</button>')}<div class="bar"><div><label>Salary month</label><input type="month" id="pm" value="${S.period}"></div><input type="search" id="q" placeholder="Search worker…" value="${esc(f.q)}" style="margin-top:18px">
    <select id="fs2" style="margin-top:18px">${[['active', 'Active workers'], ['inactive', 'Inactive workers'], ['all', 'All workers']].map(o => `<option value="${o[0]}" ${(f.st2 || 'active') === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}</select></div>
    <div class="banner info">The salary shown in <b style="color:var(--red)">red</b> is what the school owes that worker for the month. Each payment reduces the balance and creates a receipt. Workers are never deleted — mark them inactive.</div><div id="tbl"></div>`);
    $('#pm').onchange = e => { if (e.target.value) { S.period = e.target.value; refresh(); } }; bindSearch('q', 'q', draw); $('#fs2').onchange = e => { f.st2 = e.target.value; draw(); }; $('#addw').onclick = () => staffForm(); draw();
  },

  /* ================= Receipts ================= */
  receipts() {
    const draw = () => {
      const f = S.f; const kinds = { all: 'All receipts', fees: 'School fees', admission: 'Admission fees', salary: "Teachers' salaries" };
      const list = S.d.payments.filter(p => (f.rcpt === 'all' || p.kind === f.rcpt) && (!f.from || p.date >= f.from) && (!f.to || p.date <= f.to) && (!f.q || (p.receiptNo + ' ' + (p.studentName || p.staffName) + ' ' + (p.studentId || '')).toLowerCase().includes(f.q.toLowerCase())));
      const sum = list.filter(p => !p.void).reduce((a, p) => a + p.amount, 0);
      $('#tbl').innerHTML = list.length ? `<table class="t"><thead><tr><th>Receipt No.</th><th>Date & time</th><th>Name</th><th>Purpose</th><th class="n">Amount</th><th class="n">Balance after</th><th></th></tr></thead><tbody>
      ${list.map(p => `<tr style="${p.void ? 'opacity:.55;text-decoration:line-through' : ''}"><td><b>${esc(p.receiptNo)}</b></td><td class="nowrap">${fmtDT(p.ts)}</td><td>${esc(p.studentName || p.staffName)}<span class="sub">${esc(p.studentId || p.title || '')}</span></td><td>${kindChip(p.kind)} <span class="sub">${p.kind === 'salary' ? monthName(p.period) : p.kind === 'fees' ? termTxt(p.year, p.term) : ''}</span></td>
      <td class="n"><b>${money(p.amount)}</b></td><td class="n ${p.balance ? 'owe' : 'paid'}">${num(p.balance)}</td><td class="act">${p.void ? chip('CANCELLED', 'red') : `<button class="sm" data-rp="${esc(p.id)}">🖨 Print</button>${p.kind === 'admission' ? '' : `<button class="sm danger" data-rv="${esc(p.id)}">Cancel</button>`}`}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4">TOTAL (${list.filter(p => !p.void).length} receipts)</td><td class="n">${money(sum)}</td><td colspan="2"></td></tr></tfoot></table>` : '<div class="empty">No receipts.</div>';
      $$('[data-rp]').forEach(b => b.onclick = () => printReceipt(S.d.payments.find(p => p.id === b.dataset.rp)));
      $$('[data-rv]').forEach(b => b.onclick = () => voidReceipt(b.dataset.rv));
    };
    const f = S.f;
    page(`${head('Payment Receipts')}<div class="bar"><div class="seg">${[['all', 'All'], ['fees', 'School fees'], ['admission', 'Admission fees'], ['salary', "Teachers' salaries"]].map(k => `<button data-k="${k[0]}" class="${f.rcpt === k[0] ? 'on' : ''}">${k[1]}</button>`).join('')}</div>
    <input type="search" id="q" placeholder="Receipt no. or name…" value="${esc(f.q)}"><label style="margin:0">From <input type="date" id="df" value="${f.from}"></label><label style="margin:0">To <input type="date" id="dt" value="${f.to}"></label></div><div id="tbl"></div>`);
    $$('[data-k]').forEach(b => b.onclick = () => { f.rcpt = b.dataset.k; PAGES.receipts(); }); bindSearch('q', 'q', draw); $('#df').onchange = e => { f.from = e.target.value; draw(); }; $('#dt').onchange = e => { f.to = e.target.value; draw(); }; draw();
  },

  /* ================= Academic reports (read-only) ================= */
  async reports() {
    page(head('Academic Reports') + '<div id="rv"></div>');
    reportsView = ReportsView($('#rv'), { note: '🔒 <b>Read-only.</b> Marks are entered by the Director of Studies on the Teachers\' PC and arrive here automatically. You can choose any year, term, exam and class, add your head teacher\'s remark, and print individual or whole-class reports.', getData: async y => { const r = await api('hm.marks', { year: y }); return { ...r, current: S.d.current }; }, saveRemark: (id, teacher, head) => api('hm.saveRemark', { id, teacher, head }) });
    await reportsView.start({ year: S.year, term: S.term });
  },

  /* ================= Settings ================= */
  async settings() {
    const st = await api('settings.get'), c = S.d.current; S.sync = st.cloud.status;
    page(`${head('Settings & Backup')}
    <div class="card"><h3>Current term</h3><p class="muted">Bills for the new term are created for all active students using today's class and Day/Boarding type. Earlier balances remain as “earlier terms owed”.</p>
    <div class="bar"><select id="cy">${[c.year + 1, c.year, c.year - 1].filter(y => y >= 2026).map(y => `<option ${y === c.year ? 'selected' : ''}>${y}</option>`).join('')}</select><select id="ct">${[1, 2, 3].map(t => `<option value="${t}" ${t === c.term ? 'selected' : ''}>Term ${t}</option>`).join('')}</select><button class="pri" id="setcur">Make this the current term</button> <span class="muted">Now: ${termTxt(c.year, c.term)}</span></div></div>
    <div class="card"><h3>Teachers' PC connection</h3><p class="muted">On the Teachers' PC choose “Teachers' PC”, then type this computer's address and the school key. Both PCs must be on the same network (WiFi or cable). If Windows asks about the firewall, tick <b>Private networks</b> and Allow.</p>
    <p>Address: ${st.lan.ips.length ? st.lan.ips.map(i => `<code>${i}:${st.lan.port}</code>`).join(' ') : '<span class="owe">No network found – connect to WiFi / cable</span>'}</p><p>School key: <span class="keybox">${esc(st.lan.key)}</span> <button class="sm" id="newkey">Make a new key</button></p>${st.lan.error ? `<p class="err">Server problem: ${esc(st.lan.error)}</p>` : ''}</div>
    <div class="card"><h3>Cloud backup</h3><p class="muted">Every change (marks, payments, receipts, students, staff) is sent to your cloud database straight away. If the internet is down, changes wait safely on this PC and are sent when it returns.</p>
    <div class="grid2"><div class="field"><label>Cloud address (Supabase Project URL)</label><input id="cu" placeholder="https://xxxxxxxx.supabase.co" value="${esc(st.cloud.url)}"></div><div class="field"><label>Secret key (service_role) ${st.cloud.hasKey ? '— saved ✓ (leave empty to keep)' : ''}</label><input id="ck" type="password" placeholder="${st.cloud.hasKey ? '••••••••' : 'Paste key'}"></div></div>
    <div class="bar"><button class="pri" id="csave">Save cloud settings</button><button id="ctest">Test connection</button><button id="cpush">Send everything now</button><button id="crestore">☁ Restore from Supabase…</button><span id="cst"></span></div>
    <details><summary>How to set up the free cloud database (once, ~5 minutes)</summary><ol><li>Go to <b>supabase.com</b> → create a free account → “New project” (pick a region close to you, e.g. Europe/Frankfurt or South Africa).</li><li>Open <b>SQL Editor</b>, paste the text below, press Run.</li><li>Open <b>Project Settings → API</b>. Copy the <b>Project URL</b> and the <b>service_role</b> key into the boxes above. Keep that key private.</li></ol><pre id="sql">create table if not exists records (
  key text primary key,
  collection text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table records enable row level security;</pre><button class="sm" id="cpsql">Copy SQL</button></details></div>
    <div class="card"><h3>Backup on this computer</h3><p class="muted">An automatic updated backup is saved after changes (checked every 30 seconds), and a backup is also saved when the program opens, in <code>${esc(st.backupDir)}</code> (last 40 kept). Also copy that folder to a flash disk regularly.</p><div class="bar"><button class="pri" id="bnow">Back up now</button><button id="brest">Restore from a backup file…</button></div></div>
    <div class="card"><h3>Headteacher password</h3><div class="bar"><input type="password" id="po" placeholder="Current password"><input type="password" id="pn" placeholder="New password"><button id="pchg">Change password</button></div></div>`);
    paintCloudSt(); loadSync();
    $('#setcur').onclick = () => run(async () => { await api('hm.setCurrentTerm', { year: +$('#cy').value, term: +$('#ct').value }); S.year = +$('#cy').value; S.term = +$('#ct').value; toast('Current term changed'); refresh(); });
    $('#newkey').onclick = () => run(async () => { if (confirm('Teachers will need to type the new key. Continue?')) { await api('settings.newKey'); refresh(); } });
    $('#csave').onclick = () => run(async () => { await api('settings.cloud', { url: $('#cu').value, key: $('#ck').value }); toast('Saved'); $('#ck').value = ''; });
    $('#ctest').onclick = () => run(async () => { await api('settings.cloud', { url: $('#cu').value, key: $('#ck').value }); await api('cloud.test'); toast('✓ Cloud connection works'); });
    $('#cpush').onclick = () => run(async () => { toast('Sending…'); S.sync = await api('cloud.pushAll'); paintCloudSt(); toast(S.sync.error ? S.sync.error : '✓ Everything is in the cloud', !!S.sync.error); });
    $('#crestore').onclick = () => run(async () => {
      const info=await api('cloud.previewRestore');
      const n=Object.entries(info.counts).map(([k,v])=>`${esc(k)}: <b>${v}</b>`).join(' · ');
      const m=modal('Restore school records from Supabase',`<div class="banner">The cloud has ${info.records} records, academic year ${info.year}, Term ${info.term}.</div><p>${n}</p><p><b>Warning:</b> This replaces the Headteacher PC's local records. The current local database is saved first. Ensure the Teachers' PC is disconnected until recovery is verified.</p><div class="field"><label>Type RESTORE SCHOOL to confirm</label><input id="confirmrestore" autocomplete="off"></div><div class="mf"><button data-x2>Cancel</button><button class="danger" id="applyrestore">Restore cloud records</button></div>`);
      $('[data-x2]',m).onclick=closeModal;
      $('#applyrestore').onclick=()=>run(async()=>{const r=await api('cloud.restore',{confirm:$('#confirmrestore').value});closeModal();toast('Restored '+r.records+' cloud records. Verify totals before continuing.');await refresh();});
    });
    $('#cpsql').onclick = () => { navigator.clipboard.writeText($('#sql').textContent); toast('SQL copied'); };
    $('#bnow').onclick = () => run(async () => { const r = await api('backup.now'); toast('Saved: ' + r.file); });
    $('#brest').onclick = () => run(() => api('backup.restore'));
    $('#pchg').onclick = () => run(async () => { await api('auth.change', { old: $('#po').value, pw: $('#pn').value }); toast('Password changed'); $('#po').value = $('#pn').value = ''; });
    function paintCloudSt() { const s = S.sync; $('#cst').innerHTML = s ? `<span class="muted">${s.state === 'off' ? 'Not set up' : s.state === 'ok' ? '✓ Up to date' : s.pending + ' waiting'}${s.error ? ' · <span class="owe">' + esc(s.error) + '</span>' : ''}</span>` : ''; }
  },
};
const kindChip = k => k === 'fees' ? chip('SCHOOL FEES', 'blue') : k === 'admission' ? chip('ADMISSION', 'amber') : chip('SALARY', 'grey');

/* ================= Dialogs / actions ================= */
function newApplication() {
  const m = modal('New application', `<form id="af"><div class="grid2"><div class="field"><label>First name *</label><input name="first" required></div><div class="field"><label>Surname *</label><input name="last" required></div>
  <div class="field"><label>Class applying for *</label><select name="className">${CLASSES.map(c => `<option>${c}</option>`).join('')}</select></div><div class="field"><label>Day or Boarding</label><select name="type"><option value="day">Day student</option><option value="boarding">Boarding student</option></select></div>
  <div class="field"><label>Gender</label><select name="gender"><option value="">—</option><option>Female</option><option>Male</option></select></div><div class="field"><label>Date of birth</label><input type="date" name="dob"></div>
  <div class="field"><label>Parent / Guardian</label><input name="parent"></div><div class="field"><label>Phone</label><input name="phone"></div></div><div class="field"><label>Home address</label><input name="address"></div>
  <div class="sumbox"><div><span>Admission fee</span><b>${money(ADMISSION_FEE)}</b></div></div><div class="grid2"><div class="field"><label>Amount paid now (UGX) – leave empty if nothing</label><input class="money" name="paidNow" inputmode="numeric" placeholder="0"></div><div class="field"><label>Method</label><select name="method"><option>Cash</option><option>Mobile Money</option><option>Bank</option></select></div></div>
  <div class="mf" style="padding:0"><button type="button" data-x2>Cancel</button><button class="pri" type="submit">Save application</button></div></form>`);
  $('[data-x2]', m).onclick = closeModal;
  $('#af').onsubmit = e => { e.preventDefault(); run(async () => { const f = Object.fromEntries(new FormData(e.target)); const r = await api('hm.addApplication', f); closeModal(); S.page = 'applications'; S.f.adm = 'pending'; await refresh(); if (r.receipt) showReceipt(r.receipt, `Application saved – ${r.student.id}`); else toast(`Saved as ${r.student.id} – admission fee pending (${money(ADMISSION_FEE)})`); }); };
}
function payDialog({ title, rows, max, onPay, who }) {
  const m = modal(title, `<p style="margin-top:0"><b>${esc(who)}</b></p><div class="sumbox">${rows.map(r => `<div><span>${r[0]}</span><b class="${r[2] || ''}">${r[1]}</b></div>`).join('')}</div>
  <form id="pf"><div class="field"><label>Amount received now (UGX)</label><input id="pa" class="money" inputmode="numeric" placeholder="e.g. ${num(Math.min(max, 50000))}" required autocomplete="off"></div>${methodSel()}
  <div class="sumbox" id="after"><div class="tot"><span>Balance after this payment</span><b>${money(max)}</b></div></div><div class="mf" style="padding:0"><button type="button" data-x2>Cancel</button><button class="ok" type="button" id="full">Pay full balance</button><button class="pri" type="submit">Record payment & make receipt</button></div></form>`);
  const upd = () => { const v = parseMoney($('#pa').value), b = max - v; $('#after').innerHTML = `<div class="tot"><span>Balance after this payment</span><b class="${b < 0 ? 'owe' : b ? 'owe' : 'paid'}">${b < 0 ? 'More than owed!' : b ? money(b) : 'CLEARED'}</b></div>`; };
  $('#pa').oninput = upd; $('#full').onclick = () => { $('#pa').value = num(max); upd(); }; $('[data-x2]', m).onclick = closeModal;
  $('#pf').onsubmit = e => { e.preventDefault(); run(async () => { const r = await onPay($('#pa').value, $('#fm').value); closeModal(); await refresh(); showReceipt(r.p || r, r.headline); }); };
}
function admissionPay(id) {
  const s = S.d.students.find(x => x.id === id), a = s.admission;
  payDialog({ title: 'Admission fee payment', who: `${s.first} ${s.last} · ${s.id} · ${s.className}`, max: a.balance, rows: [['Admission fee', money(a.fee)], ['Paid so far', money(a.paid), 'paid'], ['Remaining balance', money(a.balance), 'owe']],
    onPay: async (amount, method) => { const p = await api('hm.payAdmission', { id, amount, method }); return { p, headline: p.balance ? 'Part payment recorded – still PENDING' : '✓ Admission complete – student is now PAID · ACTIVE' }; } });
}
function feePay(id) {
  const s = S.d.students.find(x => x.id === id), f = s.fee;
  payDialog({ title: `School fees – ${termTxt(S.year, S.term)}`, who: `${s.first} ${s.last} · ${s.id} · ${s.className} · ${typeLabel(f.type)}`, max: f.balance, rows: [['Fees for the term', money(f.due)], ['Paid so far', money(f.paid), 'paid'], ['Balance', money(f.balance), 'owe']],
    onPay: async (amount, method) => ({ p: await api('hm.payFees', { id, year: S.year, term: S.term, amount, method }) }) });
}
function salaryPay(id) {
  const w = S.d.staff.find(x => x.id === id), p = w.period;
  payDialog({ title: `Pay salary – ${monthName(p.key)}`, who: `${w.first} ${w.last} · ${w.title}`, max: p.balance, rows: [['Salary demanded', money(p.demand), 'owe'], ['Already paid', money(p.paid), 'paid'], ['Balance to pay', money(p.balance), 'owe']],
    onPay: async (amount, method) => ({ p: await api('hm.paySalary', { id, period: p.key, amount, method }) }) });
}
function feeHistory(id) {
  const s = S.d.students.find(x => x.id === id), list = S.d.payments.filter(p => p.studentId === id);
  modal(`Payment history – ${esc(s.first + ' ' + s.last)}`, list.length ? `<table class="t"><thead><tr><th>Receipt</th><th>Date</th><th>For</th><th class="n">Paid</th><th class="n">Balance</th></tr></thead><tbody>${list.map(p => `<tr style="${p.void ? 'opacity:.5;text-decoration:line-through' : ''}"><td>${esc(p.receiptNo)}</td><td>${fmtDT(p.ts)}</td><td>${p.kind === 'admission' ? 'Admission' : termTxt(p.year, p.term)}</td><td class="n">${num(p.amount)}</td><td class="n">${num(p.balance)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No payments yet.</div>', { wide: true });
}
function switchType(id) {
  const s = S.d.students.find(x => x.id === id), to = s.type === 'day' ? 'boarding' : 'day', c = S.d.current;
  const oldFee = feeFor(s.className, s.type), newFee = feeFor(s.className, to), paid = s.fee.has && S.year === c.year && S.term === c.term ? s.fee.paid : null;
  const m = modal(`Switch to ${typeLabel(to)}`, `<p><b>${esc(s.first + ' ' + s.last)}</b> (${esc(s.className)}) will change from <b>${typeLabel(s.type)}</b> to <b>${typeLabel(to)}</b>.</p>
  <div class="sumbox"><div><span>Fees for ${termTxt(c.year, c.term)} now</span><b>${money(oldFee)}</b></div><div><span>New fees</span><b>${money(newFee)}</b></div>${paid != null ? `<div><span>Already paid</span><b class="paid">${money(paid)}</b></div><div class="tot"><span>New balance</span><b class="owe">${money(Math.max(0, newFee - paid))}</b></div>` : ''}</div>
  <p class="muted">Fees are adjusted automatically. Earlier terms are not changed.</p><div class="mf" style="padding:0"><button data-x2>Cancel</button><button class="pri" id="go">Yes, switch to ${typeLabel(to)}</button></div>`);
  $('[data-x2]', m).onclick = closeModal; $('#go').onclick = () => run(async () => { await api('hm.setType', { id, type: to }); closeModal(); toast(`Now a ${typeLabel(to)} student – fees updated`); refresh(); });
}
function toggleStatus(id, status) {
  const s = S.d.students.find(x => x.id === id);
  const m = modal(status === 'inactive' ? 'Make student inactive' : 'Make student active', `<p><b>${esc(s.first + ' ' + s.last)}</b> (${esc(s.className)}) will be marked <b>${status.toUpperCase()}</b>. Nothing is deleted – all records stay.</p>${status === 'inactive' ? '<div class="field"><label>Reason (e.g. suspended, indiscipline, left)</label><input id="rs"></div>' : ''}<div class="mf" style="padding:0"><button data-x2>Cancel</button><button class="${status === 'inactive' ? 'danger' : 'ok'}" id="go">Confirm</button></div>`);
  $('[data-x2]', m).onclick = closeModal; $('#go').onclick = () => run(async () => { await api('hm.setStudentStatus', { id, status, reason: $('#rs') ? $('#rs').value : '' }); closeModal(); toast(`Student is now ${status}`); refresh(); });
}
function editStudent(id) {
  const s = S.d.students.find(x => x.id === id);
  const m = modal(`Edit – ${esc(s.id)}`, `<form id="ef"><div class="grid2"><div class="field"><label>First name</label><input name="first" value="${esc(s.first)}"></div><div class="field"><label>Surname</label><input name="last" value="${esc(s.last)}"></div>
  <div class="field"><label>Class</label><select name="className">${CLASSES.map(c => `<option ${c === s.className ? 'selected' : ''}>${c}</option>`).join('')}</select></div><div class="field"><label>Gender</label><select name="gender">${['', 'Female', 'Male'].map(g => `<option ${g === s.gender ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
  <div class="field"><label>Parent / Guardian</label><input name="parent" value="${esc(s.parent)}"></div><div class="field"><label>Phone</label><input name="phone" value="${esc(s.phone)}"></div></div><div class="field"><label>Address</label><input name="address" value="${esc(s.address || '')}"></div>
  <p class="muted">Changing the class also updates this term's fees automatically (e.g. P4 → P5).</p><div class="mf" style="padding:0"><button type="button" data-x2>Cancel</button><button class="pri" type="submit">Save</button></div></form>`);
  $('[data-x2]', m).onclick = closeModal; $('#ef').onsubmit = e => { e.preventDefault(); run(async () => { await api('hm.updateStudent', { id, f: Object.fromEntries(new FormData(e.target)) }); closeModal(); toast('Saved'); refresh(); }); };
}
function staffForm(id) {
  const w = id ? S.d.staff.find(x => x.id === id) : {};
  const m = modal(id ? 'Edit worker' : 'Add worker', `<form id="wf"><div class="grid2"><div class="field"><label>First name *</label><input name="first" value="${esc(w.first || '')}" required></div><div class="field"><label>Surname *</label><input name="last" value="${esc(w.last || '')}" required></div>
  <div class="field"><label>Job title *</label><input name="title" value="${esc(w.title || '')}" placeholder="e.g. Class teacher, Cook, Driver" required></div><div class="field"><label>Phone</label><input name="phone" value="${esc(w.phone || '')}"></div>
  <div class="field"><label>Monthly salary (UGX) *</label><input class="money" inputmode="numeric" name="salary" value="${w.salary ? num(w.salary) : ''}" required></div>${id ? '' : `<div class="field"><label>Date employed</label><input type="date" name="employedOn" value="${localISO()}"></div>`}</div>
  ${id ? '<p class="muted">A salary change applies to months not yet paid; months that already have a payment keep their original amount.</p>' : ''}<div class="mf" style="padding:0"><button type="button" data-x2>Cancel</button><button class="pri" type="submit">Save</button></div></form>`);
  $('[data-x2]', m).onclick = closeModal; $('#wf').onsubmit = e => { e.preventDefault(); run(async () => { const f = Object.fromEntries(new FormData(e.target)); if (id) await api('hm.updateStaff', { id, f }); else await api('hm.addStaff', f); closeModal(); toast('Saved'); refresh(); }); };
}
function voidReceipt(id) {
  const m = modal('Cancel receipt ' + id, `<p>The receipt stays in the list marked <b>CANCELLED</b> and the money is taken off the student's / worker's total. Use this only for a recording mistake.</p><div class="field"><label>Reason *</label><input id="vr"></div><div class="mf" style="padding:0"><button data-x2>Keep it</button><button class="danger" id="go">Cancel receipt</button></div>`);
  $('[data-x2]', m).onclick = closeModal; $('#go').onclick = () => run(async () => { await api('hm.voidPayment', { id, reason: $('#vr').value }); closeModal(); toast('Receipt cancelled'); refresh(); });
}
boot();
