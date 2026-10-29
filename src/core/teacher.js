'use strict';
const R = require('../shared/rules');
const { discover, DISCOVERY_PORT } = require('./discovery');
const { normKey } = require('./server');
const nowISO = () => new Date().toISOString();
const DEFAULTS = { cfg: { hm: '', key: '', teacher: '', hmId: '' }, students: [], current: null, marks: {}, comments: {}, promotions: {}, unsynced: { marks: {}, comments: {}, promotions: {} }, lastSeq: 0, academic: {subjects:null,grades:null} };

class Teacher {
  constructor(store, onChange, opts = {}) {
    this.discoveryPort = opts.discoveryPort || DISCOVERY_PORT; this.lastFind = 0; this.s = store; this.d = store.data; this.d.academic ||= {subjects:null,grades:null}; R.configureAcademics(this.d.academic.subjects,this.d.academic.grades); this.d.promotions ||= {}; this.d.unsynced.promotions ||= {}; this.onChange = onChange || (() => { }); this.conn = { state: 'offline', error: '', last: null, address: '', searching: false }; this.busy = false; this.loop = setInterval(() => this.sync(), 8000); setTimeout(() => this.sync(), 500); }
  pending() { return Object.keys(this.d.unsynced.marks).length + Object.keys(this.d.unsynced.comments).length + Object.keys(this.d.unsynced.promotions).length; }
  state() { return { cfg: { ...this.d.cfg }, students: this.d.students, academic:this.d.academic, current: this.d.current || R.detectTerm(R.localISO()), marks: Object.values(this.d.marks), comments: Object.values(this.d.comments), promotions: Object.values(this.d.promotions), conn: { ...this.conn, pending: this.pending() } }; }
  setConfig(c) {
    const raw = normKey(c.key), key = raw.length === 8 ? raw.slice(0, 4) + '-' + raw.slice(4) : String(c.key || '').trim().toUpperCase();
    const hm = String(c.hm || '').trim() || this.d.cfg.hm;
    const changed = key !== this.d.cfg.key;
    Object.assign(this.d.cfg, { hm, key, teacher: String(c.teacher || '').trim() });
    if (changed) { this.d.cfg.hmId = ''; this.d.lastSeq = 0; }
    this.s.save(true); this.lastFind = 0; this.sync(); this.onChange();
  }
  _base() { let h = this.d.cfg.hm.replace(/^https?:\/\//, '').replace(/\/+$/, ''); if (!h) return ''; if (!/:\d+$/.test(h)) h += ':4750'; return 'http://' + h; }
  setMark(m) {
    const id = R.markKey(m.year, m.term, m.exam, m.studentId, m.subject);
    const rec = { id, year: +m.year, term: +m.term, exam: m.exam, studentId: m.studentId, className: m.className, subject: m.subject, score: m.absent || m.cleared ? null : Number(m.score), absent: !!m.absent, cleared: !!m.cleared, by: this.d.cfg.teacher || 'Teacher', at: nowISO() };
    if (!rec.cleared && !rec.absent && !(rec.score >= 0 && rec.score <= R.MAX_MARK)) throw new Error('Marks must be 0–100.');
    this.d.marks[id] = rec; this.d.unsynced.marks[id] = 1; this.s.save(); this.sync(); return rec;
  }
  setComment(id, teacher, head) { this.d.comments[id] = { id, teacher, head, at: nowISO() }; this.d.unsynced.comments[id] = 1; this.s.save(); this.sync(); }
  setPromotion({studentId, year, term, decision}) {
    if (Number(term) !== 3 || Number(year) !== Number(this.d.current.year) || Number(this.d.current.term) !== 3) throw new Error('Promotion decisions can only be entered during current Term 3.');
    if (!this.d.students.some(s => s.id === studentId && s.status === 'active')) throw new Error('Active student not found.');
    if (!['promoted','repeat'].includes(decision)) throw new Error('Choose Promoted or Repeat Class.');
    const key = `${year}|${studentId}`;
    const rec = {key, studentId, year: Number(year), term: 3, decision, by: this.d.cfg.teacher || 'Director of Studies', at: nowISO()};
    this.d.promotions[key] = rec; this.d.unsynced.promotions[key] = 1; this.s.save(true); this.sync(); return rec;
  }
  async _f(path, opt = {}) {
    const base = this._base(); if (!base) { const e = new Error('Searching for the Headteacher PC…'); e.noAddress = true; throw e; }
    const r = await fetch(base + path, { ...opt, headers: { 'X-School-Key': this.d.cfg.key, 'X-Device-Name': this.d.cfg.teacher || 'Teachers PC', 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (r.status === 401) { const e = new Error('The school key is not accepted – check the key shown on the Headteacher PC (Settings & Backup).'); e.auth = true; throw e; }
    if (!r.ok) throw new Error('Headteacher PC answered ' + r.status);
    return r.json();
  }
  async findHM() {
    if (!this.d.cfg.key) return false;
    this.conn.searching = true; this.onChange();
    try {
      const found = await discover({ port: this.discoveryPort });
      found.sort((a, b) => Number(b.id === this.d.cfg.hmId) - Number(a.id === this.d.cfg.hmId));
      let wrongKey = false;
      for (const f of found) {
        if (this.d.cfg.hmId && f.id && f.id !== this.d.cfg.hmId) continue;
        const addr = f.ip + ':' + f.port;
        try {
          const r = await fetch('http://' + addr + '/api/teacher/hello', { headers: { 'X-School-Key': this.d.cfg.key }, signal: AbortSignal.timeout(3000) });
          if (r.status === 401) { wrongKey = true; continue; }
          if (!r.ok) continue;
          const j = await r.json();
          this.d.cfg.hm = addr; if (j.id) this.d.cfg.hmId = j.id; this.s.save(true);
          return true;
        } catch (e) { void e; }
      }
      this.findNote = wrongKey ? 'The Headteacher PC was found but it does not accept this school key. Check the key and save again.' : '';
      return false;
    } finally { this.conn.searching = false; this.lastFind = Date.now(); }
  }
  async sync() {
    if (this.busy || !this.d.cfg.key) return; this.busy = true;
    try {
      try { await this._syncOnce(); }
      catch (e) {
        if (e.auth || Date.now() - this.lastFind < 6000) throw e;
        if (await this.findHM()) await this._syncOnce(); else throw e;
      }
    } catch (e) {
      const msg = e.auth ? e.message : (this.findNote || 'Looking for the Headteacher PC. Make sure it is switched on, the program is open and the Ethernet cable is plugged in on both computers.');
      this.conn = { ...this.conn, state: 'offline', error: msg, last: this.conn.last, address: this.d.cfg.hm };
    } finally { this.busy = false; this.onChange(); }
  }
  async _syncOnce() {
    const u = this.d.unsynced, mk = Object.keys(u.marks), ck = Object.keys(u.comments), pk = Object.keys(u.promotions);
    const saved = new Map([...mk.map(k => ['m:' + k, this.d.marks[k]?.at]), ...ck.map(k => ['c:' + k, this.d.comments[k]?.at]), ...pk.map(k => ['p:' + k, this.d.promotions[k]?.at])]);
    if (mk.length || ck.length || pk.length) {
      await this._f('/api/teacher/push', { method: 'POST', body: JSON.stringify({ device: this.d.cfg.teacher, marks: mk.map(k => this.d.marks[k]), comments: ck.map(k => this.d.comments[k]), promotions: pk.map(k => this.d.promotions[k]) }) });
      for (const k of mk) if (u.marks[k] && this.d.marks[k]?.at === saved.get('m:' + k)) delete u.marks[k];
      for (const k of ck) if (this.d.comments[k]?.at === saved.get('c:' + k)) delete u.comments[k];
      for (const k of pk) if (this.d.promotions[k]?.at === saved.get('p:' + k)) delete u.promotions[k];
    }
    const snap = await this._f('/api/teacher/sync?since=' + this.d.lastSeq);
    this.d.students = snap.students; this.d.current = snap.current; this.d.academic = snap.academic || this.d.academic; R.configureAcademics(this.d.academic.subjects, this.d.academic.grades);
    for (const r of (snap.promotions || [])) if (!u.promotions[r.key]) this.d.promotions[r.key] = r;
    for (const m of snap.marks) { const o = this.d.marks[m.id]; if (!o || o.at <= m.at) { if (!u.marks[m.id]) this.d.marks[m.id] = m; } }
    for (const c of snap.comments) { const o = this.d.comments[c.id]; if (!o || o.at <= c.at) { if (!u.comments[c.id]) this.d.comments[c.id] = c; } }
    if (snap.hmId) this.d.cfg.hmId = snap.hmId;
    this.d.lastSeq = snap.maxSeq; this.findNote = ''; this.conn = { state: 'online', error: '', last: nowISO(), address: this.d.cfg.hm, searching: false }; this.s.save();
  }
  stop() { clearInterval(this.loop); }
}
module.exports = { Teacher, DEFAULTS };
