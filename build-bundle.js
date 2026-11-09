'use strict';
// Bundles the program (and the Excel library) into src/main.bundle.js so the installed app needs no node_modules.
// Runs by itself right before electron-builder packs the app (see "beforePack"), so a build can never be
// missing it, and also from `npm run bundle`.
const path = require('path');
function run() {
  require('esbuild').buildSync({
    entryPoints: [path.join(__dirname, 'src', 'main.js')], bundle: true, platform: 'node', target: 'node18',
    external: ['electron'], outfile: path.join(__dirname, 'src', 'main.bundle.js'), logLevel: 'warning',
  });
  console.log('  • bundled src/main.bundle.js');
}
module.exports = run; module.exports.default = run;
if (require.main === module) run();
