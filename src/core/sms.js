'use strict';

const LIVE = 'https://api.africastalking.com/version1/messaging';
const SANDBOX = 'https://api.sandbox.africastalking.com/version1/messaging';

function normalizePhone(raw) {
  for (const part of String(raw || '').split(/[\/,;]|\band\b/i)) {
    let d = part.replace(/[^\d+]/g, '');
    if (d.startsWith('+')) d = d.slice(1);
    if (d.startsWith('00')) d = d.slice(2);
    if (/^256\d{9}$/.test(d)) return '+' + d;
    if (/^0\d{9}$/.test(d)) return '+256' + d.slice(1);
    if (/^[37]\d{8}$/.test(d)) return '+256' + d;
  }
  return null;
}

function fillTemplate(text, v) {
  return String(text).replace(/\{(parent|student|class|balance)\}/gi, (_, k) => String(v[k.toLowerCase()] ?? ''));
}

function segments(text) {
  const n = String(text).length;
  return n <= 160 ? 1 : Math.ceil(n / 153);
}

async function sendBatch({ username, key, senderId, endpoint }, to, message) {
  const url = endpoint || (String(username).toLowerCase() === 'sandbox' ? SANDBOX : LIVE);
  const form = new URLSearchParams({ username, to: to.join(','), message });
  if (senderId) form.set('from', senderId);
  let r;
  try {
    r = await fetch(url, { method: 'POST', headers: { apiKey: key, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: form, signal: AbortSignal.timeout(20000) });
  } catch (e) {
    throw new Error('Could not reach the SMS company. Check that this PC has internet.');
  }
  if (r.status === 401) throw new Error('The SMS company rejected the username or API key.');
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch (e) { throw new Error('The SMS company sent an unexpected answer (' + r.status + ').'); }
  const rec = j && j.SMSMessageData && j.SMSMessageData.Recipients;
  if (!Array.isArray(rec)) throw new Error((j && j.SMSMessageData && j.SMSMessageData.Message) || 'The SMS company did not accept the message.');
  return rec.map(x => ({ phone: x.number, ok: [100, 101, 102].includes(Number(x.statusCode)), status: x.status || '', cost: x.cost || '' }));
}

module.exports = { normalizePhone, fillTemplate, segments, sendBatch };
