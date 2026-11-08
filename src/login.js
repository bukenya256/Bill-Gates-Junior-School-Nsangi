'use strict';
// The one start screen. Headteacher and Teachers use the same computer and the same school records;
// the person chooses who they are here, and only that person's screens open.
const box = document.getElementById('box');
const api = (a, args) => window.bgs.call(a, args);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const logo = '<div class="logo"><img src="assets/bgs-icon.png" alt="" style="width:75px;height:75px;object-fit:contain"></div><h1>Bill Gates Junior School Nsangi</h1>';
const go = role => { location.replace(role === 'hm' ? 'hm/index.html' : 'teacher/index.html'); };

async function chooser() {
  const st = await api('auth.status');
  if (st.role) return go(st.role);
  box.innerHTML = `${logo}<p class="muted">Who is using the computer?</p>
    <div class="choices">
      <button class="choice" data-r="hm"><b>Headteacher</b><span>Students, fees, receipts, staff and salaries, discipline, classes, new year, reports and settings.</span></button>
      <button class="choice" data-r="teacher"><b>Teachers</b><span>Enter marks, print report cards and class results, see class lists, and decide Promoted / Repeat in Term 3.</span></button>
    </div><p class="err" id="err"></p>`;
  box.querySelectorAll('.choice').forEach(b => b.onclick = () => form(b.dataset.r, st));
}

function form(role, st) {
  const hm = role === 'hm', has = hm ? st.hm.hasPassword : st.teacher.hasPassword;
  box.innerHTML = `${logo}<form id="f" style="max-width:340px;margin:0 auto">
    <h2 style="margin:6px 0">${hm ? 'Headteacher' : 'Teachers'}</h2>
    <p class="muted">${has ? 'Enter the password.' : (hm ? 'First time: create the Headteacher password.' : 'First time: create a password for the Teachers (at least 8 characters). Share it only with the teachers.')}</p>
    ${hm ? '' : `<input id="nm" placeholder="Your name (saved with the marks you enter)" value="${esc(st.teacher.lastName)}" autocomplete="off" maxlength="60">`}
    <input type="password" id="pw" placeholder="${has ? 'Password' : 'Choose a password'}" autocomplete="off">
    ${has ? '' : '<input type="password" id="pw2" placeholder="Repeat password" autocomplete="off">'}
    <button class="pri" type="submit">${has ? 'Log in' : 'Create password & start'}</button>
    <button type="button" id="back" style="margin-top:8px">← Back</button><p class="err" id="err"></p></form>`;
  document.getElementById(hm ? 'pw' : 'nm').focus();
  document.getElementById('back').onclick = chooser;
  document.getElementById('f').onsubmit = async e => {
    e.preventDefault(); const err = document.getElementById('err'); err.textContent = '';
    try {
      const pw = document.getElementById('pw').value, name = hm ? '' : document.getElementById('nm').value;
      if (!has && pw !== document.getElementById('pw2').value) throw new Error('The two passwords do not match.');
      await api(has ? 'auth.login' : 'auth.setup', { role, pw, name });
      go(role);
    } catch (x) { err.textContent = x.message; }
  };
}
chooser().catch(e => { box.innerHTML = '<p class="err">' + esc(e.message) + '</p>'; });
