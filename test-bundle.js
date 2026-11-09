// The installed app has NO node_modules folder: everything it needs is bundled into one file.
// This test builds that bundle, moves it somewhere with no node_modules, and runs real work through it
// (including the Excel export that crashed the Mac build with "Cannot find module ...").
const assert = require('node:assert/strict'), os = require('os'), path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const esbuild = require('esbuild');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bgs-bundle-'));
const main = esbuild.buildSync({ entryPoints: ['src/main.js'], bundle: true, platform: 'node', target: 'node18', external: ['electron'], write: false, metafile: true, logLevel: 'silent' });
const imports = Object.values(main.metafile.outputs)[0].imports.filter(i => i.external).map(i => i.path.replace(/^node:/, ''));
const allowed = new Set([...require('module').builtinModules, 'electron']);
assert.deepEqual(imports.filter(i => !allowed.has(i)), [], 'the app bundle must not depend on any outside library folder');

esbuild.buildSync({ entryPoints: ['src/core/app.js'], bundle: true, platform: 'node', target: 'node18', outfile: path.join(dir, 'app.bundle.js'), logLevel: 'silent' });
fs.writeFileSync(path.join(dir, 'run.js'), `
const assert = require('node:assert/strict'), path = require('path');
(async () => {
  const app = require('./app.bundle.js').createApp({ dataDir: path.join(__dirname, 'data'), backupDir: path.join(__dirname, 'bk') });
  const ok = async (a, x) => { const r = await app.call(a, x); assert.equal(r.ok, true, a + ': ' + r.error); return r.data; };
  await ok('auth.setup', { role: 'hm', pw: 'headpass1' });
  await ok('hm.addApplication', { first: 'Bukenya', last: 'T', className: 'P1', paidNow: 30000 });
  await ok('auth.logout'); await ok('auth.setup', { role: 'teacher', pw: 'teachpass1', name: 'Mr Okello' });
  const lists = await ok('t.exportClassLists'); assert(Buffer.from(lists.data, 'base64').subarray(0, 2).toString() === 'PK', 'class-list Excel file is a real .xlsx');
  const sheet = await ok('t.exportMarksSheet', { year: new Date().getFullYear(), term: 3, exam: 'EOT', cls: 'P1' }); assert(sheet.data.length > 1000);
  const pv = await ok('t.previewMarksImport', { year: 2026, term: 3, exam: 'EOT', cls: 'P1', data: sheet.data }); assert.equal(pv.toSave, 0);
  app.shutdown(); console.log('bundle ran');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });`);
const out = execFileSync(process.execPath, [path.join(dir, 'run.js')], { cwd: dir, encoding: 'utf8' });
assert.match(out, /bundle ran/);
fs.rmSync(dir, { recursive: true, force: true });
console.log('bundle (no node_modules) OK');
