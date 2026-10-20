const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('./src/core/app');
const {subjectsFor,gradeOf}=require('./src/shared/rules');
const d=fs.mkdtempSync(path.join(os.tmpdir(),'bgs-v14-'));
(async()=>{
 const app=createApp({dataDir:path.join(d,'hm'),backupDir:path.join(d,'bak'),port:0});
 const call=async(a,x)=>{const r=await app.call(a,x);assert.equal(r.ok,true,`${a} ${r.error}`);return r.data;};
 await call('mode.set','hm');await call('auth.setup',{pw:'long-secure-password'});
 await call('hm.setSubjects',{cls:'P1',subjects:['Science','Reading']});
 assert.deepEqual(subjectsFor('P1'),['Science','Reading']);
 await call('hm.setGrades',{grades:[{min:75,g:'A',label:'Strong'},{min:0,g:'B',label:'Developing'}]});
 assert.equal(gradeOf(80).g,'A');
 await call('hm.saveNotification',{category:'School fees reminder',subject:'Fee reminder',message:'Please contact the school.',recipients:'balances'});
 const state=await call('hm.state',{});assert.equal(state.notifications.length,1);assert.equal(state.notifications[0].status,'draft');
 assert.equal(state.academic.subjects.P1.length,2);
 app.shutdown();
 const t=createApp({dataDir:path.join(d,'teacher'),backupDir:path.join(d,'tbak'),port:0});
 await callDummy();
 async function callDummy(){assert.equal((await t.call('mode.set','teacher')).ok,true);assert.equal((await t.call('t.state')).ok,false);assert.equal((await t.call('auth.setup',{pw:'abcdefgh'})).ok,true);assert.equal((await t.call('t.state')).ok,true);assert.equal((await t.call('auth.logout')).ok,true);assert.equal((await t.call('t.state')).ok,false);assert.equal((await t.call('auth.login',{pw:'wrong'})).ok,false);assert.equal((await t.call('auth.login',{pw:'abcdefgh'})).ok,true);}
 t.shutdown(); console.log('v1.4 academics/notifications/teacher auth OK');
})().catch(e=>{console.error(e);process.exitCode=1});
