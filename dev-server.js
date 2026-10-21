// Browser test harness: serves the same screens over http and bridges window.bgs to the real core logic.
const http=require('http'),fs=require('fs'),path=require('path'),os=require('os');
const {createApp}=require('./src/core/app');
const [,, dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'bgsdev-')), port=5001, lan=4750]=process.argv;
const clients=new Set();
const core=createApp({dataDir,backupDir:path.join(dataDir,'bk'),port:+lan,notify:k=>clients.forEach(r=>r.write(`data: ${k}\n\n`))});
const BRIDGE=`window.bgs={call:async(a,g)=>{const r=await (await fetch('/rpc',{method:'POST',body:JSON.stringify({a,g})})).json();if(!r.ok)throw new Error(r.error);return r.data},on:cb=>{const e=new EventSource('/events');e.onmessage=m=>cb(m.data)}};`;
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpeg':'image/jpeg','.webp':'image/webp'};
http.createServer((q,s)=>{
 if(q.url==='/bridge.js'){s.setHeader('content-type','text/javascript');return s.end(BRIDGE)}
 if(q.url==='/events'){s.writeHead(200,{'content-type':'text/event-stream'});clients.add(s);return q.on('close',()=>clients.delete(s))}
 if(q.url==='/rpc'){let b='';q.on('data',c=>b+=c);return q.on('end',async()=>{const {a,g}=JSON.parse(b);if(a==='mode.set'){const r=await core.call(a,g);return s.end(JSON.stringify(r))}s.end(JSON.stringify(await core.call(a,g)))})}
 let p=q.url.split('?')[0]; if(p==='/'){s.writeHead(302,{location:'/'+(core.A.mode==='hm'?'hm/index.html':core.A.mode==='teacher'?'teacher/index.html':'mode.html')});return s.end()}
 const f=path.join(__dirname,'src',p); if(!f.startsWith(path.join(__dirname,'src'))||!fs.existsSync(f)||fs.statSync(f).isDirectory()){s.statusCode=404;return s.end('nf')}
 let body=fs.readFileSync(f); if(f.endsWith('.html')) body=Buffer.from(body.toString().replace('<script','<script src="/bridge.js"></script><script').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,''));
 s.setHeader('content-type',types[path.extname(f)]||'text/plain');s.end(body);
}).listen(+port,()=>console.log('dev on',port));
