'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), { execFile } = require('child_process');
const { Store } = require('./store'), { HM, DEFAULTS, Fail } = require('./hm'), { startServer } = require('./server'), { Cloud } = require('./cloud'), { Teacher, DEFAULTS: TDEF } = require('./teacher');

/** Everything the screens can ask for. Used by Electron (main.js) and by the browser test harness (dev-server.js). */
function createApp({ dataDir, backupDir, notify = () => { }, enc = { enc: s => s, dec: s => s }, port = 4750 }) {
  fs.mkdirSync(dataDir, { recursive: true });
  const cfgFile = path.join(dataDir, 'config.json');
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch (e) { /* first run */ }
  const saveCfg = () => fs.writeFileSync(cfgFile, JSON.stringify(cfg));
  const A = { mode: cfg.mode || null, hm: null, cloud: null, server: null, teacher: null, authed: false, timers: [] };

  let lastBackupContent = null;
  function backupNow(auto) {
    if (!A.hm) throw new Fail('Not the Headteacher PC.');
    A.hm.s.save(true); fs.mkdirSync(backupDir, { recursive: true });
    const d = new Date(), p = n => String(n).padStart(2, '0');
    const f = path.join(backupDir, `bgs-backup-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${String(d.getMilliseconds()).padStart(3,'0')}${auto ? '-auto' : ''}.json`);
    fs.copyFileSync(path.join(dataDir, 'hm-data.json'), f);
    lastBackupContent = fs.readFileSync(path.join(dataDir, 'hm-data.json'), 'utf8');
    const all = fs.readdirSync(backupDir).filter(x => x.startsWith('bgs-backup-')).sort(); while (all.length > 40) fs.unlinkSync(path.join(backupDir, all.shift()));
    return f;
  }
  function init() {
    if (A.mode === 'hm' && !A.hm) {
      A.hm = new HM(new Store(path.join(dataDir, 'hm-data.json'), DEFAULTS), { onChange: () => { A.cloud && A.cloud.kick(); notify('changed'); } });
      A.cloud = new Cloud(A.hm, () => cfg.cloud ? { url: cfg.cloud.url, key: enc.dec(cfg.cloud.key) } : null, () => notify('sync'));
      A.server = startServer(A.hm, port);
      try { backupNow(true); } catch (e) { /* backups are best-effort */ }
      A.timers.push(setInterval(() => { try { A.hm.s.flush(); const current=fs.readFileSync(path.join(dataDir,'hm-data.json'),'utf8'); if(current!==lastBackupContent) backupNow(true); } catch(e) { console.error('Automatic local backup failed:', e.message); } },30000));
      setTimeout(() => A.cloud && A.cloud.flush(), 3000);
    }
    if (A.mode === 'teacher' && !A.teacher) A.teacher = new Teacher(new Store(path.join(dataDir, 'teacher-data.json'), TDEF), () => notify('changed'), { discoveryPort: port + 1 });
  }
  init();
  const lanIps = () => Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  const needHM = () => { if (!A.hm) throw new Fail('Not the Headteacher PC.'); if (!A.authed) throw new Fail('Please log in first.'); return A.hm; };
  const needT = () => { if (!A.authed) throw new Fail('Please log in first.'); if (!A.teacher) throw new Fail('Not the Teachers PC.'); return A.teacher; };

  const smsCreds = () => { const c = cfg.sms; if (!c || !c.username || !c.key) throw new Fail('Set up the SMS account first (Settings & Backup).'); return { username: c.username, key: enc.dec(c.key), senderId: c.senderId || '' }; };
  const smsSender = (...a) => require('./sms').sendBatch(...a);

  const H = {
    'mode.get': () => ({ mode: A.mode }),
    'mode.set': m => { if (A.mode && A.mode !== m) throw new Fail('This computer is already set up. Use Settings → Reset to change it.'); if (!['hm', 'teacher'].includes(m)) throw new Fail('Bad mode'); A.mode = cfg.mode = m; saveCfg(); init(); return { mode: m }; },
    'auth.status': () => ({ hasPassword: A.hm ? A.hm.hasPassword() : !!cfg.teacherPassword, authed: A.authed }),
    'auth.setup': ({ pw }) => { if (!A.hm && A.teacher) { if(cfg.teacherPassword) throw new Fail('Password already set.'); if(String(pw||'').length<8) throw new Fail('Use at least 8 characters.'); const salt=crypto.randomBytes(16).toString('hex');cfg.teacherPassword={salt,hash:crypto.scryptSync(pw,salt,32).toString('hex')};saveCfg();A.authed=true;return true; } if (!A.hm) throw new Fail('Not the Headteacher PC.'); if (A.hm.hasPassword()) throw new Fail('Password already set.'); A.hm.setPassword(pw); A.authed = true; return true; },
    'auth.login': ({ pw }) => { if (!A.hm && A.teacher) { const p=cfg.teacherPassword;if(!p)throw new Fail('Set a password first.');const a=crypto.scryptSync(String(pw||''),p.salt,32),b=Buffer.from(p.hash,'hex');if(a.length!==b.length||!crypto.timingSafeEqual(a,b))throw new Fail('Wrong password.');A.authed=true;return true; } if (!A.hm) throw new Fail('Not the Headteacher PC.'); if (!A.hm.checkPassword(pw)) throw new Fail('Wrong password.'); A.authed = true; return true; },
    'auth.logout': () => { A.authed = false; return true; },
    'auth.change': ({ old, pw }) => { if(A.teacher) {needT(); const p=cfg.teacherPassword;if(!p||!crypto.timingSafeEqual(crypto.scryptSync(String(old||''),p.salt,32),Buffer.from(p.hash,'hex')))throw new Fail('Old password is wrong.');if(String(pw||'').length<8)throw new Fail('Use at least 8 characters.'); const salt=crypto.randomBytes(16).toString('hex');cfg.teacherPassword={salt,hash:crypto.scryptSync(pw,salt,32).toString('hex')};saveCfg();return true;} needHM().setPassword(pw, old); return true; },
    'settings.get': () => { const hm = needHM(); return { lan: { ips: lanIps(), port, key: hm.d.meta.lanKey, error: A.server && (A.server.lastError || A.server.discoveryError()), peers: A.server ? A.server.peers() : [], windows: process.platform === 'win32' }, cloud: { url: cfg.cloud ? cfg.cloud.url : '', hasKey: !!(cfg.cloud && cfg.cloud.key), status: A.cloud.status() }, backupDir, dataDir }; },
    'settings.cloud': ({ url, key }) => { needHM(); cfg.cloud = { url: String(url || '').trim(), key: key ? enc.enc(String(key).trim()) : (cfg.cloud ? cfg.cloud.key : '') }; if (!cfg.cloud.url) cfg.cloud = null; saveCfg(); A.cloud.st.error = ''; A.cloud.kick(); return true; },
    'cloud.test': async () => { needHM(); await A.cloud.test(); return true; },
     'cloud.pushAll': async () => { needHM(); if (!Object.keys(A.hm.d.students).length) throw new Fail('Cannot push an empty school database. Use Restore from Supabase first.'); await A.cloud.flush(true); return A.cloud.status(); },
    'cloud.previewRestore': async () => { needHM(); const rows=await A.cloud.download(); const r=A.cloud.buildRecovery(rows); return {records:r.valid,counts:r.counts,year:r.data.meta.current.year,term:r.data.meta.current.term}; },
    'cloud.restore': async ({confirm}) => {
      const hm=needHM(); if(confirm!=='RESTORE SCHOOL') throw new Fail('Type RESTORE SCHOOL to confirm.');
      if(A.cloud.busy) throw new Fail('Cloud synchronization is running. Please try again.');
      // Stop automatic cloud writes during the entire operation.
      A.cloud.stop(); A.cloud.busy=true;
      try {
        const rows=await A.cloud.download(), r=A.cloud.buildRecovery(rows);
        const existing=hm.d;
        // Cloud deliberately never contains the HM password, preserve the local replacement-PC login.
        r.data.meta.pw=existing.meta.pw;
        r.data.meta.lanKey=existing.meta.lanKey;
        r.data.meta.hmId=existing.meta.hmId;
        r.data.meta.createdAt=existing.meta.createdAt;
        r.data.meta.seq=Math.max(0,...Object.values(r.data.marks).map(m=>Number(m.seq)||0),...Object.values(r.data.comments).map(m=>Number(m.seq)||0));
        r.data.dirty={};
        backupNow(false); // unconditionally save current data to an independent dated backup
        hm.s.data=r.data; hm.d=r.data; hm.s.save(true);
        A.cloud.st.error=''; A.cloud.st.last=new Date().toISOString();
        return {records:r.valid,counts:r.counts};
      } finally {A.cloud.busy=false; A.cloud.loop=setInterval(()=>A.cloud.flush(),15000); A.cloud.refresh(); notify('changed');}
    },
    'net.firewall': () => new Promise((resolve, reject) => {
      if (process.platform !== 'win32') return reject(new Fail('This step is only needed on Windows.'));
      needHM();
      const rule = 'BGS School System';
      const inner = `netsh advfirewall firewall delete rule name="${rule}" & netsh advfirewall firewall add rule name="${rule}" dir=in action=allow protocol=TCP localport=${port} profile=any & netsh advfirewall firewall add rule name="${rule} Discovery" dir=in action=allow protocol=UDP localport=${port + 1} profile=any`;
      const ps = `Start-Process -FilePath cmd.exe -ArgumentList '/c ${inner.replace(/'/g, "''")}' -Verb RunAs -WindowStyle Hidden -Wait`;
      execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { timeout: 120000, windowsHide: true }, err => err ? reject(new Fail('Windows did not allow the change. Click Yes when Windows asks for permission, then try again.')) : resolve(true));
    }),
    'backup.now': () => ({ file: backupNow(false) }),
    'settings.newKey': () => { const hm = needHM(); hm.d.meta.lanKey = require('crypto').randomBytes(4).toString('hex').toUpperCase().replace(/(.{4})/, '$1-'); hm.done(); return hm.d.meta.lanKey; },
    'app.reset': () => { if (A.hm) needHM(); cfg.mode = null; saveCfg(); return { restart: true }; },
    // headteacher data
    'hm.state': a => needHM().getState(a),
    'hm.marks': ({ year }) => needHM().getMarks(year),
    'hm.setSubjects': a => needHM().setSubjects(a.cls,a.subjects),
    'hm.setGrades': a => needHM().setGrades(a.grades),
    'hm.saveNotification': a => needHM().saveNotification(a),
    'hm.previewNotification': a => needHM().previewNotification(a.id),
    'hm.sendNotification': async a => { const hm = needHM(); if (a.confirm !== true) throw new Fail('Please confirm before sending.'); return hm.sendNotification(a.id, smsCreds(), smsSender); },
    'sms.get': () => { needHM(); const c = cfg.sms || {}; return { username: c.username || '', senderId: c.senderId || '', hasKey: !!c.key }; },
    'settings.sms': ({ username, key, senderId }) => {
      needHM(); const old = cfg.sms || {}, u = String(username || '').trim();
      if (!u) { cfg.sms = null; saveCfg(); return true; }
      if (!/^[A-Za-z0-9_.-]{2,40}$/.test(u)) throw new Fail('The username can only contain letters, numbers and . _ -');
      const sid = String(senderId || '').trim();
      if (sid && !/^[A-Za-z0-9 ]{3,11}$/.test(sid)) throw new Fail('Sender name must be 3 to 11 letters or numbers.');
      const k = String(key || '').trim();
      if (!k && !old.key) throw new Fail('Paste the API key.');
      cfg.sms = { username: u, senderId: sid, key: k ? enc.enc(k) : old.key }; saveCfg(); return true;
    },
    'sms.test': async ({ phone }) => {
      needHM(); const to = require('./sms').normalizePhone(phone); if (!to) throw new Fail('Enter a valid Uganda phone number, e.g. 0772 123 456.');
      const res = await smsSender(smsCreds(), [to], 'Bill Gates Junior School: SMS test. Your school system can now send messages to parents.');
      if (!res[0] || !res[0].ok) throw new Fail('The SMS company did not accept the test message' + (res[0] && res[0].status ? ': ' + res[0].status : '.'));
      return { to, cost: res[0].cost };
    },
    'hm.addApplication': f => needHM().addApplication(f),
    'hm.payAdmission': a => needHM().payAdmission(a.id, a.amount, a.method, a.note),
    'hm.updateStudent': a => needHM().updateStudent(a.id, a.f),
    'hm.setType': a => needHM().setType(a.id, a.type),
    'hm.setStudentStatus': a => needHM().setStudentStatus(a.id, a.status, a.reason),
    'hm.addDiscipline': a => needHM().addDiscipline(a),
    'hm.cancelDiscipline': a => needHM().cancelDiscipline(a),
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
    't.setPromotion': a => needT().setPromotion(a),
    't.find': async () => { const t = needT(); t.lastFind = 0; const found = await t.findHM(); await t.sync(); return { found, note: t.findNote || '' }; },
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
