'use strict';
const dgram = require('dgram'), os = require('os');

const DISCOVERY_PORT = 4751;
const PROBE = 'BGS-DISCOVER-V1';

function broadcastTargets() {
  const out = new Set(['255.255.255.255', '127.0.0.1']);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      if (!i || i.family !== 'IPv4' || i.internal || !i.netmask) continue;
      const a = i.address.split('.').map(Number), m = i.netmask.split('.').map(Number);
      if (a.length !== 4 || m.length !== 4) continue;
      out.add(a.map((x, k) => (x | (~m[k] & 255))).join('.'));
    }
  }
  return [...out];
}

function startResponder(info, port = DISCOVERY_PORT) {
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  sock.on('error', e => { sock.lastError = e.message; });
  sock.on('message', (msg, rinfo) => {
    if (msg.toString().trim() !== PROBE) return;
    const reply = Buffer.from(JSON.stringify({ bgs: 1, ...info() }));
    sock.send(reply, rinfo.port, rinfo.address);
  });
  try { sock.bind(port, '0.0.0.0'); } catch (e) { sock.lastError = e.message; }
  return sock;
}

function discover({ port = DISCOVERY_PORT, wait = 1600 } = {}) {
  return new Promise(resolve => {
    const found = new Map();
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      try { sock.close(); } catch (e) { void e; }
      resolve([...found.values()]);
    };
    sock.on('error', finish);
    sock.on('message', (msg, rinfo) => {
      try {
        const j = JSON.parse(msg.toString());
        if (j && j.bgs === 1 && j.port) found.set(rinfo.address + ':' + j.port, { ip: rinfo.address, port: Number(j.port), id: j.id || '', school: j.school || '' });
      } catch (e) { void e; }
    });
    sock.bind(0, () => {
      try { sock.setBroadcast(true); } catch (e) { return finish(); }
      const probe = Buffer.from(PROBE);
      const fire = () => { for (const t of broadcastTargets()) sock.send(probe, port, t, () => { }); };
      fire();
      setTimeout(fire, 500);
      setTimeout(fire, 1000);
      setTimeout(finish, wait);
    });
  });
}

module.exports = { startResponder, discover, broadcastTargets, DISCOVERY_PORT };
