'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { Store } = require('./store'), { HM, DEFAULTS, Fail } = require('./hm'), { Cloud } = require('./cloud'), { Teacher } = require('./teacher');

// One computer, two logins. The Headteacher and the Teachers use the same program and the same school records;
// what each person may do is decided by who logged in (A.role), not by a second computer.
function createApp({ dataDir, backupDir, notify = () => { }, enc = { enc: s => s, dec: s => s } }) {
  fs.mkdirSync(dataDir, { recursive: true });
  const cfgFile = path.join(dataDir, 'config.json');
  let cfg = {}; try { cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8')); } catch (e) {  }
  const saveCfg = () => fs.writeFileSync(cfgFile, JSON.stringify(cfg), { mode: 0o600 });
  // Older versions asked "Headteacher's PC or Teachers' PC?". There is only one kind of computer now.
  if (cfg.mode !== 'single') { cfg.mode = 'single'; saveCfg(); }
  const A = { mode: 'single', hm: null, cloud: null, teacher: null, role: null, teacherName: '', timers: [] };

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
    if (A.hm) return;
    A.hm = new HM(new Store(path.join(dataDir, 'hm-data.json'), DEFAULTS), { onChange: () => { A.cloud && A.cloud.kick(); notify('changed'); } });
    A.cloud = new Cloud(A.hm, () => cfg.cloud ? { url: cfg.cloud.url, key: cfg.cloud.key, getToken: cloudToken } : null, () => notify('sync'));
    A.teacher = new Teacher(A.hm, () => A.teacherName || 'Teacher');
    try { backupNow(true); } catch (e) {  }
    A.timers.push(setInterval(() => { try { A.hm.s.flush(); const current=fs.readFileSync(path.join(dataDir,'hm-data.json'),'utf8'); if(current!==lastBackupContent) backupNow(true); } catch(e) { console.error('Automatic local backup failed:', e.message); } },30000));
    setTimeout(() => A.cloud && A.cloud.syncCycle(), 3000);
  }
  init();
  const needHM = () => { if (A.role !== 'hm') throw new Fail(A.role ? 'Not allowed: this needs the Headteacher login.' : 'Please log in first.'); return A.hm; };
  const needT = () => { if (A.role !== 'teacher') throw new Fail(A.role ? 'Not allowed: this needs the Teachers login.' : 'Please log in first.'); return A.teacher; };

  // ---- passwords ----
  const hashPw = (pw, salt) => crypto.scryptSync(String(pw || ''), salt, 32);
  const teacherPwOk = pw => { const p = cfg.teacherPassword; if (!p) return false; const a = hashPw(pw, p.salt), b = Buffer.from(p.hash, 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); };
  const setTeacherPw = pw => { if (String(pw || '').length < 8) throw new Fail('Use at least 8 characters.'); const salt = crypto.randomBytes(16).toString('hex'); cfg.teacherPassword = { salt, hash: hashPw(pw, salt).toString('hex') }; saveCfg(); };
  const cleanName = n => { n = String(n || '').trim().slice(0, 60); if (!n) throw new Fail('Enter your name – it is saved with the marks you enter.'); return n; };
  let failures = 0, lockUntil = 0;
  const guard = ok => { if (Date.now() < lockUntil) throw new Fail('Too many wrong passwords. Wait a minute and try again.'); if (ok) { failures = 0; return; } if (++failures >= 6) { failures = 0; lockUntil = Date.now() + 60000; } throw new Fail('Wrong password.'); };

  let tokenPromise = null;
  async function cloudToken() {
    const c = cfg.cloud;
    if (!c?.url || !c?.key?.startsWith('sb_publishable_') || !c?.session) throw new Fail('Sign in to the school cloud account in Settings.');
    if (c.session.access && Date.now() < c.session.expires - 60000) return enc.dec(c.session.access);
    if (tokenPromise) return tokenPromise;
    tokenPromise = (async () => {
      const refresh = enc.dec(c.session.refresh || '');
      const r = await fetch(c.url.replace(/\/+$/, '') + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: {apikey:c.key,'Content-Type':'application/json'},
        body: JSON.stringify({refresh_token:refresh}), signal:AbortSignal.timeout(20000)
      });
      const d = await r.json();
      if (!r.ok || !d.access_token || !d.refresh_token) {c.session=null;saveCfg();throw new Fail('Cloud sign-in expired. Sign in again in Settings.');}
      c.session = {access:enc.enc(d.access_token),refresh:enc.enc(d.refresh_token),expires:Date.now()+Number(d.expires_in||3600)*1000};
      saveCfg();return d.access_token;
    })();
    try{return await tokenPromise;}finally{tokenPromise=null;}
  }
  const smsCreds = () => { const c = cfg.sms; if (!c || !c.username || !c.key) throw new Fail('Set up the SMS account first (Settings & Backup).'); return { username: c.username, key: enc.dec(c.key), senderId: c.senderId || '' }; };
  const smsSender = (...a) => require('./sms').sendBatch(...a);

  const H = {
    'auth.status': () => ({ role: A.role, hm: { hasPassword: A.hm.hasPassword() }, teacher: { hasPassword: !!cfg.teacherPassword, lastName: cfg.teacherName || '' } }),
    'auth.setup': ({ role, pw, name }) => {
      if (role === 'hm') { if (A.hm.hasPassword()) throw new Fail('Password already set.'); A.hm.setPassword(pw); A.role = 'hm'; return true; }
      if (role === 'teacher') { if (cfg.teacherPassword) throw new Fail('Password already set.'); const n = cleanName(name); setTeacherPw(pw); cfg.teacherName = n; saveCfg(); A.role = 'teacher'; A.teacherName = n; return true; }
      throw new Fail('Choose Headteacher or Teachers.');
    },
    'auth.login': ({ role, pw, name }) => {
      if (role === 'hm') { if (!A.hm.hasPassword()) throw new Fail('Set a password first.'); guard(A.hm.checkPassword(pw)); A.role = 'hm'; A.teacherName = ''; return true; }
      if (role === 'teacher') { if (!cfg.teacherPassword) throw new Fail('Set a password first.'); const n = cleanName(name); guard(teacherPwOk(pw)); cfg.teacherName = n; saveCfg(); A.role = 'teacher'; A.teacherName = n; return true; }
      throw new Fail('Choose Headteacher or Teachers.');
    },
    'auth.logout': () => { A.role = null; A.teacherName = ''; return true; },
    'auth.change': ({ old, pw }) => {
      if (A.role === 'teacher') { if (!teacherPwOk(old)) throw new Fail('Old password is wrong.'); setTeacherPw(pw); return true; }
      needHM().setPassword(pw, old); return true;
    },
    'teachers.resetPassword': () => { needHM(); cfg.teacherPassword = null; saveCfg(); A.hm.log('teachers password reset', 'by Headteacher'); A.hm.done(); return true; },
    'settings.get': () => { needHM(); return { cloud: { url: cfg.cloud?.url || '', hasKey: !!cfg.cloud?.key, signedIn: !!cfg.cloud?.session, status: A.cloud.status() }, teachers: { passwordSet: !!cfg.teacherPassword, lastName: cfg.teacherName || '' }, backupDir, dataDir }; },
    'settings.cloud': ({ url, key }) => { needHM(); const nextUrl=String(url||'').trim();const nextKey=String(key||'').trim(); if(nextKey && !/^sb_publishable_[\w-]+$/.test(nextKey))throw new Fail('Use the Supabase publishable key (sb_publishable_), never a secret or service_role key.'); const old=cfg.cloud||{};if(!nextKey && old.key && !old.key.startsWith('sb_publishable_'))throw new Fail('Replace the old privileged cloud key with a Supabase publishable key.');cfg.cloud=nextUrl?{url:nextUrl,key:nextKey||old.key||'',session:nextUrl===old.url&&(!nextKey||nextKey===old.key)?old.session:null}:null;saveCfg();A.cloud.st.error='';A.cloud.refresh();return true; },
    'cloud.login': async ({email,password}) => {needHM();const c=cfg.cloud;if(!c?.url||!c?.key)throw new Fail('Save the cloud URL and publishable key first.');if(!email||!password)throw new Fail('Enter the school cloud email and password.');const r=await fetch(c.url.replace(/\/+$/,'')+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:c.key,'Content-Type':'application/json'},body:JSON.stringify({email,password}),signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok||!d.access_token||!d.refresh_token)throw new Fail('Cloud login failed. Check the account credentials.');
      const pr=await fetch(c.url.replace(/\/+$/,'')+'/rest/v1/rpc/bgs_my_profile',{method:'POST',headers:{apikey:c.key,Authorization:'Bearer '+d.access_token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(20000)});const profile=pr.ok?await pr.json():null;if(!pr.ok||profile?.role!=='headteacher')throw new Fail('Cloud account is not authorized as Headteacher.');
      c.session={access:enc.enc(d.access_token),refresh:enc.enc(d.refresh_token),expires:Date.now()+Number(d.expires_in||3600)*1000};saveCfg();A.cloud.kick();return true; },
    'cloud.logout': () => {needHM();if(cfg.cloud)cfg.cloud.session=null;saveCfg();A.cloud.refresh();return true;},
    'cloud.test': async () => { needHM(); await A.cloud.test(); return true; },
     'cloud.pushAll': async () => { needHM(); if (!Object.keys(A.hm.d.students).length) throw new Fail('Cannot push an empty school database. Use Restore from Supabase first.'); await A.cloud.flush(true); return A.cloud.status(); },
    'cloud.previewRestore': async () => { needHM(); const rows=await A.cloud.download(); const r=A.cloud.buildRecovery(rows); return {records:r.valid,counts:r.counts,year:r.data.meta.current.year,term:r.data.meta.current.term}; },
    'cloud.restore': async ({confirm}) => {
      const hm=needHM(); if(confirm!=='RESTORE SCHOOL') throw new Fail('Type RESTORE SCHOOL to confirm.');
      if(A.cloud.busy) throw new Fail('Cloud synchronization is running. Please try again.');

      A.cloud.stop(); A.cloud.busy=true;
      try {
        const rows=await A.cloud.download(), r=A.cloud.buildRecovery(rows);
        const existing=hm.d;

        r.data.meta.pw=existing.meta.pw;
        r.data.meta.createdAt=existing.meta.createdAt;
        r.data.meta.seq=Math.max(0,...Object.values(r.data.marks).map(m=>Number(m.seq)||0),...Object.values(r.data.comments).map(m=>Number(m.seq)||0));
        r.data.dirty={};
        backupNow(false);
        hm.s.data=r.data; hm.d=r.data; hm.migrate(); hm.s.save(true);
        A.cloud.st.error=''; A.cloud.st.last=new Date().toISOString();
        return {records:r.valid,counts:r.counts};
      } finally {A.cloud.busy=false; A.cloud.loop=setInterval(()=>A.cloud.syncCycle(),8000); A.cloud.refresh(); notify('changed');}
    },
    'backup.now': () => ({ file: backupNow(false) }),
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
      return { to, cost: res[0].cost, status: res[0].status, statusCode: res[0].statusCode, messageId: res[0].messageId, delivery: 'unconfirmed' };
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
    'hm.newYearPreview': () => needHM().newYearPreview(),
    'hm.newYear': a => { const hm = needHM(); if (a.confirm !== true) throw new Fail('Please confirm before starting the new year.'); if (!hm.newYearPreview().canStart) hm.startNewYear(); /* throws the explanation */ backupNow(false); return hm.startNewYear(); },
    'hm.saveRemark': a => { needHM().saveHeadRemark(a.id, a.teacher, a.head); return true; },

    't.state': () => needT().state(),
    't.setMark': m => needT().setMark(m),
    't.setComment': a => { needT().setComment(a.id, a.teacher, a.head); return true; },
    't.setPromotion': a => needT().setPromotion(a),
    't.clearPromotion': a => needT().clearPromotion(a),
    't.exportClassLists': () => needT().exportClassLists(),
    't.exportMarksSheet': a => needT().exportMarksSheet(a),
    't.previewMarksImport': a => needT().previewMarksImport(a),
    't.applyMarksImport': a => needT().applyMarksImport(a),
  };
  return {
    A, backupNow, cfg,
    async call(action, args) {
      try { const f = H[action]; if (!f) throw new Fail('Unknown action ' + action); return { ok: true, data: await f(args || {}) }; }
      catch (e) { if (!(e instanceof Fail) && !/^(Marks must|Enter the|Wrong|Please|Not the|This |Choose|There are|None of|Could not|The file|Admission|Enter this)/.test(e.message)) console.error(e); return { ok: false, error: e.message || String(e) }; }
    },
    shutdown() { A.hm && A.hm.s.flush(); A.timers.forEach(clearInterval); A.cloud && A.cloud.stop(); },
  };
}
module.exports = { createApp };
