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
  const report = await evalJson(`(()=>{
    const place={label:'Test rental area',lon:152.5,lat:-24.82,stockKey:'Test rental area'};
    const elsewhere={label:'Other search',lon:140,lat:-30,stockKey:'Other search'};
    window.__ypListCentre=place;
    const store=ypEnsureSuburbStock(ypFreshStock(),place,[{lon:152.501,lat:-24.819},{lon:152.505,lat:-24.816}]);
    store.rentals[0].weeklyRent=500;store.rentals[0].bond=3000;
    store.rentals[1].weeklyRent=420;store.rentals[1].bond=2520;
    ypWriteStock(store);
    const sale=[{id:'sale-keep',kind:'sale'}];
    window.__saleOffers=sale;
    const ids=store.rentals.map(r=>r.id);
    const cash0=G.cash;
    G.clockOn=0;G.homeChosen=0;G.started=1;G.week=0;G.acc=0;
    ypSubmitApply(ids[0]);
    ypSubmitApply(ids[1]);
    const both=ypReadStock().rentals.filter(r=>r.status==='application-pending').map(r=>r.id);
    const dup=ypApplySample(ypReadStock(),ids[0],ypReadClock());
    advance(20000);
    const paused={acc:G.acc|0,status:ypReadStock().rentals[0].status,cash:G.cash};
    const hour=CFG.weekMs/168;
    G.clockOn=1;
    advance(Math.floor(hour)-1);
    const beforeHour={acc:Math.round(G.acc),status:ypSyncSample(ypReadClock()).rentals.map(r=>r.status),cash:G.cash};
    advance(5);
    ypSyncSample(ypReadClock());
    const afterHour={status:ypReadStock().rentals.map(r=>r.status),cash:G.cash,notices:(G.notifs||[]).filter(n=>n.ypRental).map(n=>({id:n.ypRental,read:!!n.read,msg:n.msg})),badge:document.getElementById('badge')?.textContent||''};
    window.__ypListCentre=elsewhere;
    document.getElementById('yp-rent-detail')?.remove();
    document.getElementById('minebtn').click();
    const menu=[...document.querySelectorAll('#yp-property-menu button')].map(b=>b.textContent);
    const offersBtn=document.getElementById('yp-pending-offers');
    if(!offersBtn)return {wrapped,menu,error:'no-offers',cash0};
    offersBtn.click();
    const offers=[...document.querySelectorAll('#yp-pending .yp-rent-row')].map(b=>b.innerText.replace(/\\s+/g,' ').trim());
    const beforeFail=JSON.stringify(ypReadStock().rentals.map(r=>r.status));
    G.cash=100;
    ypSubmitConfirm(ids[0]);
    const failed={cash:G.cash,status:ypReadStock().rentals.map(r=>r.status),same:JSON.stringify(ypReadStock().rentals.map(r=>r.status))===beforeFail,text:document.getElementById('yp-short')?.textContent||''};
    G.cash=cash0;
    const histBefore=ypReadHistory().events.length;
    ypSubmitConfirm(ids[0]);
    const again=G.cash;
    ypSubmitConfirm(ids[0]);
    const confirmed={cash:G.cash,again,status:ypReadStock().rentals.map(r=>r.status),active:ypReadStock().rentals.filter(r=>r.status==='active').length,sale:JSON.stringify(window.__saleOffers)};
    const keys=ypReadHistory().events.map(e=>e.key);
    const detail=(()=>{ypOpenRentalDetail(ids[1]);return [...document.querySelectorAll('#yp-property-history p')].map(p=>p.dataset.key).filter(Boolean);})();
    document.getElementById('yp-rent-detail')?.remove();
    ypOpenPropertyHistory();
    const history=[...document.querySelectorAll('#yp-history .yp-rent-row')].map(b=>b.dataset.key);
    const dupHist=ypMergeHistory(ypReadHistory(),ypReadHistory().events).events.length;
    ypSyncSample(ypReadClock());
    const reloaded=ypReadHistory().events.map(e=>e.key).join('|');
    return {ids,both,dup:dup.reason,paused,beforeHour,afterHour,offers,menu,failed,confirmed,keys,detail,history,dupHist,histBefore,hour,cash0,reloaded};
  })()`);
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
  await evalJson(`document.getElementById('yp-where')?.remove();document.getElementById('yp-history')?.remove();document.getElementById('yp-rent-detail')?.remove();ypOpenPendingOffers();(()=>{const node=document.getElementById('coach');if(node)node.style.display='none';return 1})()`);
  await shot('pending-offers-phone.png');
  await evalJson(`document.getElementById('yp-pending')?.remove();ypOpenPropertyHistory();1`);
  await shot('property-history-phone.png');
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 800, deviceScaleFactor: 1, mobile: false}, sessionId);
  await evalJson(`document.getElementById('yp-history')?.remove();ypOpenPropertyOptions();1`);
  await shot('property-menu-desktop.png');
  console.log(JSON.stringify({report, errors: cdp.errors.slice(0, 3)}, null, 2));
  const keys = report.keys.join('|');
  const ok = report.both.length === 2 && report.dup === 'already'
    && report.paused.acc === 0 && report.paused.status === 'application-pending' && report.paused.cash === report.cash0
    && report.beforeHour.status.every(s => s === 'application-pending') && report.beforeHour.cash === report.cash0
    && report.afterHour.status.every(s => s === 'approved') && report.afterHour.cash === report.cash0
    && report.afterHour.notices.length === 2 && report.afterHour.badge !== ''
    && report.menu.indexOf('Pending Offers') >= 0 && report.menu.indexOf('Property History') === report.menu.indexOf('Pending Offers') + 1
    && report.offers.length === 2
    && report.failed.cash === 100 && report.failed.same && report.failed.text.includes('Nothing was charged')
    && report.confirmed.cash === report.cash0 - 3000 && report.confirmed.again === report.confirmed.cash
    && report.confirmed.active === 1 && report.confirmed.status.includes('withdrawn') && report.confirmed.sale === '[{"id":"sale-keep","kind":"sale"}]'
    && keys.includes('applied') && keys.includes('accepted') && keys.includes('confirmed') && keys.includes('withdrawn')
    && report.detail.includes(report.keys.find(k => k.includes('withdrawn')))
    && report.history.length === report.keys.length && report.dupHist === report.keys.length
    && report.reloaded === keys
    && cdp.errors.length === 0;
  if (!ok) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  chrome.kill('SIGTERM');
}
