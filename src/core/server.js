'use strict';
const http = require('http'), crypto = require('crypto');
const { startResponder } = require('./discovery');

const normKey = k => String(k || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

function startServer(hm, port = 4750) {
  const keyOk = k => { const a = Buffer.from(normKey(k)), b = Buffer.from(normKey(hm.d.meta.lanKey)); return a.length === b.length && crypto.timingSafeEqual(a, b); };
  const send = (res, code, obj) => { const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) }); res.end(b); };
  const peers = new Map();
  const seen = (req) => {
    const name = String(req.headers['x-device-name'] || '').slice(0, 60) || 'Teachers PC';
    const ip = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    peers.set(ip, { name, ip, at: new Date().toISOString() });
  };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/api/ping') return send(res, 200, { ok: true, school: 'Bill Gates Junior School Nsangi', hm: true, id: hm.d.meta.hmId });
    if (!u.pathname.startsWith('/api/teacher/')) return send(res, 404, { error: 'Not found' });
    if (!keyOk(req.headers['x-school-key'])) return send(res, 401, { error: 'Wrong school key' });
    seen(req);
    try {
      if (req.method === 'GET' && u.pathname === '/api/teacher/hello') return send(res, 200, { ok: true, id: hm.d.meta.hmId });
      if (req.method === 'GET' && u.pathname === '/api/teacher/sync') return send(res, 200, { ...hm.teacherSnapshot(u.searchParams.get('since')), hmId: hm.d.meta.hmId });
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
  server.peers = () => [...peers.values()].sort((a, b) => b.at.localeCompare(a.at));
  const responder = startResponder(() => ({ school: 'Bill Gates Junior School Nsangi', port, id: hm.d.meta.hmId }), port + 1);
  const closeHttp = server.close.bind(server);
  server.close = cb => { try { responder.close(); } catch (e) { void e; } return closeHttp(cb); };
  server.discoveryError = () => responder.lastError || '';
  return server;
}
module.exports = { startServer, normKey };
