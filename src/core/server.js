'use strict';
const http = require('http'), crypto = require('crypto');
/** LAN server on the Headteacher PC. Teachers' PCs can ONLY: read student list (no fees/phones) and send marks/remarks. */
function startServer(hm, port = 4750) {
  const keyOk = k => { const a = Buffer.from(String(k || '')), b = Buffer.from(hm.d.meta.lanKey); return a.length === b.length && crypto.timingSafeEqual(a, b); };
  const send = (res, code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) }); res.end(b); };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/api/ping') return send(res, 200, { ok: true, school: 'Bill Gates Junior School Nsangi', hm: true });
    if (!u.pathname.startsWith('/api/teacher/')) return send(res, 404, { error: 'Not found' });
    if (!keyOk(req.headers['x-school-key'])) return send(res, 401, { error: 'Wrong school key' });
    try {
      if (req.method === 'GET' && u.pathname === '/api/teacher/sync') return send(res, 200, hm.teacherSnapshot(u.searchParams.get('since')));
      if (req.method === 'POST' && u.pathname === '/api/teacher/push') {
        let body = '', size = 0;
        req.on('data', c => { size += c.length; if (size > 8e6) req.destroy(); else body += c; });
        req.on('end', () => { try { const j = JSON.parse(body); let n = hm.acceptMarks(j.marks || [], j.comments || [], String(j.device || '')); for (const p of j.promotions || []) { hm.recordPromotion(p); n++; } send(res, 200, { ok: true, accepted: n }); } catch (e) { send(res, 400, { error: 'Bad data' }); } });
        return;
      }
      send(res, 404, { error: 'Not found' });
    } catch (e) { send(res, 500, { error: 'Server error' }); }
  });
  server.on('error', e => { server.lastError = e.message; });
  server.listen(port, '0.0.0.0');
  return server;
}
module.exports = { startServer };
