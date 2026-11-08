import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const OUT = '/opt/cursor/artifacts/map-preview';
mkdirSync(OUT, {recursive: true});
const PORT = 8766;
const server = spawn('python3', ['preview/localhost-server.py', '--port', String(PORT)], {cwd: '/workspace', stdio: 'ignore'});
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=9240', '--user-data-dir=/tmp/chrome-yp-fresh', 'about:blank',
], {stdio: 'ignore'});
const SEED = JSON.stringify({started: true, username: 'TroySaved', cash: 424242, week: 7, schema: 7, homeChosen: 0, clockOn: 0, cur: 'c1', visited: ['c1'], hist: [], notifs: [], offers: []});
const STOCK = JSON.stringify({version: 1, rentals: [{id: 'keep-me', suburbKey: 'saved', placeLabel: 'Saved place', lon: 152, lat: -27, n: 1, status: 'available'}]});
const CENTRE = JSON.stringify({place: {label: 'Saved place', lon: 152, lat: -27}, centre: {label: 'Saved place', lon: 152, lat: -27}});

async function browserWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const info = await (await fetch('http://127.0.0.1:9240/json/version')).json();
      if (info.webSocketDebuggerUrl) return info.webSocketDebuggerUrl;
    } catch {}
    await delay(250);
  }
  throw new Error('Chrome debugging port did not open');
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const pending = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? pending.reject(new Error(JSON.stringify(msg.error))) : pending.resolve(msg.result);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = {id, method, params};
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, {resolve, reject});
      this.ws.send(JSON.stringify(payload));
    });
  }
}
const ws = new WebSocket(await browserWs());
await new Promise((resolve, reject) => {ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
const cdp = new CDP(ws);
const {targetId} = await cdp.send('Target.createTarget', {url: 'about:blank'});
const {sessionId} = await cdp.send('Target.attachToTarget', {targetId, flatten: true});
await cdp.send('Page.enable', {}, sessionId);
await cdp.send('Runtime.enable', {}, sessionId);
const seedSource = `if(!sessionStorage.getItem('yp-seeded')){localStorage.setItem('fe.global',${JSON.stringify(SEED)});localStorage.setItem('yp.previewStock.v1',${JSON.stringify(STOCK)});localStorage.setItem('yp.listCentre.v1',${JSON.stringify(CENTRE)});sessionStorage.setItem('yp-seeded','1');}`;
await cdp.send('Page.addScriptToEvaluateOnNewDocument', {source: seedSource}, sessionId);
async function evalJson(expression) {
  const result = await cdp.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 700));
  return result.result.value;
}
async function shot(name) {
  const image = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
  writeFileSync(`${OUT}/${name}`, Buffer.from(image.data, 'base64'));
}
async function openFresh() {
  await cdp.send('Page.navigate', {url: `http://127.0.0.1:${PORT}/?fresh=1`}, sessionId);
  return evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(document.getElementById('flowframe')&&document.getElementById('yp-fresh-note'))r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,100)};tick()})`);
}
function saved() {
  return evalJson(`(()=>{const read=window.__ypReadReal||((k)=>localStorage.getItem(k));return {fresh:window.__ypFreshTest||0,flow:!!document.getElementById('flowframe'),note:(document.getElementById('yp-fresh-note')||{}).textContent||'',seen:localStorage.getItem('fe.global'),real:read('fe.global'),stock:read('yp.previewStock.v1'),centre:read('yp.listCentre.v1'),testBuild:read('ypfresh.mt.build')};})()`);
}

try {
  const first = await openFresh();
  await delay(300);
  await shot('fresh-onboarding-mobile.png');
  const isolated = await saved();
  await cdp.send('Page.reload', {ignoreCache: true}, sessionId);
  const reloadedReady = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{const root=document.documentElement;if(root&&document.getElementById('flowframe')&&document.getElementById('yp-fresh-note'))r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,120)};tick()})`);
  const reloaded = await saved();
  await cdp.send('Page.navigate', {url: `http://127.0.0.1:${PORT}/`}, sessionId);
  const resumed = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{const fe=localStorage.getItem('fe.global');if(fe&&fe.includes('TroySaved')&&document.getElementById('coins'))r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,100)};tick()})`);
  await delay(400);
  const normal = await evalJson(`(()=>{const fe=JSON.parse(localStorage.getItem('fe.global')||'null');const stock=localStorage.getItem('yp.previewStock.v1')||'';return {fresh:window.__ypFreshTest||0,flow:!!document.getElementById('flowframe'),user:fe&&fe.username,cash:fe&&fe.cash,started:!!(fe&&fe.started),stock:stock.includes('keep-me'),centre:(localStorage.getItem('yp.listCentre.v1')||'').includes('Saved place'),note:!!document.getElementById('yp-fresh-note')};})()`);
  await shot('fresh-normal-save-still-there.png');
  const report = {first, isolated, reloadedReady, reloaded, resumed, normal};
  writeFileSync(`${OUT}/fresh-start.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  const freshSave = value => !!value && !value.includes('TroySaved') && value.includes('"cash":30000');
  const ok = first === 1 && isolated.fresh === 1 && isolated.flow && isolated.note.includes('Test start') && freshSave(isolated.seen) && isolated.real === SEED && isolated.stock === STOCK && isolated.centre === CENTRE
    && reloadedReady === 1 && reloaded.fresh === 1 && reloaded.flow && freshSave(reloaded.seen) && reloaded.real === SEED && reloaded.stock === STOCK && reloaded.centre === CENTRE
    && resumed === 1 && normal.fresh === 0 && normal.flow === false && normal.user === 'TroySaved' && normal.cash === 424242 && normal.started && normal.stock && normal.centre && normal.note === false;
  if (!ok) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  chrome.kill('SIGTERM');
}
