import {spawn} from 'node:child_process';
import {writeFileSync, mkdirSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const OUT = '/opt/cursor/artifacts/map-preview';
mkdirSync(OUT, {recursive: true});
const server = spawn('python3', ['preview/localhost-server.py'], {cwd: '/workspace', stdio: 'ignore'});
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=9233', '--user-data-dir=/tmp/chrome-yp-map', 'about:blank',
], {stdio: 'ignore'});

async function browserWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const info = await (await fetch('http://127.0.0.1:9233/json/version')).json();
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
await cdp.send('Network.enable', {}, sessionId);
const urls = [];
ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.method === 'Network.requestWillBeSent' && msg.sessionId === sessionId) urls.push(msg.params.request.url);
});
await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
await cdp.send('Page.navigate', {url: 'http://127.0.0.1:8765/'}, sessionId);
const ready = await cdp.send('Runtime.evaluate', {
  expression: `new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof hwChoose==='function'&&document.getElementById('flow'))r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,100)};tick()})`,
  awaitPromise: true,
}, sessionId);
if (!ready.result.value) throw new Error('Welcome flow did not appear');
await cdp.send('Runtime.evaluate', {expression: `document.getElementById('flow').style.display='none';hwChoose('rent');`, returnByValue: true}, sessionId);
await delay(200);
const rent = await cdp.send('Runtime.evaluate', {
  expression: `(()=>{const o=document.getElementById('hwov');return {text:o.innerText.replace(/\\s+/g,' ').trim(),hasClock:o.innerText.includes('game clock')}})()`,
  returnByValue: true,
}, sessionId);
const rentShot = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
writeFileSync(`${OUT}/rent-popup-unchanged.png`, Buffer.from(rentShot.data, 'base64'));
const finance = await cdp.send('Runtime.evaluate', {
  expression: `(()=>{let h=Infinity,hid=null,a=null;GEN.c1.lots.forEach(l=>{if(l.type==='house'){const v=value(l.id);if(v<h){h=v;hid=l.id;a=l.a;}}});const q=quote(h,.95,null,hid);return {price:h,area:a,ins:q.ins,cash:q.cash,still:Math.max(0,q.cash-30000)};})()`,
  returnByValue: true,
}, sessionId);
await cdp.send('Runtime.evaluate', {expression: `document.getElementById('hwov').remove();startView();`, returnByValue: true}, sessionId);
const mapReady = await cdp.send('Runtime.evaluate', {
  expression: `new Promise(r=>{const t=Date.now();const tick=()=>{const s=document.getElementById('yp-map-status');if(s&&s.textContent.includes('Map key missing'))r(s.textContent);else if(Date.now()-t>8000)r('');else setTimeout(tick,100)};tick()})`,
  awaitPromise: true,
}, sessionId);
await delay(250);
const mapShot = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
writeFileSync(`${OUT}/map-missing-key.png`, Buffer.from(mapShot.data, 'base64'));
const state = await cdp.send('Runtime.evaluate', {
  expression: `(()=>{const keys=[];for(let i=0;i<localStorage.length;i++)keys.push(localStorage.key(i));return {basemap:document.body.classList.contains('ypbasemap'),canvasHidden:getComputedStyle(document.getElementById('w3dc')).visibility,stored:keys.filter(k=>k.startsWith('yp.')||k.startsWith('fe.')),foot:document.getElementById('yp-foot')?.textContent||''};})()`,
  returnByValue: true,
}, sessionId);
const providerHits = urls.filter(url => /geoapify|maptiler|apiKey=/i.test(url));
const report = {ready: ready.result.value, rent: rent.result.value, finance: finance.result.value, mapStatus: mapReady.result.value, state: state.result.value, providerHits};
writeFileSync(`${OUT}/browser-smoke.json`, JSON.stringify(report, null, 2));
const financeOk = finance.result.value.price === 505000 && finance.result.value.area === 160 && finance.result.value.ins === 2000 && finance.result.value.cash === 62642 && finance.result.value.still === 32642;
const rentOk = rent.result.value.text === 'Choose your Rental If you apply for a property owned by another player, they decide if you’re successful or not. Got it' && !rent.result.value.hasClock;
const mapOk = String(mapReady.result.value).includes('no buildings were invented');
const quietOk = providerHits.length === 0 && !state.result.value.stored.includes('yp.mapsel.v1');
report.checks = {rentOk, financeOk, mapOk, quietOk};
console.log(JSON.stringify(report.checks));
server.kill('SIGTERM');
chrome.kill('SIGTERM');
process.exit(rentOk && financeOk && mapOk && quietOk ? 0 : 1);
