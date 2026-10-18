'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { Store } = require('./store'), { HM, DEFAULTS, Fail } = require('./hm'), { startServer } = require('./server'), { Cloud } = require('./cloud'), { Teacher, DEFAULTS: TDEF } = require('./teacher');

/** Everything the screens can ask for. Used by Electron (main.js) and by the browser test harness (dev-server.js). */
function createApp({ dataDir, backupDir, notify = () => { }, enc = { enc: s => s, dec: s => s }, port = 4750 }) {
  fs.mkdirSync(dataDir, { recursive: true });
  const cfgFile = path.join(dataDir, 'config.json');
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch (e) { /* first run */ }
  const saveCfg = () => fs.writeFileSync(cfgFile, JSON.stringify(cfg));
  const A = { mode: cfg.mode || null, hm: null, cloud: null, server: null, teacher: null, authed: false, timers: [] };

  function backupNow(auto) {
    if (!A.hm) throw new Fail('Not the Headteacher PC.');
    A.hm.s.save(true); fs.mkdirSync(backupDir, { recursive: true });
    const d = new Date(), p = n => String(n).padStart(2, '0');
    const f = path.join(backupDir, `bgs-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${auto ? '-auto' : ''}.json`);
    fs.copyFileSync(path.join(dataDir, 'hm-data.json'), f);
    const all = fs.readdirSync(backupDir).filter(x => x.startsWith('bgs-backup-')).sort(); while (all.length > 40) fs.unlinkSync(path.join(backupDir, all.shift()));
    return f;
  }
  function init() {
    if (A.mode === 'hm' && !A.hm) {
      A.hm = new HM(new Store(path.join(dataDir, 'hm-data.json'), DEFAULTS), { onChange: () => { A.cloud && A.cloud.kick(); notify('changed'); } });
      A.cloud = new Cloud(A.hm, () => cfg.cloud ? { url: cfg.cloud.url, key: enc.dec(cfg.cloud.key) } : null, () => notify('sync'));
      A.server = startServer(A.hm, port);
      try { backupNow(true); } catch (e) { /* backups are best-effort */ }
      A.timers.push(setInterval(() => { try { backupNow(true); } catch (e) { /* ignore */ } }, 6 * 3600e3));
      setTimeout(() => A.cloud && A.cloud.flush(), 3000);
    }
    if (A.mode === 'teacher' && !A.teacher) A.teacher = new Teacher(new Store(path.join(dataDir, 'teacher-data.json'), TDEF), () => notify('changed'));
  }
  init();
  const lanIps = () => Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  const needHM = () => { if (!A.hm) throw new Fail('Not the Headteacher PC.'); if (!A.authed) throw new Fail('Please log in first.'); return A.hm; };
  const needT = () => { if (!A.teacher) throw new Fail('Not the Teachers PC.'); return A.teacher; };

  const H = {
    'mode.get': () => ({ mode: A.mode }),
    'mode.set': m => { if (A.mode && A.mode !== m) throw new Fail('This computer is already set up. Use Settings → Reset to change it.'); if (!['hm', 'teacher'].includes(m)) throw new Fail('Bad mode'); A.mode = cfg.mode = m; saveCfg(); init(); return { mode: m }; },
    'auth.status': () => ({ hasPassword: A.hm ? A.hm.hasPassword() : true, authed: A.authed }),
    'auth.setup': ({ pw }) => { if (!A.hm) throw new Fail('Not the Headteacher PC.'); if (A.hm.hasPassword()) throw new Fail('Password already set.'); A.hm.setPassword(pw); A.authed = true; return true; },
    'auth.login': ({ pw }) => { if (!A.hm) throw new Fail('Not the Headteacher PC.'); if (!A.hm.checkPassword(pw)) throw new Fail('Wrong password.'); A.authed = true; return true; },
    'auth.logout': () => { A.authed = false; return true; },
    'auth.change': ({ old, pw }) => { needHM().setPassword(pw, old); return true; },
    'settings.get': () => { const hm = needHM(); return { lan: { ips: lanIps(), port, key: hm.d.meta.lanKey, error: A.server && A.server.lastError }, cloud: { url: cfg.cloud ? cfg.cloud.url : '', hasKey: !!(cfg.cloud && cfg.cloud.key), status: A.cloud.status() }, backupDir, dataDir }; },
    'settings.cloud': ({ url, key }) => { needHM(); cfg.cloud = { url: String(url || '').trim(), key: key ? enc.enc(String(key).trim()) : (cfg.cloud ? cfg.cloud.key : '') }; if (!cfg.cloud.url) cfg.cloud = null; saveCfg(); A.cloud.st.error = ''; A.cloud.kick(); return true; },
    'cloud.test': async () => { needHM(); await A.cloud.test(); return true; },
    'cloud.pushAll': async () => { needHM(); await A.cloud.flush(true); return A.cloud.status(); },
    'backup.now': () => ({ file: backupNow(false) }),
    'settings.newKey': () => { const hm = needHM(); hm.d.meta.lanKey = require('crypto').randomBytes(4).toString('hex').toUpperCase().replace(/(.{4})/, '$1-'); hm.done(); return hm.d.meta.lanKey; },
    'app.reset': () => { if (A.hm) needHM(); cfg.mode = null; saveCfg(); return { restart: true }; },
    // headteacher data
    'hm.state': a => needHM().getState(a),
    'hm.marks': ({ year }) => needHM().getMarks(year),
    'hm.addApplication': f => needHM().addApplication(f),
    'hm.payAdmission': a => needHM().payAdmission(a.id, a.amount, a.method, a.note),
    'hm.updateStudent': a => needHM().updateStudent(a.id, a.f),
    'hm.setType': a => needHM().setType(a.id, a.type),
    'hm.setStudentStatus': a => needHM().setStudentStatus(a.id, a.status, a.reason),
    'hm.payFees': a => needHM().payFees(a.id, a.year, a.term, a.amount, a.method, a.note),
    'hm.addStaff': f => needHM().addStaff(f),
    'hm.updateStaff': a => needHM().updateStaff(a.id, a.f),
    'hm.setStaffStatus': a => needHM().setStaffStatus(a.id, a.status),
    'hm.paySalary': a => needHM().paySalary(a.id, a.period, a.amount, a.method, a.note),
    'hm.voidPayment': a => needHM().voidPayment(a.id, a.reason),
    'hm.setCurrentTerm': a => needHM().setCurrentTerm(a.year, a.term),
    'hm.saveRemark': a => { needHM().saveHeadRemark(a.id, a.teacher, a.head); return true; },
    // teachers' PC
    't.state': () => needT().state(),
    't.setConfig': c => { needT().setConfig(c); return true; },
    't.setMark': m => needT().setMark(m),
    't.setComment': a => { needT().setComment(a.id, a.teacher, a.head); return true; },
    't.syncNow': async () => { await needT().sync(); return true; },
  };
  return {
    A, backupNow, cfg,
    async call(action, args) {
      try { const f = H[action]; if (!f) throw new Fail('Unknown action ' + action); return { ok: true, data: await f(args || {}) }; }
      catch (e) { if (!(e instanceof Fail) && !/^(Marks must|Enter the|Wrong|Please|Not the)/.test(e.message)) console.error(e); return { ok: false, error: e.message || String(e) }; }
    },
    shutdown() { A.hm && A.hm.s.flush(); A.teacher && A.teacher.s.flush(); A.timers.forEach(clearInterval); A.cloud && A.cloud.stop(); A.teacher && A.teacher.stop(); A.server && A.server.close(); },
  };
}
module.exports = { createApp };
