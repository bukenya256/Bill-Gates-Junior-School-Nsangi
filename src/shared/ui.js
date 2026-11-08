'use strict';

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const api = (a, args) => window.bgs.call(a, args);
function toast(t, bad) { let el = $('#toast'); if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); } el.textContent = t; el.className = 'show' + (bad ? ' bad' : ''); clearTimeout(toast._t); toast._t = setTimeout(() => el.className = '', bad ? 5000 : 3200); }
async function run(fn) { try { return await fn(); } catch (e) { toast(e.message || String(e), true); return undefined; } }
function modal(title, html, o = {}) {
  closeModal(); const ov = document.createElement('div'); ov.className = 'ov'; ov.id = 'modal';
  ov.innerHTML = `<div class="mc ${o.wide ? 'wide' : ''}"><div class="mh"><h3>${title}</h3><button data-x aria-label="Close">×</button></div><div class="mb">${html}</div></div>`;
  ov.addEventListener('mousedown', e => { if (e.target === ov && !o.sticky) closeModal(); }); $('[data-x]', ov).onclick = closeModal;
  document.body.appendChild(ov); const f = $('input:not([type=hidden]),select,textarea', ov); f && setTimeout(() => f.focus(), 30); return ov;
}
function closeModal() { const m = $('#modal'); if (m) m.remove(); }
const initials = (a, b) => ((a || '?')[0] + (b || '')[0]).toUpperCase();
const chip = (t, c) => `<span class="chip c-${c}">${esc(t)}</span>`;
const fmtDT = iso => { const d = new Date(iso); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
const monthName = p => new Date(p + '-15T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const typeLabel = t => (t === 'boarding' ? 'Boarding' : 'Day');

document.addEventListener('input', e => {
  const el = e.target; if (!el.classList || !el.classList.contains('money') || el.tagName !== 'INPUT') return;
  const v = el.value.replace(/[^\d]/g, ''); el.value = v ? num(v) : '';
});

function words(n) {
  const a = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'], b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const h = x => { let s = ''; if (x >= 100) { s += a[Math.floor(x / 100)] + ' hundred'; x %= 100; if (x) s += ' and '; } if (x >= 20) { s += b[Math.floor(x / 10)] + (x % 10 ? '-' + a[x % 10] : ''); } else if (x) s += a[x]; return s; };
  if (!n) return 'zero'; const parts = []; for (const [v, l] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]) { if (n >= v) { parts.push(h(Math.floor(n / v)) + ' ' + l); n %= v; } } if (n) parts.push(h(n));
  const s = parts.join(', '); return s.charAt(0).toUpperCase() + s.slice(1);
}

const RECEIPT_CSS = `*{box-sizing:border-box}body{margin:0;font:12px/1.43 "Segoe UI",Arial,sans-serif;color:#14202f}
.rcpt{width:105mm;margin:0 auto 8mm;border:1.4px solid #12304e;border-top:4px solid #e77722;border-radius:7px;padding:5mm 6mm;position:relative;page-break-inside:avoid}
.rh{display:flex;align-items:center;gap:12px;border-bottom:3px solid #e77722;padding-bottom:8px}.rh .cr{width:38px;height:38px;border-radius:10px;background:#e77722;color:#fff;display:grid;place-items:center;font-size:12px;font-weight:800;letter-spacing:.04em;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.rh h1{margin:0;font-size:14px;color:#0f2747;letter-spacing:.03em}.rh p{margin:2px 0 0;color:#44556b;font-size:11px}
.bar{display:flex;justify-content:space-between;align-items:center;margin:9px 0;background:#0f2747;color:#fff;padding:6px 10px;border-radius:4px;font-weight:700;letter-spacing:.06em;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.rw{display:flex;gap:10px;padding:4px 0;border-bottom:1px dotted #aab8c8}.rw span{width:27mm;color:#5b6b80;font-size:10px;text-transform:uppercase;letter-spacing:.05em}.rw b{flex:1}
.sum{margin:10px 0;border:1px solid #b9c5d6;border-radius:5px}.sum div{display:flex;justify-content:space-between;padding:5px 10px;border-bottom:1px solid #e0e7f1}.sum div:last-child{border:0}
.sum .big{background:#fff0e1;font-weight:800;font-size:16px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sum .bal{font-weight:800;color:#b64d19}.sum .bal.zero{color:#12805c}
.words{font-style:italic;margin:6px 0}
.stamp{position:absolute;right:12mm;top:42mm;transform:rotate(-12deg);border:3px solid #12805c;color:#12805c;font-weight:900;font-size:22px;padding:2px 12px;border-radius:6px;opacity:.75;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.void{border-color:#b3262e;color:#b3262e}.foot{text-align:center;color:#8a96a8;font-size:10px;margin-top:8px}@page{size:A4 portrait;margin:10mm}`;
function receiptHTML(p) {
  const who = p.kind === 'salary' ? p.staffName : p.studentName;
  const purpose = p.kind === 'admission' ? 'Admission fee' : p.kind === 'fees' ? `School fees – Term ${p.term} ${p.year} (${typeLabel(p.type)})` : `Salary – ${monthName(p.period)} (${p.title})`;
  const lab = p.kind === 'salary' ? ['Paid to', 'Salary due', 'Total paid so far', 'Paid now', 'Balance still owed'] : ['Received from (student)', p.kind === 'admission' ? 'Admission fee' : 'Fees for the term', 'Previously paid', 'Paid now', 'Balance'];
  return `<div class="rcpt"><div class="rh"><div class="cr">BGS</div><div><h1>${esc(SCHOOL.name.toUpperCase())}</h1><p>Excellence in Learning</p></div></div>
  <div class="bar"><span>${p.kind === 'salary' ? 'SALARY PAYMENT RECEIPT' : 'OFFICIAL RECEIPT'}</span><span>No. ${esc(p.receiptNo)}</span></div>
  <div class="rw"><span>Date</span><b>${fmtDT(p.ts)}</b></div>
  <div class="rw"><span>${lab[0]}</span><b>${esc(who)}${p.kind === 'salary' ? '' : ' &nbsp;(' + esc(p.studentId) + ')'}</b></div>
  ${p.kind === 'salary' ? '' : `<div class="rw"><span>Class</span><b>${esc(p.className)}</b></div>`}
  <div class="rw"><span>Being payment for</span><b>${esc(purpose)}</b></div><div class="rw"><span>Method</span><b>${esc(p.method)}</b></div>
  <div class="sum"><div><span>${lab[1]}</span><b>${money(p.due)}</b></div><div><span>${lab[2]}</span><b>${money(p.paidBefore)}</b></div><div class="big"><span>${lab[3]}</span><b>${money(p.amount)}</b></div><div><span>Total paid to date</span><b>${money(p.paidTotal)}</b></div><div class="bal ${p.balance ? '' : 'zero'}"><span>${lab[4]}</span><b>${money(p.balance)}</b></div></div>
  <div class="words">Amount in words: ${esc(words(p.amount))} Uganda shillings only.</div>
  ${p.void ? '<div class="stamp void">CANCELLED</div>' : p.balance ? '' : '<div class="stamp">PAID IN FULL</div>'}
  <div class="foot">Thank you · ${esc(SCHOOL.name)} · Keep this receipt safely</div></div>`;
}
function printRaw(body, css, title) {
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'; document.body.appendChild(f);
  const d = f.contentDocument; d.open(); d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>${body}</body></html>`); d.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } finally { setTimeout(() => f.remove(), 4000); } }, 250);
}
const printReceipt = p => printRaw(receiptHTML(p), RECEIPT_CSS, 'Receipt ' + p.receiptNo);
function showReceipt(p, headline) {
  const m = modal(headline || 'Receipt recorded', `<div class="banner info">Receipt <b>${esc(p.receiptNo)}</b> has been saved and queued for the cloud backup.</div>
    <div class="sumbox"><div><span>${p.kind === 'salary' ? 'Salary due' : 'Total due'}</span><b>${money(p.due)}</b></div><div><span>Paid now</span><b class="paid">${money(p.amount)}</b></div><div><span>Total paid</span><b>${money(p.paidTotal)}</b></div><div class="tot"><span>Balance</span><b class="${p.balance ? 'owe' : 'paid'}">${p.balance ? money(p.balance) : 'CLEARED – PAID IN FULL'}</b></div></div>
    <div class="mf" style="padding:0"><button data-x2>Close</button><button class="pri" data-pr>Print receipt</button></div>`);
  $('[data-x2]', m).onclick = closeModal; $('[data-pr]', m).onclick = () => printReceipt(p);
}
