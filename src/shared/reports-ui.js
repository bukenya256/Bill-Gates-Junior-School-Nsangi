'use strict';
/* ===== Academic reports screen, identical on both PCs =====
   P.getData(year) -> {students, marks, comments, current}   P.saveRemark(id, teacher, head)   P.note (banner text) */
function ReportsView(root, P) {
  const S = { year: null, term: null, exam: 'EOT', cls: 'P1', data: null, results: [] };
  const years = () => { const cur = (S.data && S.data.current.year) || new Date().getFullYear(); const a = []; for (let y = cur + 1; y >= 2026; y--) a.push(y); return a; };
  const termObj = () => ({ name: 'Term ' + S.term }), examObj = () => EXAMS.find(e => e.id === S.exam);
  const cmtId = sid => `${S.year}|${S.term}|${S.exam}|${sid}`;
  function compute() {
    const d = S.data, map = marksToMap(d.marks);
    const roster = rosterFor(d.students, d.marks, S.year, S.cls, d.current.year);
    S.results = classResults(roster, S.year, S.term, S.exam, map);
  }
  async function load() { S.data = await P.getData(S.year); draw(); }
  function draw() {
    compute(); const rs = S.results, subs = subjectsFor(S.cls);
    const entered = rs.reduce((a, r) => a + r.entered, 0), total = rs.reduce((a, r) => a + r.of, 0);
    const miss = subs.map(s => [s, rs.filter(r => !r.rows.find(x => x.subject === s).entered).length]).filter(x => x[1]);
    root.innerHTML = `${P.note ? `<div class="banner info">${P.note}</div>` : ''}
    <div class="card"><div class="bar" style="margin:0">
      <div><label>Year</label><select id="ry">${years().map(y => `<option ${y === S.year ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
      <div><label>Term</label><select id="rt">${[1, 2, 3].map(t => `<option value="${t}" ${t === S.term ? 'selected' : ''}>Term ${t}</option>`).join('')}</select></div>
      <div><label>Examination</label><select id="re">${EXAMS.map(e => `<option value="${e.id}" ${e.id === S.exam ? 'selected' : ''}>${e.name}</option>`).join('')}</select></div>
      <div><label>Class</label><select id="rc">${CLASSES.map(c => `<option ${c === S.cls ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
      <span style="flex:1"></span>
      <button id="pall" ${rs.length ? '' : 'disabled'}>🖨 Print all report cards (${rs.length})</button>
      <button class="pri" id="psheet" ${rs.length ? '' : 'disabled'}>🖨 Print whole-class results</button></div></div>
    ${rs.length ? `${miss.length ? `<div class="banner"><b>Some marks are still missing</b> (${entered} of ${total} entered): ${miss.map(([s, k]) => `${esc(s)} – ${k} student${k > 1 ? 's' : ''}`).join(', ')}. Missing marks print as “—” and positions may change.</div>` : `<div class="banner info">All ${total} marks for ${esc(S.cls)} are in.</div>`}
    <table class="t"><thead><tr><th>#</th><th>Student</th>${subs.map(s => `<th class="n">${esc(s.replace('Physical Exercise (PE)', 'PE'))}</th>`).join('')}<th class="n">Total</th><th class="n">Avg</th><th>Grade</th><th class="n">Pos</th><th></th></tr></thead><tbody>
    ${rs.map((r, i) => `<tr><td>${i + 1}</td><td><b>${esc(r.st.last)}</b> ${esc(r.st.first)}<span class="sub">${esc(r.st.id)}</span></td>${r.rows.map(x => `<td class="n">${x.absent ? '<span class="muted">ABS</span>' : x.score == null ? '<span class="muted">—</span>' : fmt1(x.score)}</td>`).join('')}<td class="n"><b>${r.sat ? fmt1(r.total) : '—'}</b></td><td class="n">${r.avg == null ? '—' : fmt1(r.avg) + '%'}</td><td>${r.avg == null ? '' : `<span class="chip g-${gradeOf(r.avg).g}">${gradeOf(r.avg).g}</span>`}</td><td class="n"><b>${r.pos ? ordinal(r.pos) : '—'}</b></td><td class="act"><button class="sm" data-pv="${i}">Preview / print</button></td></tr>`).join('')}</tbody></table>`
      : `<div class="empty">No students or marks found for <b>${esc(S.cls)}</b> in ${S.year}.</div>`}`;
    $('#ry', root).onchange = e => { S.year = +e.target.value; load(); };
    $('#rt', root).onchange = e => { S.term = +e.target.value; draw(); }; $('#re', root).onchange = e => { S.exam = e.target.value; draw(); }; $('#rc', root).onchange = e => { S.cls = e.target.value; draw(); };
    $('#pall', root).onclick = () => printCards(); $('#psheet', root).onclick = () => printSheet();
    $$('[data-pv]', root).forEach(b => b.onclick = () => preview(+b.dataset.pv));
  }
  const cm = r => { const c = S.data.comments.find(x => x.id === cmtId(r.st.id)); return c ? { teacher: c.teacher, head: c.head } : defaultRemarks(r.avg); };
  const ctx = () => ({ term: termObj(), year: S.year, exam: examObj(), classSize: S.results.length, cls: S.cls, subjects: subjectsFor(S.cls) });
  const title = () => `${S.cls} ${S.exam} Term ${S.term} ${S.year}`;
  function printCards(one) { const list = one ? [one] : S.results; printHTML(list.map(r => reportCardHTML(r, ctx(), cm(r))).join(''), 'portrait', 'Report cards ' + title()); }
  function printSheet() { printHTML(classSheetHTML(S.results, ctx()), 'landscape', 'Class results ' + title()); }
  function preview(i) {
    const r = S.results[i], c = cm(r);
    const m = modal(`Report card – ${esc(r.st.first + ' ' + r.st.last)}`, `<style>${REPORT_CSS}.rc-page{width:100%;min-height:0;transform-origin:top left}</style>
      <div style="max-height:52vh;overflow:auto;border:1px solid var(--line);border-radius:8px;margin-bottom:12px">${reportCardHTML(r, ctx(), c)}</div>
      <div class="grid2"><div class="field"><label>Class teacher's remark</label><textarea id="ct" rows="3">${esc(c.teacher)}</textarea></div><div class="field"><label>Head teacher's remark</label><textarea id="ch" rows="3">${esc(c.head)}</textarea></div></div>
      <div class="mf" style="padding:0"><button data-pp ${i ? '' : 'disabled'}>← Previous</button><button data-nn ${i < S.results.length - 1 ? '' : 'disabled'}>Next →</button><span style="flex:1"></span><button data-sv>Save remarks</button><button class="pri" data-pr>🖨 Print this report</button></div>`, { wide: true });
    const save = async () => { await run(async () => { await P.saveRemark(cmtId(r.st.id), $('#ct', m).value, $('#ch', m).value); await load(); }); };
    $('[data-sv]', m).onclick = async () => { await save(); toast('Remarks saved'); preview(i); };
    $('[data-pr]', m).onclick = () => { const cc = { teacher: $('#ct', m).value, head: $('#ch', m).value }; P.saveRemark(cmtId(r.st.id), cc.teacher, cc.head); printHTML(reportCardHTML(r, ctx(), cc), 'portrait', 'Report ' + r.st.id); };
    $('[data-pp]', m).onclick = () => preview(i - 1); $('[data-nn]', m).onclick = () => preview(i + 1);
  }
  return { start(cur) { S.year = cur.year; S.term = cur.term; return load(); }, refresh() { return S.year ? load() : null; } };
}
