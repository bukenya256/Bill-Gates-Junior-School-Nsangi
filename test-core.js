const assert=require('assert'),os=require('os'),path=require('path'),fs=require('fs');
const {Store}=require('./src/core/store'),{HM,DEFAULTS}=require('./src/core/hm');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bgs-'));
const hm=new HM(new Store(path.join(dir,'db.json'),DEFAULTS));
hm.setCurrentTerm(2026,3);
let r=hm.addApplication({first:'Nakato',last:'Grace',className:'P5',type:'boarding',paidNow:'10,000'});
const id=r.student.id; assert.equal(r.student.status,'pending'); assert.equal(r.receipt.balance,20000);
let st=hm.getState().students[0]; assert.equal(st.admission.balance,20000);
assert.throws(()=>hm.payAdmission(id,'25,000'));
hm.payAdmission(id,20000); st=hm.getState().students[0]; assert.equal(st.status,'active'); assert.equal(st.admission.status,'paid');
assert.equal(st.fee.due,500000);
let p=hm.payFees(id,2026,3,'200,000'); assert.equal(p.balance,300000);
p=hm.payFees(id,2026,3,50000); assert.equal(p.paidTotal,250000); assert.equal(p.balance,250000);
hm.setType(id,'day'); st=hm.getState().students[0]; assert.equal(st.fee.due,300000); assert.equal(st.fee.balance,50000);
hm.setType(id,'boarding'); assert.equal(hm.getState().students[0].fee.balance,250000);
hm.setStudentStatus(id,'inactive','indiscipline'); hm.setStudentStatus(id,'active');
const w=hm.addStaff({first:'Moses',last:'K',title:'Teacher',salary:'300,000'});
hm.paySalary(w.id,'2026-10',200000); let sw=hm.getState({period:'2026-10'}).staff[0]; assert.equal(sw.period.balance,100000);
hm.setStaffStatus(w.id,'inactive'); assert.equal(hm.getState().staff.length,1);
// new term: arrears + new bill
hm.setCurrentTerm(2027,1); st=hm.getState().students[0]; assert.equal(st.fee.arrears,250000); assert.equal(st.fee.due,500000);
// marks
assert.equal(hm.acceptMarks([{id:'2026|3|BOT|'+id+'|Mathematics',year:2026,term:3,exam:'BOT',studentId:id,className:'P5',subject:'Mathematics',score:77,at:new Date().toISOString()}]),1);
assert.equal(hm.acceptMarks([{id:'x',studentId:id,score:500,at:'z'}]),0);
assert.equal(hm.teacherSnapshot(0).marks.length,1);
assert(!JSON.stringify(hm.teacherSnapshot(0)).includes('phone'));
hm.s.flush(); const hm2=new HM(new Store(path.join(dir,'db.json'),DEFAULTS)); assert.equal(Object.keys(hm2.d.payments).length,5);
console.log('core OK', Object.keys(hm.d.dirty).length,'dirty keys');
