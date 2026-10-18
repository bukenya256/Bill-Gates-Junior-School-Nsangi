'use strict';
/** Cloud backup (Supabase REST). Every change marks a record "dirty"; dirty records are pushed immediately, and retried until they succeed. */
class Cloud {
  constructor(hm, getCfg, onStatus) { this.hm = hm; this.getCfg = getCfg; this.onStatus = onStatus || (() => { }); this.busy = false; this.timer = null; this.st = { state: 'off', pending: 0, last: null, error: '' }; this.loop = setInterval(() => this.flush(), 60000); this.refresh(); }
  status() { this.st.pending = Object.keys(this.hm.d.dirty).length; return this.st; }
  refresh() { const c = this.getCfg(); this.st.state = c && c.url && c.key ? (this.st.error ? 'error' : this.status().pending ? 'pending' : 'ok') : 'off'; this.onStatus(this.status()); }
  kick() { clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 800); this.refresh(); }
  _rec(col, id) {
    const d = this.hm.d;
    if (col === 'audit') return { key: 'audit:all', collection: 'audit', data: d.audit.slice(-500) };
    if (col === 'meta') return { key: 'meta:current', collection: 'meta', data: { current: d.meta.current, counters: d.meta.counters, admSeq: d.meta.admSeq } };
    const v = d[col] && d[col][id]; return v ? { key: `${col}:${id}`, collection: col, data: v } : null;
  }
  async _post(c, rows) {
    // PostgreSQL cannot update one ON CONFLICT target twice in a single statement.
    // Multiple dirty audit/meta entries deliberately resolve to the same cloud key.
    const unique = [...new Map(rows.map(row => [row.key, row])).values()];
    const r = await fetch(c.url.replace(/\/+$/, '') + '/rest/v1/records?on_conflict=key', { method: 'POST', headers: { apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(unique), signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`Cloud said ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  async test() { const c = this.getCfg(); if (!c || !c.url || !c.key) throw new Error('Enter the cloud address and key first.'); await this._post(c, [{ key: 'ping:test', collection: 'ping', data: { at: new Date().toISOString() }, updated_at: new Date().toISOString() }]); return true; }
  async flush(all) {
    const c = this.getCfg(); if (!c || !c.url || !c.key) return this.refresh();
    if (this.busy) return; this.busy = true;
    try {
      const d = this.hm.d;
      if (all) for (const col of ['students', 'staff', 'payments', 'bills', 'salaryBills', 'marks', 'comments']) for (const id of Object.keys(d[col])) d.dirty[col + ':' + id] = 1;
      if (all) { d.dirty['meta:current'] = 1; d.dirty['audit:all'] = 1; }
      for (;;) {
        const keys = Object.keys(d.dirty).slice(0, 200); if (!keys.length) break;
        const versions = new Map(keys.map(k => [k, d.dirty[k]]));
        const rows = [], now = new Date().toISOString();
        for (const k of keys) { const i = k.indexOf(':'), r = this._rec(k.slice(0, i), k.slice(i + 1)); if (r) rows.push({ ...r, updated_at: now }); }
        if (rows.length) await this._post(c, rows);
        for (const k of keys) if (d.dirty[k] === versions.get(k)) delete d.dirty[k];
        this.hm.s.save();
      }
      this.st.error = ''; this.st.last = new Date().toISOString();
    } catch (e) { this.st.error = String(e.message || e).replace(/fetch failed/, 'No internet connection – will retry'); }
    finally { this.busy = false; this.refresh(); }
  }
  stop() { clearInterval(this.loop); clearTimeout(this.timer); }
}
module.exports = { Cloud };
