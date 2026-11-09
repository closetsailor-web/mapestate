// After a 3-month lease choice, onboarding continues to the town search and the map, not Home.
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'preview-406b69525cf5');
const outDir = process.env.YP_SHOT_DIR || '/opt/cursor/artifacts';
const port = 8846;
const debugPort = 9319;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: root, stdio: 'ignore'});
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', `--remote-debugging-port=${debugPort}`, '--user-data-dir=/tmp/chrome-yp-onboard', 'about:blank'], {stdio: 'ignore'});
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
  await evalJson(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  const image = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
  writeFileSync(path.join(outDir, name), Buffer.from(image.data, 'base64'));
}
async function waitFor(expression, ms = 15000){
  return evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{let ok=false;try{ok=!!(${expression})}catch(e){}if(ok)r(1);else if(Date.now()-t>${ms})r(0);else setTimeout(tick,80)};tick()})`);
}
await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
await cdp.send('Page.navigate', {url: `http://127.0.0.1:${port}/`}, sessionId);
if (!await waitFor(`document.getElementById('flowframe')&&document.getElementById('flowframe').contentDocument&&document.getElementById('flowframe').contentDocument.getElementById('s-landing')`)) throw new Error('welcome did not open');
await evalJson(`(()=>{const d=document.getElementById('flowframe').contentDocument;d.querySelector('[data-go="signup"]').click();return 1;})()`);
if (!await waitFor(`document.getElementById('flowframe').contentDocument.getElementById('s-signup').classList.contains('on')`)) throw new Error('signup did not open');
await evalJson(`(()=>{const d=document.getElementById('flowframe').contentDocument;d.getElementById('su-name').value='player1';d.getElementById('su-email').value='player1@example.com';d.getElementById('su-pw').value='plot-pass';d.getElementById('su-year').value='1990';d.getElementById('su-terms').checked=true;d.getElementById('f-signup').requestSubmit();return 1;})()`);
if (!await waitFor(`document.getElementById('flowframe').contentDocument.getElementById('s-income').classList.contains('on')`, 8000)) throw new Error('income did not open');
await shot('onboard-after-account-390x844.png');
await evalJson(`(()=>{const d=document.getElementById('flowframe').contentDocument;const band=d.getElementById('band');band.value='2';band.dispatchEvent(new Event('change',{bubbles:true}));d.getElementById('inc-go').click();return d.getElementById('s-expenses').classList.contains('on');})()`);
await shot('onboard-after-income-390x844.png');
await evalJson(`(()=>{const d=document.getElementById('flowframe').contentDocument;d.getElementById('f-exp').requestSubmit();return d.getElementById('s-summary').classList.contains('on');})()`);
await shot('onboard-after-expenses-390x844.png');
await evalJson(`(()=>{const d=document.getElementById('flowframe').contentDocument;d.getElementById('sum-go').click();return d.getElementById('s-done').classList.contains('on');})()`);
await shot('onboard-after-summary-390x844.png');
await evalJson(`(()=>{document.getElementById('flowframe').contentDocument.getElementById('enter').click();return 1;})()`);
if (!await waitFor(`document.getElementById('st_rent')`)) throw new Error('rental start did not open');
await evalJson(`(()=>{for(let i=0;i<6&&document.getElementById('hwov');i++){const b=document.getElementById('hw_next')||document.querySelector('#hwov .hwx');if(b)b.click();}document.getElementById('st_rent').click();document.getElementById('st_go').click();return document.getElementById('st_lease3')?1:0;})()`);
await shot('onboard-after-rent-continue-390x844.png');
const lease = await evalJson(`(()=>({heading:document.querySelector('#status h2')&&document.querySelector('#status h2').textContent,sub:document.querySelector('#status .sub')&&document.querySelector('#status .sub').textContent,home:document.documentElement.classList.contains('yp-home')}))()`);
await evalJson(`(()=>{document.getElementById('st_lease3').click();document.getElementById('st_go').click();return 1;})()`);
if (!await waitFor(`document.getElementById('yp-where')&&document.documentElement.classList.contains('yp-map-on')&&!document.documentElement.classList.contains('yp-home')`)) throw new Error('location search did not replace Home');
await shot('onboard-after-lease-continue-390x844.png');
const located = await evalJson(`(()=>({where:document.getElementById('yp-where-title').textContent,lease:G.statusLease,pick:G.statusPick,home:document.documentElement.classList.contains('yp-home'),map:document.documentElement.classList.contains('yp-map-on'),status:!!document.getElementById('status')}))()`);
await evalJson(`(()=>{ypChooseTown({label:'Bargara',name:'Bargara',lon:152.45,lat:-24.82});return 1;})()`);
if (!await waitFor(`!document.getElementById('yp-where')&&document.documentElement.classList.contains('yp-map-on')`)) throw new Error('map did not stay open after the town');
await shot('onboard-after-town-390x844.png');
const applied = await evalJson(`(()=>{
  const place=window.__ypListCentre;
  const store=ypEnsureSuburbStock(ypReadStock(),place,[{lon:place.lon+0.001,lat:place.lat+0.001}]);
  ypWriteStock(store);
  const rental=store.rentals.find(r=>r.status==='available');
  ypOpenRentalDetail(rental.id);
  return {id:rental.id,title:document.getElementById('yp-listing-title')&&document.getElementById('yp-listing-title').textContent,apply:!!document.getElementById('yp-rent-apply')};
})()`);
await shot('onboard-rental-card-390x844.png');
await evalJson(`document.getElementById('yp-rent-apply').click();1`);
if (!await waitFor(`document.getElementById('yp-review-confirm')`)) throw new Error('application review did not open');
await shot('onboard-application-390x844.png');
await evalJson(`document.getElementById('yp-review-confirm').click();1`);
if (!await waitFor(`document.getElementById('yp-history')`)) throw new Error('history did not open after apply');
await shot('onboard-after-apply-390x844.png');
const done = await evalJson(`(()=>{const row=document.querySelector('#yp-history .yp-rent-row');return {text:row&&row.textContent,cash:G.cash,home:document.documentElement.classList.contains('yp-home'),where:!!document.getElementById('yp-where')};})()`);
const problems=[];
if (!(lease.heading==='Pick a lease length'&&lease.sub==="You'll choose the house next.")) problems.push('lease screen '+JSON.stringify(lease));
if (!(located.where==='Choose location'&&located.lease===3&&located.pick==='rent'&&located.map&&!located.home&&!located.status)) problems.push('location '+JSON.stringify(located));
if (!(applied.apply&&applied.id)) problems.push('rental '+JSON.stringify(applied));
if (!(done.text&&done.text.includes('Applied')&&!done.where)) problems.push('applied '+JSON.stringify(done));
if (problems.length){console.error(problems.join('\n'));process.exitCode=1;}
else console.log('PASS rental onboarding', {lease:located.lease, where:located.where, applied:done.text});
server.kill('SIGTERM');
chrome.kill('SIGTERM');
setTimeout(()=>process.exit(process.exitCode||0),200);
