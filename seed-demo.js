// builds a demo data folder: node seed-demo.js <dir>
const fs=require('fs'),path=require('path');const dir=process.argv[2];fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'config.json'),JSON.stringify({mode:'hm'}));
const {Store}=require('./src/core/store'),{HM,DEFAULTS}=require('./src/core/hm');
const hm=new HM(new Store(path.join(dir,'hm-data.json'),DEFAULTS));hm.setPassword('1234');hm.setCurrentTerm(2026,3);
const names=[['Nakato','Grace','P5','day'],['Ssemanda','Brian','P2','boarding'],['Namukasa','Esther','Top Class','day'],['Kato','David','P7','boarding'],['Nambi','Faith','P3','day'],['Okello','Joel','P6','day']];
for(const [l,f,c,t] of names){const r=hm.addApplication({first:f,last:l,className:c,type:t,parent:'Mr/Mrs '+l,phone:'0772 000 000',paidNow:'30,000'});}
hm.addApplication({first:'Irene',last:'Nansubuga',className:'P1',type:'day',parent:'Mrs Nansubuga',phone:'0701 111 222',paidNow:'10,000'});
const ids=Object.keys(hm.d.students);hm.payFees(ids[0],2026,3,'200,000');hm.payFees(ids[1],2026,3,'500,000');hm.payFees(ids[3],2026,3,'120,000');
const w=hm.addStaff({first:'Moses',last:'Kizito',title:'Director of Studies',salary:'300,000',phone:'0772 123 456'});hm.addStaff({first:'Sarah',last:'Babirye',title:'Cook',salary:'150,000'});
hm.paySalary(w.id,'2026-10','200,000');hm.s.save(true);console.log('seeded',ids.length);
