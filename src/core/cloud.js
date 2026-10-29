'use strict';

class Cloud {
  constructor(hm, getCfg, onStatus) { this.hm = hm; this.getCfg = getCfg; this.onStatus = onStatus || (() => { }); this.busy = false; this.timer = null; this.st = { state: 'off', pending: 0, last: null, error: '' }; this.loop = setInterval(() => this.syncCycle(), 8000); this.pulling = false; this.refresh(); }
  status() { this.st.pending = Object.keys(this.hm.d.dirty).length; return this.st; }
  refresh() { const c = this.getCfg(); this.st.state = c && c.url && c.key && c.getToken ? (this.st.error ? 'error' : this.status().pending ? 'pending' : 'ok') : 'off'; this.onStatus(this.status()); }
  kick() { clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 400); this.refresh(); }
  _rec(col, id) {
    const d = this.hm.d;
    if (col === 'audit') return { key: 'audit:all', collection: 'audit', data: d.audit.slice(-500) };
    if (col === 'academic') return { key:'academic:current',collection:'academic',data:d.academic };
    if (col === 'meta') return { key: 'meta:current', collection: 'meta', data: { current: d.meta.current, counters: d.meta.counters, admSeq: d.meta.admSeq } };
    const v = d[col] && d[col][id]; return v ? { key: `${col}:${id}`, collection: col, data: v } : null;
  }
  async _headers(c) { return {apikey:c.key,Authorization:'Bearer '+await c.getToken()}; }
  async _post(c, rows) {

    const unique = [...new Map(rows.map(row => [row.key, row])).values()];
    const r = await fetch(c.url.replace(/\/+$/, '') + '/rest/v1/records?on_conflict=key', { method: 'POST', headers: { ...(await this._headers(c)), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(unique), signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`Cloud said ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  async test() { const c = this.getCfg(); if (!c || !c.url || !c.key) throw new Error('Enter the cloud address and key first.'); await this._post(c, [{ key: 'ping:test', collection: 'ping', data: { at: new Date().toISOString() }, updated_at: new Date().toISOString() }]); return true; }
  async flush(all) {
    const c = this.getCfg(); if (!c || !c.url || !c.key) return this.refresh();
    if (!Object.keys(this.hm.d.students).length) { this.st.error = 'Empty school database: restore from cloud before uploading.'; return this.refresh(); }
    if (this.busy) return; this.busy = true;
    try {
      const d = this.hm.d;
      if (all) for (const col of ['students', 'staff', 'payments', 'bills', 'salaryBills', 'marks', 'comments', 'discipline', 'promotions','notifications']) for (const id of Object.keys(d[col])) d.dirty[col + ':' + id] = 1;
      if (all) { d.dirty['meta:current'] = 1; d.dirty['academic:current']=1; d.dirty['audit:all'] = 1; }
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
  async syncCycle() {
    if (this.busy || this.pulling) return;
    await this.pullWebChanges();
    await this.flush();
  }
  async pullWebChanges() {
    const c = this.getCfg(); if (!c?.url || !c?.key || this.busy || this.pulling) return;
    this.pulling = true;
    try {
      // Pull only web-origin records. Do not replace the full local school database.
      const url = c.url.replace(/\/+$/, '') + '/rest/v1/records?select=key,collection,data,updated_at&collection=in.(payments,marks)&data-%3E%3Esource=eq.web&order=key.asc';
      const rows = [];
      for (let offset=0; offset<100000;offset+=500) {
        const r=await fetch(url,{headers:{...(await this._headers(c)),Range:`${offset}-${offset+499}`,'Range-Unit':'items'},signal:AbortSignal.timeout(20000)});
        if(!r.ok) throw new Error('Web changes download failed: '+r.status);
        const batch=await r.json(); if(!Array.isArray(batch)) throw new Error('Invalid web response');
        rows.push(...batch); if(batch.length<500) break;
      }
      let changed=0;
      for(const row of rows){
        const d=row.data; if(!d || typeof d!=='object') continue;
        if(row.collection==='payments' && row.key==='payments:'+d.id && d.source==='web' && d.kind==='fees' && this.hm.d.students[d.studentId] && Number.isInteger(d.amount) && d.amount>0 && Number.isInteger(d.year) && [1,2,3].includes(d.term) && !this.hm.d.payments[d.id]) { this.hm.d.payments[d.id]=d;changed++; }
        if(row.collection==='marks' && row.key==='marks:'+d.id && d.source==='web' && this.hm.d.students[d.studentId] && Number.isInteger(d.score) && d.score>=0 && d.score<=100 && typeof d.at==='string'){
          const old=this.hm.d.marks[d.id];
          if(!this.hm.d.dirty['marks:'+d.id] && (!old || (Date.parse(old.at || '') || 0) < (Date.parse(d.at || '') || 0))){
            // Preserve a newer offline desktop edit; it will upload on the next flush.
            this.hm.d.marks[d.id]={...d,seq:this.hm.nextSeq()}; changed++;
          }
        }
      }
      if(changed){this.hm.log('cloud web import',String(changed)+' changes');this.hm.done();}
      this.st.error='';this.st.last=new Date().toISOString();
    }catch(e){this.st.error=String(e.message||e);} finally {this.pulling=false;this.refresh();}
  }
  async download() {
    const c = this.getCfg(); if (!c?.url || !c?.key) throw new Error('Configure Supabase first.');
    const url = c.url.replace(/\/+$/, '') + '/rest/v1/records?select=key,collection,data&order=key.asc';
    const rows = [];
    for (let offset = 0; ; offset += 500) {
      if (offset >= 200000) throw new Error('Cloud recovery exceeds safety limit. Contact support.');
      const r = await fetch(url, { headers: { ...(await this._headers(c)), Range: `${offset}-${offset+499}`, 'Range-Unit': 'items' }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`Cloud download failed ${r.status}: ${(await r.text()).slice(0,180)}`);
      const batch = await r.json(); if (!Array.isArray(batch)) throw new Error('Unexpected cloud response.');
      rows.push(...batch); if (batch.length < 500) break;
    }
    return rows;
  }
  buildRecovery(rows) {
    const {DEFAULTS} = require('./hm');
    const d = structuredClone(DEFAULTS), counts = {};
    const allowed = ['notifications','students','staff','payments','bills','salaryBills','marks','comments','discipline','promotions'];
    let valid = 0;
    for (const row of rows) {
      if (!row || typeof row.key !== 'string' || !row.data || typeof row.data !== 'object') continue;
      if (row.key === 'meta:current' && row.collection === 'meta') {
        if (!row.data.current || !Number.isInteger(+row.data.current.year) || ![1,2,3].includes(+row.data.current.term)) throw new Error('Cloud academic-year record is invalid.');
        Object.assign(d.meta, { current: row.data.current, counters: row.data.counters || {}, admSeq: row.data.admSeq || {} }); valid++; continue;
      }
      if (row.key === 'academic:current' && row.collection==='academic') { d.academic=row.data; valid++; continue; }
      if (row.key === 'audit:all' && row.collection === 'audit') { if(Array.isArray(row.data)) d.audit=row.data; valid++; continue; }
      if (!allowed.includes(row.collection) || !row.key.startsWith(row.collection+':')) continue;
      const id=row.key.slice(row.collection.length+1); if (!id || Object.hasOwn(d[row.collection],id)) throw new Error('Duplicate or invalid cloud record: '+row.key);
      d[row.collection][id]=row.data; counts[row.collection]=(counts[row.collection]||0)+1; valid++;
    }
    if (!valid || !d.meta.current || !Object.keys(d.students).length) throw new Error('Cloud data has no complete student register and year metadata. Recovery stopped.');
    for (const [id,s] of Object.entries(d.students)) if(s.id!==id || !s.first || !s.last) throw new Error('Invalid student found: '+id);
    for (const [id,r] of Object.entries(d.payments)) if(r.id!==id || !Number.isFinite(r.amount)) throw new Error('Invalid payment found: '+id);
    return {data:d,counts,valid};
  }
  stop() { clearInterval(this.loop); clearTimeout(this.timer); }
}
module.exports = { Cloud };
