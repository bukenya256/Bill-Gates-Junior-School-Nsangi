const assert=require('assert'),os=require('os'),path=require('path'),fs=require('fs'),http=require('http');
const {Store}=require('./src/core/store'),{HM,DEFAULTS}=require('./src/core/hm'),{startServer}=require('./src/core/server'),{Teacher,DEFAULTS:TD}=require('./src/core/teacher'),{Cloud}=require('./src/core/cloud');
(async()=>{
const d=fs.mkdtempSync(path.join(os.tmpdir(),'bgs-'));
const hm=new HM(new Store(path.join(d,'hm.json'),DEFAULTS)); const srv=startServer(hm,4799);
// mock supabase
const rows={}; let fail=false;
const sb=http.createServer((q,s)=>{let b='';q.on('data',c=>b+=c);q.on('end',()=>{ if(fail){s.writeHead(503);return s.end('down')} const batch=JSON.parse(b); if(new Set(batch.map(r=>r.key)).size!==batch.length){s.writeHead(500);return s.end('ON CONFLICT DO UPDATE command cannot affect row a second time')} for(const r of batch)rows[r.key]=r; s.writeHead(201);s.end();});}).listen(4798);
const cloud=new Cloud(hm,()=>({url:'http://localhost:4798',key:'k'}));
const a=hm.addApplication({first:'A',last:'B',className:'P3',paidNow:30000}); const id=a.student.id;
hm.log('first',{}); hm.log('second',{}); hm.touch('meta','current'); hm.touch('meta','another'); fail=true; await cloud.flush(); assert(cloud.status().pending>0 && cloud.st.error); fail=false; await cloud.flush(); assert.equal(cloud.status().pending,0); assert(rows['audit:all']); assert(rows['meta:current']); assert(rows['payments:'+a.receipt.id]); assert(rows['students:'+id]);
const t=new Teacher(new Store(path.join(d,'t.json'),TD),()=>{},{discoveryPort:4800}); t.setConfig({hm:'127.0.0.1:4799',key:'WRONG',teacher:'Mr Okello'});
await new Promise(r=>setTimeout(r,300)); assert(/school key is not accepted/.test(t.conn.error));
t.setConfig({hm:'127.0.0.1:4799',key:hm.d.meta.lanKey.toLowerCase(),teacher:'Mr Okello'}); await new Promise(r=>setTimeout(r,400)); assert.equal(t.conn.state,'online'); assert.equal(t.d.students.length,1);
t.setMark({year:2026,term:3,exam:'BOT',studentId:id,className:'P3',subject:'Science',score:88}); await new Promise(r=>setTimeout(r,400));
assert.equal(Object.keys(hm.d.marks).length,1); assert.equal(t.pending(),0);
await cloud.flush(); assert(Object.keys(rows).some(k=>k.startsWith('marks:')));
// offline then back
srv.close(); t.setMark({year:2026,term:3,exam:'BOT',studentId:id,className:'P3',subject:'English',score:70}); await new Promise(r=>setTimeout(r,2500)); assert.equal(t.pending(),1); assert.equal(t.conn.state,'offline');
const srv2=startServer(hm,4799); await new Promise(r=>setTimeout(r,200)); await new Promise(r=>setTimeout(r,500)); await t.sync(); assert.equal(t.pending(),0); assert.equal(Object.keys(hm.d.marks).length,2);
// address changes: wrong remembered address, auto-discovered with the saved key only
const t2=new Teacher(new Store(path.join(d,'t2.json'),TD),()=>{},{discoveryPort:4800}); t2.setConfig({hm:'',key:hm.d.meta.lanKey.replace('-',''),teacher:'Ms Auma'});
await new Promise(r=>setTimeout(r,3500)); assert.equal(t2.conn.state,'online'); assert(/:4799$/.test(t2.d.cfg.hm)&&!/^169/.test(t2.d.cfg.hm)); assert.equal(t2.d.cfg.key,hm.d.meta.lanKey); assert.equal(t2.d.cfg.hmId,hm.d.meta.hmId);
t2.d.cfg.hm='169.254.9.9:4750'; t2.lastFind=0; await t2.sync(); assert.equal(t2.conn.state,'online'); assert(/:4799$/.test(t2.d.cfg.hm)&&!/^169/.test(t2.d.cfg.hm));
assert(srv2.peers().some(p=>p.name==='Ms Auma'));
const t3=new Teacher(new Store(path.join(d,'t3.json'),TD),()=>{},{discoveryPort:4800}); t3.setConfig({hm:'',key:'AAAA-BBBB',teacher:'X'}); await new Promise(r=>setTimeout(r,3000)); assert.equal(t3.conn.state,'offline'); assert(/does not accept/.test(t3.conn.error),t3.conn.error);
t2.stop();
const t2b=new Teacher(new Store(path.join(d,'t2.json'),TD),()=>{},{discoveryPort:4800}); await new Promise(r=>setTimeout(r,1500)); assert.equal(t2b.conn.state,'online'); assert.equal(t2b.d.cfg.teacher,'Ms Auma'); t2b.stop();
t3.stop();
// teacher can't reach fees
const r=await fetch('http://127.0.0.1:4799/api/teacher/fees',{headers:{'x-school-key':hm.d.meta.lanKey}}); assert.equal(r.status,404);
console.log('net OK'); process.exit(0);})().catch(e=>{console.error(e);process.exit(1)});
