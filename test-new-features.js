const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createApp}=require('./src/core/app');
const {subjectsFor,gradeOf}=require('./src/shared/rules');
const d=fs.mkdtempSync(path.join(os.tmpdir(),'bgs-v17-'));
(async()=>{
 const app=createApp({dataDir:path.join(d,'hm'),backupDir:path.join(d,'bak')});
 const call=async(a,x)=>{const r=await app.call(a,x);assert.equal(r.ok,true,`${a} ${r.error}`);return r.data;};
 await call('auth.setup',{role:'hm',pw:'long-secure-password'});
 await call('hm.setSubjects',{cls:'P1',subjects:['Science','Reading']});
 assert.deepEqual(subjectsFor('P1'),['Science','Reading']);
 await call('hm.setGrades',{grades:[{min:75,g:'A',label:'Strong'},{min:0,g:'B',label:'Developing'}]});
 assert.equal(gradeOf(80).g,'A');
 await call('hm.saveNotification',{category:'School fees reminder',subject:'Fee reminder',message:'Please contact the school.',recipients:'balances'});
 const state=await call('hm.state',{});assert.equal(state.notifications.length,1);assert.equal(state.notifications[0].status,'draft');
 assert.equal(state.academic.subjects.P1.length,2);
 // subjects set by the Headteacher are what the Teachers' portal shows – same computer, same records, no waiting
 await call('auth.logout'); await call('auth.setup',{role:'teacher',pw:'abcdefgh',name:'Mr Okello'});
 assert.deepEqual((await call('t.state')).academic.subjects.P1,['Science','Reading']);
 assert.equal((await app.call('t.state')).ok,true);
 assert.equal((await call('auth.logout')),true);assert.equal((await app.call('t.state')).ok,false);
 assert.equal((await app.call('auth.login',{role:'teacher',pw:'wrong',name:'X'})).ok,false);
 assert.equal((await app.call('auth.login',{role:'teacher',pw:'abcdefgh',name:'Ms Auma'})).ok,true);
 for(let i=0;i<7;i++) await app.call('auth.login',{role:'teacher',pw:'wrong',name:'X'});
 assert.match((await app.call('auth.login',{role:'teacher',pw:'abcdefgh',name:'X'})).error,/Too many/);
 app.shutdown(); console.log('v1.7 academics/notifications/roles OK');
})().catch(e=>{console.error(e);process.exitCode=1});
