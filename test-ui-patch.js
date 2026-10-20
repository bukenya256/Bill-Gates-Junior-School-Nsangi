const fs=require('fs'), assert=require('assert');
const hm=fs.readFileSync('src/hm/hm.js','utf8'),teacher=fs.readFileSync('src/teacher/teacher.js','utf8');
assert(hm.includes('id="addSubject"')&&hm.includes('data-del-sub'));
assert(hm.includes('id="notifSearch"')&&hm.includes('data-notif-student'));
assert(teacher.includes('reconnects automatically'));
console.log('UI patch structure OK');
