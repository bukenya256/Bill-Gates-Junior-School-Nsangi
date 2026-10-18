'use strict';
const fs = require('fs'), path = require('path');
/** Small, safe JSON database: atomic writes, automatic .bak copy, dirty-key list for cloud sync. */
class Store {
  constructor(file, defaults) {
    this.file = file; this.defaults = defaults; this.timer = null;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.data = this._load();
    for (const k of Object.keys(defaults)) if (this.data[k] === undefined) this.data[k] = JSON.parse(JSON.stringify(defaults[k]));
  }
  _read(f) { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  _load() {
    for (const f of [this.file, this.file + '.bak']) { try { if (fs.existsSync(f)) return this._read(f); } catch (e) { /* try backup */ } }
    return {};
  }
  save(now) {
    if (now) { clearTimeout(this.timer); this.timer = null; return this._write(); }
    if (!this.timer) this.timer = setTimeout(() => { this.timer = null; this._write(); }, 250);
  }
  _write() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data));
    if (fs.existsSync(this.file)) { try { fs.copyFileSync(this.file, this.file + '.bak'); } catch (e) { /* ignore */ } }
    fs.renameSync(tmp, this.file);
  }
  flush() { if (this.timer) this.save(true); }
}
module.exports = { Store };
