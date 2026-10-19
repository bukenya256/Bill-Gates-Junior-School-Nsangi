'use strict';
/* ============ Printable reports: individual report card + class sheet ============ */
const REPORT_CSS = `
*{box-sizing:border-box}
.rc-page,.cs-page,.rc-page *,.cs-page *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
.rc-page,.cs-page{font:12px/1.45 "Segoe UI",Arial,Helvetica,sans-serif;color:#14202f;background:#fff}
.rc-page{width:190mm;min-height:272mm;margin:0 auto;padding:8mm 9mm;border:1.6px solid #0f2747;position:relative;display:flex;flex-direction:column;page-break-after:always;break-after:page}
.rc-page:last-child,.cs-page:last-child{page-break-after:auto;break-after:auto}
.rc-head,.cs-head{display:flex;align-items:center;gap:14px;padding-bottom:8px;border-bottom:3px solid #e77722}
.rc-crest{width:58px;height:58px;border-radius:14px;background:#e77722;color:#fff;display:grid;place-items:center;flex:0 0 58px}
.rc-school{flex:1;text-align:center}
.rc-school h1{margin:0;font-size:20px;letter-spacing:.025em;color:#0f2747;font-weight:800}
.rc-school p{margin:2px 0 0;color:#44556b;font-size:11px}
.rc-year{width:58px;text-align:center;font-weight:800;color:#0f2747;font-size:15px;line-height:1.1}.rc-year small{display:block;font-size:8.5px;font-weight:600;color:#6c7b90;letter-spacing:.1em}
.rc-title{margin:9px 0 8px;background:#12304e;color:#fff;text-align:center;font-weight:700;letter-spacing:.08em;padding:6px 8px;font-size:12px;border-radius:3px}
.rc-info{display:grid;grid-template-columns:repeat(6,1fr);gap:0;border:1px solid #b9c5d6;border-radius:4px;overflow:hidden;margin-bottom:10px}
.rc-info div{padding:6px 9px;border-right:1px solid #d6dee9}.rc-info div:last-child{border-right:0}
.rc-info .wide{grid-column:span 2}
.rc-info small{display:block;color:#6c7b90;font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:700}
.rc-info b{font-size:13px;color:#0f2747}
.rc-table{width:100%;border-collapse:collapse;margin-bottom:10px}
.rc-table th{background:#e7eef8;color:#0f2747;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.07em;padding:7px 9px;border:1px solid #b9c5d6}
.rc-table td{padding:11px 9px;border:1px solid #cfd8e5;font-size:12.5px;vertical-align:middle}
.rc-table td.c,.rc-table th.c{text-align:center}
.rc-table .sub{font-weight:650}
.rc-table .mk{font-weight:800;font-size:14px;color:#0f2747;text-align:center;width:70px}
.rc-bar{height:6px;background:#e3e9f2;border-radius:3px;margin-top:4px;overflow:hidden}.rc-bar i{display:block;height:100%;background:#e77722}
.rc-table tfoot td{background:#f3f6fb;font-weight:700}
.rc-sum{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px}
.rc-sum div{border:1px solid #b9c5d6;border-radius:5px;padding:7px 10px;text-align:center}
.rc-sum small{display:block;color:#6c7b90;font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:700}
.rc-sum b{font-size:19px;color:#0f2747}
.rc-sum .pos b{color:#c25a18}
.rc-note{border:1px solid #f1d7a0;background:#fff8e8;color:#7a5a05;padding:5px 9px;border-radius:4px;font-size:10.5px;margin-bottom:8px}
.rc-comments{display:grid;gap:8px;margin-bottom:8px}
.rc-cbox{border:1px solid #b9c5d6;border-radius:5px;padding:7px 10px;min-height:56px}
.rc-cbox small{display:block;color:#6c7b90;font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:700;margin-bottom:2px}
.rc-cbox p{margin:0 0 6px;font-size:12px;min-height:18px;white-space:pre-wrap}
.rc-sign{display:flex;justify-content:flex-end;color:#44556b;font-size:11px;margin-top:20px;padding-top:4px;border-top:0}
.rc-lines i{display:block;height:20px;border-bottom:1px dotted #8d9bb0}
.rc-decision{border:1px solid #aab8c8;border-radius:5px;margin:8px 0 6px;padding:7px 10px;display:flex;align-items:center;justify-content:space-between;gap:10px;break-inside:avoid;page-break-inside:avoid}.rc-decision strong{font-size:10px;color:#0f2747;letter-spacing:.03em}.rc-decision-options{display:flex;gap:22px;align-items:center}.rc-decision-choice{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600}.rc-decision-box{width:13px;height:13px;border:1.5px solid #14202f;display:inline-block;background:#fff;flex:0 0 13px}.rc-key{margin-top:auto;border-top:1px solid #cfd8e5;padding-top:6px;font-size:9.5px;color:#44556b;display:flex;flex-wrap:wrap;gap:4px 12px}
.rc-key b{color:#0f2747}
.rc-foot{margin-top:5px;text-align:center;color:#8a96a8;font-size:9px}
/* class sheet */
.cs-page{padding:0 0 4mm;page-break-after:always;break-after:page}
.cs-head{margin-bottom:6px}.cs-head .rc-school{text-align:left}
.cs-meta{display:flex;gap:18px;margin:6px 0 8px;font-size:11.5px;color:#44556b;flex-wrap:wrap}.cs-meta b{color:#0f2747}
.cs-table{width:100%;border-collapse:collapse;font-size:11.5px}
.cs-table thead{display:table-header-group}.cs-table tr{page-break-inside:avoid;break-inside:avoid}
.cs-table th{background:#0f2747;color:#fff;padding:6px 6px;border:1px solid #0f2747;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;text-align:center}
.cs-table th.l,.cs-table td.l{text-align:left}
.cs-table td{padding:5px 6px;border:1px solid #cfd8e5;text-align:center}
.cs-table tbody tr:nth-child(even) td{background:#f6f9fd}
.cs-table td.tot{font-weight:800;color:#0f2747}
.cs-table td.pos{font-weight:800;color:#c25a18}
.cs-table tfoot td{background:#e7eef8;font-weight:700;color:#0f2747}
.cs-table .miss{color:#a0aab8}
.cs-sign{display:flex;justify-content:space-between;margin-top:22px;font-size:11px;color:#44556b}.cs-sign span{border-top:1px solid #44556b;padding-top:3px;min-width:60mm;text-align:center}
`;

const CREST_SVG = '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5"/></svg>';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ordinal = n => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const fmt1 = n => (n == null ? '—' : (Math.round(n * 10) / 10).toString());

// Default remarks, based on the average. Teachers can overwrite them on the preview screen.
function defaultRemarks(avg) {
  if (avg == null) return { teacher: '', head: '' };
  if (avg >= 80) return { teacher: 'Outstanding performance. Keep up the excellent work.', head: 'Excellent results. Congratulations and keep it up.' };
  if (avg >= 70) return { teacher: 'Very good performance. Keep working hard.', head: 'Very good work. Aim even higher next time.' };
  if (avg >= 60) return { teacher: 'Good performance. With more effort you can do even better.', head: 'Good results. Keep improving.' };
  if (avg >= 50) return { teacher: 'Fair performance. More effort is needed in the weaker subjects.', head: 'Fair results. More effort and regular revision are needed.' };
  if (avg >= 40) return { teacher: 'Below the expected level. Needs extra support and regular practice.', head: 'Needs to work harder. Parents are encouraged to follow up closely.' };
  return { teacher: 'Weak performance. Urgent improvement is needed with help at home and at school.', head: 'Poor results. Please meet the class teacher to agree a plan for improvement.' };
}

// A typed remark prints as text; if it was left empty, ruled lines are printed so it can be written by hand.
const remarkBody = t => (t && t.trim() ? `<p>${esc(t)}</p>` : '<div class="rc-lines"><i></i><i></i></div>');
const gradeKey = () => GRADES.map((g, i) => `<span><b>${g.g}</b> ${i === 0 ? g.min + '–100' : g.min + '–' + (GRADES[i - 1].min - 1)} ${g.label}</span>`).join('');

function schoolHead(cls) {
  return `<div class="${cls}"><div class="rc-crest">${CREST_SVG}</div><div class="rc-school"><h1>${esc(SCHOOL.name.toUpperCase())}</h1><p>Excellence in Learning</p></div></div>`;
}

/** One student's report card (one A4 page). res = result row from the app; ctx = {term, year, exam, classSize} */
function reportCardHTML(res, ctx, comments) {
  const st = res.st, g = gradeOf(res.avg), cm = comments || defaultRemarks(res.avg);
  const rows = res.rows.map(r => {
    const gr = gradeOf(r.score);
    const mk = r.absent ? 'ABS' : r.score == null ? '—' : fmt1(r.score);
    const bar = r.score != null ? `<div class="rc-bar"><i style="width:${Math.min(100, r.score)}%"></i></div>` : '';
    return `<tr><td class="sub">${esc(r.subject)}${bar}</td><td class="mk">${mk}</td><td class="c"><b>${gr ? gr.g : '—'}</b></td><td>${r.absent ? 'Absent' : r.score == null ? 'Not recorded' : gr.label}</td></tr>`;
  }).join('');
  const missing = res.of - res.entered;
  return `<section class="rc-page">
  <div class="rc-head"><div class="rc-crest">${CREST_SVG}</div><div class="rc-school"><h1>${esc(SCHOOL.name.toUpperCase())}</h1><p>Excellence in Learning</p></div><div class="rc-year"><small>YEAR</small>${ctx.year}</div></div>
  <div class="rc-title">STUDENT REPORT CARD &nbsp;·&nbsp; ${esc(ctx.exam.name.toUpperCase())} &nbsp;·&nbsp; ${esc(ctx.term.name.toUpperCase())}</div>
  <div class="rc-info"><div class="wide"><small>Student name</small><b>${esc(st.first + ' ' + st.last)}</b></div><div class="wide"><small>Admission No.</small><b>${esc(st.id)}</b></div><div><small>Class</small><b>${esc(st.className)}</b></div><div><small>Class size</small><b>${ctx.classSize}</b></div></div>
  <table class="rc-table"><thead><tr><th>Subject</th><th class="c">Marks / ${MAX_MARK}</th><th class="c">Grade</th><th>Remark</th></tr></thead><tbody>${rows}</tbody>
  <tfoot><tr><td>TOTAL</td><td class="mk">${res.sat ? fmt1(res.total) : '—'}</td><td colspan="2">out of ${res.sat * MAX_MARK || '—'} (${res.sat} subject${res.sat === 1 ? '' : 's'} sat)</td></tr></tfoot></table>
  <div class="rc-sum"><div><small>Total marks</small><b>${res.sat ? fmt1(res.total) : '—'}</b></div><div><small>Average</small><b>${res.avg == null ? '—' : fmt1(res.avg) + '%'}</b></div><div><small>Overall grade</small><b>${g ? g.g : '—'}</b></div><div class="pos"><small>Position in class</small><b>${res.pos ? ordinal(res.pos) + ' / ' + ctx.classSize : '—'}</b></div></div>
  ${missing > 0 ? `<div class="rc-note">Note: ${missing} subject${missing === 1 ? ' has' : 's have'} no mark recorded yet, so the total, average and position may change.</div>` : ''}
  <div class="rc-comments">
    <div class="rc-cbox"><small>Class teacher's remark</small>${remarkBody(cm.teacher)}</div>
    <div class="rc-cbox"><small>Head teacher's remark</small>${remarkBody(cm.head)}<div class="rc-sign"><span>Head teacher's signature &amp; stamp: ....................................................................</span></div></div>
  </div>
  ${ctx.term.name === 'Term 3' ? (() => { const p=(ctx.promotions||[]).find(x=>x.studentId===st.id && x.year===ctx.year); return `<div class="rc-decision"><strong>END-OF-YEAR CLASS DECISION</strong><div class="rc-decision-options"><span class="rc-decision-choice"><span class="rc-decision-box">${p?.decision==='promoted'?'✓':''}</span> Promoted</span><span class="rc-decision-choice"><span class="rc-decision-box">${p?.decision==='repeat'?'✓':''}</span> Repeat Class</span></div></div>`; })() : ''}
  <div class="rc-key"><b>Grading:</b>${gradeKey()}</div>
  <div class="rc-foot">${esc(SCHOOL.name)} · ${esc(ctx.term.name)} ${ctx.year} · Printed ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
  </section>`;
}

/** Whole-class results sheet (landscape). results = classResults() output */
function classSheetHTML(results, ctx) {
  const subs = ctx.subjects, n = results.length;
  const col = s => results.map(r => r.rows.find(x => x.subject === s).score).filter(v => v != null);
  const avgOf = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const withAvg = results.filter(r => r.avg != null);
  const body = results.map((r, i) => `<tr><td>${i + 1}</td><td class="l"><b>${esc(r.st.last)}</b> ${esc(r.st.first)}</td><td class="l">${esc(r.st.id)}</td>${r.rows.map(x => `<td>${x.absent ? '<span class="miss">ABS</span>' : x.score == null ? '<span class="miss">—</span>' : fmt1(x.score)}</td>`).join('')}<td class="tot">${r.sat ? fmt1(r.total) : '—'}</td><td>${r.avg == null ? '—' : fmt1(r.avg)}</td><td><b>${gradeOf(r.avg)?.g || '—'}</b></td><td class="pos">${r.pos ? ordinal(r.pos) : '—'}</td></tr>`).join('');
  const foot = (label, fn) => `<tr><td colspan="3" class="l">${label}</td>${subs.map(s => `<td>${fmt1(fn(col(s)))}</td>`).join('')}<td colspan="4"></td></tr>`;
  const classAvg = avgOf(withAvg.map(r => r.avg));
  return `<section class="cs-page">
  ${schoolHead('cs-head')}
  <div class="rc-title" style="margin:8px 0 6px">CLASS RESULTS SHEET &nbsp;·&nbsp; ${esc(ctx.cls.toUpperCase())} &nbsp;·&nbsp; ${esc(ctx.exam.name.toUpperCase())} &nbsp;·&nbsp; ${esc(ctx.term.name.toUpperCase())} ${ctx.year}</div>
  <div class="cs-meta"><span>Class: <b>${esc(ctx.cls)}</b></span><span>Students: <b>${n}</b></span><span>Class average: <b>${fmt1(classAvg)}${classAvg == null ? '' : '%'}</b></span><span>Printed: <b>${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</b></span></div>
  <table class="cs-table"><thead><tr><th>#</th><th class="l">Student</th><th class="l">Admission No.</th>${subs.map(s => `<th>${esc(s.replace('Physical Exercise (PE)', 'PE'))}</th>`).join('')}<th>Total</th><th>Avg</th><th>Grade</th><th>Pos</th></tr></thead>
  <tbody>${body}</tbody><tfoot>${foot('Subject average', avgOf)}${foot('Highest mark', a => a.length ? Math.max(...a) : null)}${foot('Lowest mark', a => a.length ? Math.min(...a) : null)}</tfoot></table>
  <div class="rc-key" style="margin-top:10px"><b>Grading:</b>${gradeKey()}<span>ABS = absent · — = not recorded</span></div>
  <div class="cs-sign"><span>Class teacher</span><span>Director of Studies</span><span>Head teacher</span></div>
  </section>`;
}

function buildPrintHTML(body, orientation, title) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4 ${orientation};margin:${orientation === 'portrait' ? '10mm' : '9mm'}}body{margin:0;background:#fff}${REPORT_CSS}</style></head><body>${body}</body></html>`;
}
// Prints through a hidden frame so no pop-up window is needed (works in the desktop app too).
function printHTML(body, orientation, title) {
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(f);
  const d = f.contentDocument; d.open(); d.write(buildPrintHTML(body, orientation, title)); d.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } finally { setTimeout(() => f.remove(), 3000); } }, 250);
}
