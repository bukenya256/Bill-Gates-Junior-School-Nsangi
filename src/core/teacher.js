'use strict';
const R = require('../shared/rules');
const nowISO = () => new Date().toISOString();
const DEFAULTS = { cfg: { hm: '', key: '', teacher: '' }, students: [], current: null, marks: {}, comments: {}, unsynced: { marks: {}, comments: {} }, lastSeq: 0 };
/** The Teachers' PC: own local copy of marks (saved immediately), auto-forwarded to the Headteacher PC. */
class Teacher {
  constructor(store, onChange) { this.s = store; this.d = store.data; this.onChange = onChange || (() => { }); this.conn = { state: 'offline', error: '', last: null }; this.busy = false; this.loop = setInterval(() => this.sync(), 8000); setTimeout(() => this.sync(), 500); }
  pending() { return Object.keys(this.d.unsynced.marks).length + Object.keys(this.d.unsynced.comments).length; }
  state() { return { cfg: { ...this.d.cfg }, students: this.d.students, current: this.d.current || R.detectTerm(R.localISO()), marks: Object.values(this.d.marks), comments: Object.values(this.d.comments), conn: { ...this.conn, pending: this.pending() } }; }
  setConfig(c) { Object.assign(this.d.cfg, { hm: String(c.hm || '').trim(), key: String(c.key || '').trim().toUpperCase(), teacher: String(c.teacher || '').trim() }); this.s.save(true); this.sync(); this.onChange(); }
  _base() { let h = this.d.cfg.hm.replace(/^https?:\/\//, '').replace(/\/+$/, ''); if (!h) return ''; if (!/:\d+$/.test(h)) h += ':4750'; return 'http://' + h; }
  setMark(m) {
    const id = R.markKey(m.year, m.term, m.exam, m.studentId, m.subject);
    const rec = { id, year: +m.year, term: +m.term, exam: m.exam, studentId: m.studentId, className: m.className, subject: m.subject, score: m.absent || m.cleared ? null : Number(m.score), absent: !!m.absent, cleared: !!m.cleared, by: this.d.cfg.teacher || 'Teacher', at: nowISO() };
    if (!rec.cleared && !rec.absent && !(rec.score >= 0 && rec.score <= R.MAX_MARK)) throw new Error('Marks must be 0–100.');
    this.d.marks[id] = rec; this.d.unsynced.marks[id] = 1; this.s.save(); this.sync(); return rec;
  }
  setComment(id, teacher, head) { this.d.comments[id] = { id, teacher, head, at: nowISO() }; this.d.unsynced.comments[id] = 1; this.s.save(); this.sync(); }
  async _f(path, opt = {}) {
    const base = this._base(); if (!base) throw new Error('Enter the Headteacher PC address in Connection settings.');
    const r = await fetch(base + path, { ...opt, headers: { 'X-School-Key': this.d.cfg.key, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(8000) });
    if (r.status === 401) throw new Error('Wrong school key – ask the Headteacher for the key shown on her PC.');
    if (!r.ok) throw new Error('Headteacher PC answered ' + r.status);
    return r.json();
  }
  async sync() {
    if (this.busy || !this.d.cfg.hm) return; this.busy = true;
    try {
      const u = this.d.unsynced, mk = Object.keys(u.marks), ck = Object.keys(u.comments);
      if (mk.length || ck.length) {
        await this._f('/api/teacher/push', { method: 'POST', body: JSON.stringify({ device: this.d.cfg.teacher, marks: mk.map(k => this.d.marks[k]), comments: ck.map(k => this.d.comments[k]) }) });
        for (const k of mk) if (u.marks[k]) delete u.marks[k]; for (const k of ck) delete u.comments[k];
      }
      const snap = await this._f('/api/teacher/sync?since=' + this.d.lastSeq);
      this.d.students = snap.students; this.d.current = snap.current;
      for (const m of snap.marks) { const o = this.d.marks[m.id]; if (!o || o.at <= m.at) { if (!u.marks[m.id]) this.d.marks[m.id] = m; } }
      for (const c of snap.comments) { const o = this.d.comments[c.id]; if (!o || o.at <= c.at) { if (!u.comments[c.id]) this.d.comments[c.id] = c; } }
      this.d.lastSeq = snap.maxSeq; this.conn = { state: 'online', error: '', last: nowISO() }; this.s.save();
    } catch (e) { this.conn = { state: 'offline', error: String(e.message || e).replace(/fetch failed|This operation was aborted due to timeout/, 'Cannot reach the Headteacher PC (is it on, and on the same network?)'), last: this.conn.last }; }
    finally { this.busy = false; this.onChange(); }
  }
  stop() { clearInterval(this.loop); }
}
module.exports = { Teacher, DEFAULTS };
