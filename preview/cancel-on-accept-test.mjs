// Accepting one rental application cancels the player's other pending applications.
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'preview-406b69525cf5');
const outDir = process.env.YP_SHOT_DIR || '/opt/cursor/artifacts';
const port = 8833;
const debugPort = 9298;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: root, stdio: 'ignore'});
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', `--remote-debugging-port=${debugPort}`, '--user-data-dir=/tmp/chrome-yp-cancel', 'about:blank'], {stdio: 'ignore'});

async function browserWs(){
  for (let i = 0; i < 40; i++) {
    try {
      const info = await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json();
      if (info.webSocketDebuggerUrl) return info.webSocketDebuggerUrl;
    } catch {}
    await delay(250);
  }
  throw new Error('Chrome did not start');
}
class CDP {
  constructor(ws){ this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const pending = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? pending.reject(new Error(JSON.stringify(msg.error))) : pending.resolve(msg.result);
      }
    });
  }
  send(method, params = {}, sessionId){
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {resolve, reject});
      const payload = {id, method, params};
      if (sessionId) payload.sessionId = sessionId;
      this.ws.send(JSON.stringify(payload));
    });
  }
}
const ws = new WebSocket(await browserWs());
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
const cdp = new CDP(ws);
const {targetId} = await cdp.send('Target.createTarget', {url: 'about:blank'});
const {sessionId} = await cdp.send('Target.attachToTarget', {targetId, flatten: true});
await cdp.send('Page.enable', {}, sessionId);
await cdp.send('Runtime.enable', {}, sessionId);
async function evalJson(expression){
  const result = await cdp.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 1800));
  return result.result.value;
}
async function shot(name){
  const image = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
  writeFileSync(path.join(outDir, name), Buffer.from(image.data, 'base64'));
}
await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
await cdp.send('Page.navigate', {url: `http://127.0.0.1:${port}/`}, sessionId);
await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof ypSubmitApply==='function'&&typeof ypSyncSample==='function')r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,80)};tick()})`);

const before = await evalJson(`(()=>{
  document.getElementById('flow')?.remove();
  window.advance=()=>0; window.toast=()=>{};
  localStorage.removeItem('yp.previewStock.v1');
  localStorage.removeItem('yp.propertyHistory.v1');
  const place={label:'Cancel test',lon:152.5,lat:-24.82,stockKey:'cancel-test'};
  const store=ypEnsureSuburbStock(ypFreshStock(),place,[{lon:152.501,lat:-24.819},{lon:152.505,lat:-24.816},{lon:152.509,lat:-24.813}]);
  store.rentals.slice(0,3).forEach(r=>{r.status='available';r.owner='game';r.weeklyRent=400;r.bond=2400;});
  ypWriteStock(store);
  G.clockOn=1; G.week=4; G.acc=0; G.started=1; G.homeChosen=1;
  const ids=store.rentals.slice(0,3).map(r=>r.id);
  const cash0=G.cash;
  ids.forEach(id=>ypSubmitApply(id));
  const hour=CFG.weekMs/168;
  const saved=ypReadStock();
  const now=ypGameMs(ypReadClock());
  saved.rentals.forEach(r=>{const i=ids.indexOf(r.id);if(i<0)return;r.approveGameMs=i===0?now:now+hour*20;});
  ypWriteStock(saved);
  ypSyncSample(ypReadClock());
  const rows=ids.map(id=>ypReadStock().rentals.find(r=>r.id===id));
  G.acc+=hour*40;
  ypSyncSample(ypReadClock());
  const later=ids.map(id=>ypReadStock().rentals.find(r=>r.id===id).status);
  const events=ypReadHistory().events.filter(e=>ids.includes(e.propertyId));
  return {
    cash0, cash:G.cash,
    status:rows.map(r=>r.status),
    later,
    held:rows.slice(1).every(r=>!r.bondCharged&&!r.bondPaid),
    cancelled:events.filter(e=>e.kind==='cancelled').map(e=>({id:e.propertyId,text:e.text,reason:e.reason,when:ypGameClockLabel(e.gameMs)})),
    accepted:events.filter(e=>e.kind==='accepted').length
  };
})()`);

await evalJson(`(()=>{document.getElementById('yp-rent-detail')?.remove();document.getElementById('yp-history')?.remove();ypOpenPropertyHistory();return 1;})()`);
await evalJson(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
await shot('cancelled-history-list-390x844.png');
const list = await evalJson(`(()=>{
  const rows=[...document.querySelectorAll('#yp-history .yp-rent-row .yp-row-title')].map(el=>el.textContent.trim());
  const head=document.querySelector('#yp-history .yp-card-head h2')?.textContent||'';
  return {rows, head, dialogs:ypOpenDialogs()};
})()`);
await evalJson(`(()=>{const row=[...document.querySelectorAll('#yp-history .yp-rent-row')].find(el=>el.querySelector('.yp-row-title').textContent.trim()==='Cancelled');row.click();return 1;})()`);
await evalJson(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
await shot('cancelled-history-entry-390x844.png');
const card = await evalJson(`(()=>{
  const detail=[...document.querySelectorAll('#yp-history-detail .yp-flow div')].map(el=>({label:el.querySelector('dt').childNodes[0].textContent.trim(),value:el.querySelector('dd').textContent.trim()}));
  return {
    title:document.querySelector('#yp-history-detail .yp-card-head h2')?.textContent||'',
    kicker:document.querySelector('#yp-history-detail .yp-kicker')?.textContent||'',
    detail,
    dialogs:ypOpenDialogs(),
    listOpen:!!document.getElementById('yp-history')
  };
})()`);

await cdp.send('Page.reload', {ignoreCache: true}, sessionId);
await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof ypReadStock==='function'&&typeof ypReadHistory==='function')r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,80)};tick()})`);
const reloaded = await evalJson(`(()=>{
  const stock=ypReadStock().rentals.filter(r=>String(r.id).includes('cancel-test')||r.suburbKey==='cancel-test'||r.placeLabel==='Cancel test');
  const events=ypReadHistory().events;
  return {
    status:stock.map(r=>r.status),
    cancelled:events.filter(e=>e.kind==='cancelled').map(e=>e.reason),
    accepted:events.filter(e=>e.kind==='accepted').length
  };
})()`);

const problems = [];
if (before.cash !== before.cash0) problems.push('cash moved '+before.cash0+' -> '+before.cash);
if (before.status.join(',') !== 'approved,cancelled,cancelled') problems.push('status '+before.status.join(','));
if (before.later.join(',') !== 'approved,cancelled,cancelled') problems.push('later '+before.later.join(','));
if (!before.held) problems.push('held amount left on a cancelled application');
if (before.accepted !== 1 || before.cancelled.length !== 2) problems.push('events '+JSON.stringify(before));
if (!before.cancelled.every(e => e.text === 'Cancelled' && e.reason === 'Another application was accepted' && e.when)) problems.push('cancelled copy '+JSON.stringify(before.cancelled));
if (!(list.rows.includes('Accepted') && list.rows.includes('Cancelled') && list.head === 'Property History' && list.dialogs.length === 1)) problems.push('list '+JSON.stringify(list));
const status = card.detail.find(row => row.label === 'Status');
const reason = card.detail.find(row => row.label === 'Reason');
if (!(card.title === 'Cancelled' && card.kicker && status && status.value === 'Cancelled' && reason && reason.value === 'Another application was accepted' && card.dialogs.length === 1 && !card.listOpen)) problems.push('card '+JSON.stringify(card));
if (reloaded.status.join(',') !== 'approved,cancelled,cancelled' || reloaded.accepted !== 1 || reloaded.cancelled.length !== 2) problems.push('reload '+JSON.stringify(reloaded));
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else console.log('PASS cancel on accept', {status: before.status.join(','), kept: before.cash});

server.kill('SIGTERM');
chrome.kill('SIGTERM');
setTimeout(() => process.exit(process.exitCode || 0), 200);
