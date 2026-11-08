import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const OUT = '/opt/cursor/artifacts/map-preview';
mkdirSync(OUT, {recursive: true});
const server = spawn('python3', ['preview/localhost-server.py', '--port', '8773'], {cwd: '/workspace', stdio: 'ignore'});
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=9246', '--user-data-dir=/tmp/chrome-yp-apply', 'about:blank',
], {stdio: 'ignore'});

async function browserWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const info = await (await fetch('http://127.0.0.1:9246/json/version')).json();
      if (info.webSocketDebuggerUrl) return info.webSocketDebuggerUrl;
    } catch {}
    await delay(250);
  }
  throw new Error('Chrome debugging port did not open');
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.errors = [];
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.method === 'Runtime.exceptionThrown') this.errors.push(msg.params?.exceptionDetails?.exception?.description || msg.params?.exceptionDetails?.text || 'exception');
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
async function evalJson(expression) {
  const result = await cdp.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 1000));
  return result.result.value;
}
async function shot(name) {
  const image = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
  writeFileSync(`${OUT}/${name}`, Buffer.from(image.data, 'base64'));
}

try {
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
  await cdp.send('Page.navigate', {url: 'http://127.0.0.1:8773/?fresh=1'}, sessionId);
  const ready = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof flowFinish==='function'&&typeof ypSubmitApply==='function')r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,100)};tick()})`);
  if (!ready) throw new Error('page did not boot');
  await evalJson(`(()=>{G.hwSeen=1;flowFinish({nick:'apply',band:7,view:'week',exp:{freq:'week',items:{},yearly:{}},start:'Glimmerbrook'});document.getElementById('st_rent').click();document.getElementById('st_go').click();document.getElementById('st_lease12').click();document.getElementById('st_go').click();return 1;})()`);
  const seeded = await evalJson(`(()=>{
    const place={label:'Test rental area',lon:152.5,lat:-24.82,stockKey:'Test rental area'};
    window.__ypListCentre=place;
    const store=ypEnsureSuburbStock(ypFreshStock(),place,[{lon:152.501,lat:-24.819},{lon:152.503,lat:-24.818}]);
    store.rentals[0].weeklyRent=500;store.rentals[0].bond=3000;
    store.rentals[1].weeklyRent=400;store.rentals[1].bond=2400;store.rentals[1].owner='player';
    ypWriteStock(store);
    return {id:store.rentals[0].id,ownerId:store.rentals[1].id,cash:G.cash,week:G.week|0,lease:!!G.lease};
  })()`);
  const owner = await evalJson(`(()=>{
    const before=G.cash;
    ypSubmitApply(${JSON.stringify(seeded.ownerId)});
    const pending=ypReadStock().rentals.find(r=>r.id===${JSON.stringify(seeded.ownerId)});
    const later=ypRefreshSample(ypReadStock(), Date.now()+120000);
    return {status:pending.status,owner:pending.owner,later:later.store.rentals.find(r=>r.id===${JSON.stringify(seeded.ownerId)}).status,cash:G.cash,before};
  })()`);
  await evalJson(`ypSubmitCancel(${JSON.stringify(seeded.ownerId)});1`);
  const cancelled = await evalJson(`(()=>{const r=ypReadStock().rentals.find(x=>x.id===${JSON.stringify(seeded.ownerId)});return {status:r.status,cash:G.cash};})()`);
  await evalJson(`ypSubmitApply(${JSON.stringify(seeded.id)});ypOpenRentalDetail(${JSON.stringify(seeded.id)});(()=>{const node=document.getElementById('coach');if(node)node.style.display='none';document.getElementById('toast')?.classList.remove('show');return 1})()`);
  const pending = await evalJson(`(()=>{const r=ypReadStock().rentals.find(x=>x.id===${JSON.stringify(seeded.id)});return {status:r.status,cash:G.cash,text:document.getElementById('yp-rent-detail')?.innerText||'',approveIn:r.approveAt-r.appliedAt};})()`);
  await shot('rental-apply-pending-phone.png');
  const waited = await evalJson(`new Promise(resolve=>{const t=Date.now();const tick=()=>{const r=ypSyncSample(Date.now()).rentals.find(x=>x.id===${JSON.stringify(seeded.id)});if(r.status==='approved')resolve({status:r.status,ms:Date.now()-t,cash:G.cash});else if(Date.now()-t>40000)resolve({status:r.status,ms:Date.now()-t,cash:G.cash});else setTimeout(tick,250)};tick()})`);
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 800, deviceScaleFactor: 1, mobile: false}, sessionId);
  await evalJson(`ypOpenRentalDetail(${JSON.stringify(seeded.id)});1`);
  const approvedOk = await evalJson(`(()=>{const t=document.getElementById('yp-rent-detail')?.innerText||'';return t.includes('Nothing has been charged')&&t.includes('Confirm and pay bond');})()`);
  await shot('rental-apply-approved-desktop.png');
  const short = await evalJson(`(()=>{const before=G.cash;G.cash=100;ypSubmitConfirm(${JSON.stringify(seeded.id)});const mid=G.cash;const r=ypReadStock().rentals.find(x=>x.id===${JSON.stringify(seeded.id)});const text=document.getElementById('yp-short')?.textContent||'';G.cash=before;if(typeof hud==='function')hud();return {status:r.status,mid,text,bondCharged:!!r.bondCharged};})()`);
  await evalJson(`ypSubmitConfirm(${JSON.stringify(seeded.id)});1`);
  const confirmed = await evalJson(`(()=>{const r=ypReadStock().rentals.find(x=>x.id===${JSON.stringify(seeded.id)});return {status:r.status,cash:G.cash,start:r.startWeek,last:r.lastChargedWeek,charged:!!r.bondCharged,lease:!!(G.lease&&G.lease.id),home:!!G.homeChosen};})()`);
  const second = await evalJson(`(()=>{const before=G.cash;ypSubmitConfirm(${JSON.stringify(seeded.id)});return {cash:G.cash,same:G.cash===before,status:ypReadStock().rentals.find(x=>x.id===${JSON.stringify(seeded.id)}).status};})()`);
  const weeks = await evalJson(`(()=>{const a=G.cash;weekTick();const b=G.cash;const w1=G.week|0;weekTick();const c=G.cash;const w2=G.week|0;ypSettleSampleWeek(0);const d=G.cash;return {a,b,c,d,w1,w2,rent:500};})()`);
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
  await evalJson(`ypOpenRentalDetail(${JSON.stringify(seeded.id)});1`);
  await shot('rental-apply-active-phone.png');
  const expired = await evalJson(`(()=>{
    const fake={version:1,rentals:[{id:'x',weeklyRent:500,status:'approved',owner:'game',approveAt:1,expiresAt:2,bondCharged:false}]};
    const result=ypConfirmSample(fake,'x',10,{incomeWk:1158,expenseWk:0,bank:30000},30000,0);
    return {ok:result.ok,reason:result.reason,cash:result.cash,live:G.cash};
  })()`);
  console.log(JSON.stringify({seeded, owner, cancelled, pending, waited, approvedOk, short, confirmed, second, weeks, expired, errors: cdp.errors.slice(0, 3)}, null, 2));
  const ok = seeded.cash === 30000 && seeded.week === 0 && seeded.lease === false
    && owner.status === 'application-pending' && owner.owner === 'player' && owner.later === 'application-pending' && owner.cash === owner.before
    && cancelled.status === 'available' && cancelled.cash === 30000
    && pending.status === 'application-pending' && pending.cash === 30000 && pending.approveIn === 30000 && pending.text.includes('Nothing is charged') && pending.text.includes('30 seconds')
    && waited.status === 'approved' && waited.ms >= 15000 && waited.ms < 40000 && waited.cash === 30000
    && approvedOk === true
    && short.status === 'approved' && short.mid === 100 && short.bondCharged === false && short.text.includes('Nothing was charged')
    && confirmed.status === 'active' && confirmed.cash === 27000 && confirmed.charged === true && confirmed.start === 0 && confirmed.last === 0 && confirmed.lease === false && confirmed.home === false
    && second.same && second.status === 'active'
    && weeks.w1 === 1 && weeks.w2 === 2 && weeks.a - weeks.b === 500 && weeks.b - weeks.c === 500 && weeks.d === weeks.c
    && expired.ok === false && expired.reason === 'expired' && expired.cash === 30000 && expired.live === weeks.d
    && cdp.errors.length === 0;
  if (!ok) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  chrome.kill('SIGTERM');
}
