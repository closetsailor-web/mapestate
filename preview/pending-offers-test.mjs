// Pending Offers lists only open applications and shows the empty sentence after a rental is confirmed.
import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'preview-406b69525cf5');
const outDir = process.env.YP_SHOT_DIR || '/workspace';
mkdirSync(outDir, {recursive: true});
const port = 8891;
const debugPort = 9371;
const kepnock = 'preview:kepnock queensland australia:6';
const otherId = 'preview:bargara queensland australia:1';
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: root, stdio: 'ignore'});
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/chrome-yp-pending-${Date.now()}`, 'about:blank'], {stdio: 'ignore'});
const problems = [];

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
async function finish(code){
  server.kill('SIGTERM');
  chrome.kill('SIGTERM');
  setTimeout(() => process.exit(code), 200);
}
try {
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
  async function boot(url){
    await cdp.send('Page.navigate', {url}, sessionId);
    const ready = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof ypSubmitConfirm==='function'&&typeof ypOpenPendingOffers==='function'&&document.readyState==='complete')r(1);else if(Date.now()-t>30000)r(0);else setTimeout(tick,100)};tick()})`);
    await delay(300);
    return ready;
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
  if (!await boot(`http://127.0.0.1:${port}/?speed=test&v=${Date.now()}`)) problems.push('page did not boot');

  const empty = await evalJson(`(()=>{
    document.getElementById('flow')?.remove();
    document.getElementById('status')?.remove();
    document.getElementById('hwov')?.remove();
    document.getElementById('toast')?.classList.remove('show');
    G.started=1; G.homeChosen=1; G.clockOn=0; G.week=0; G.acc=0; G.cash=30000; G.statusPick='rent'; G.statusLease=6; G.housing='rent'; G.cur='c1';
    delete G.lease; G.placeName='';
    localStorage.removeItem('yp.previewStock.v1');
    localStorage.removeItem('yp.propertyHistory.v1');
    ypWriteStock({version:1,rentals:[]});
    hud();
    ypOpenPendingOffers();
    return {
      title:document.getElementById('yp-pending-title')?.textContent||'',
      head:!!document.querySelector('#yp-pending .yp-card-head'),
      close:!!document.querySelector('#yp-pending .yp-x'),
      empty:document.getElementById('yp-pending-empty')?.textContent||'',
      rows:[...document.querySelectorAll('#yp-pending .yp-rent-row')].map(btn=>btn.dataset.id),
      helper:typeof ypPendingOfferRows==='function'?ypPendingOfferRows({rentals:[{status:'application-pending'},{status:'approved'},{status:'active'},{status:'cancelled'},{status:'withdrawn'},{status:'declined'},{status:'expired'}]}).map(r=>r.status):[]
    };
  })()`);
  await shot('pending-offers-empty-390x844.png');
  if (empty.title !== 'Pending Offers' || !empty.head || !empty.close) problems.push('empty header '+JSON.stringify(empty));
  if (empty.empty !== 'You have no pending offers') problems.push('empty copy '+JSON.stringify(empty.empty));
  if (empty.rows.length) problems.push('empty rows '+JSON.stringify(empty.rows));
  if (empty.helper.join(',') !== 'application-pending,approved') problems.push('helper '+JSON.stringify(empty.helper));

  const pending = await evalJson(`(()=>{
    document.getElementById('yp-pending')?.remove();
    const first={id:${JSON.stringify(kepnock)},suburbKey:'kepnock queensland australia',placeLabel:'Kepnock, Queensland, Australia',locality:'Kepnock',placement:'mapped-building',n:6,lon:152.37,lat:-24.87,weeklyRent:400,bond:2400,kind:'game-starter',status:'application-pending',owner:'game',appliedGameMs:0,approveGameMs:Date.now()+86400000};
    const waiting={id:${JSON.stringify(otherId)},suburbKey:'bargara queensland australia',placeLabel:'Bargara, Queensland, Australia',locality:'Bargara',placement:'footprint',n:1,lon:152.465,lat:-24.813,weeklyRent:420,bond:2520,kind:'game-starter',status:'application-pending',owner:'game',appliedGameMs:0,approveGameMs:Date.now()+86400000};
    const past={id:'preview:old',placeLabel:'Old listing',status:'expired',owner:'game',weeklyRent:350,bond:2100};
    ypWriteStock({version:1,rentals:[first,waiting,past]});
    ypOpenPendingOffers();
    return {
      empty:document.getElementById('yp-pending-empty')?.textContent||null,
      rows:[...document.querySelectorAll('#yp-pending .yp-rent-row')].map(btn=>({id:btn.dataset.id,title:btn.querySelector('.yp-row-title')?.textContent||'',status:btn.querySelector('.yp-row-meta')?.textContent||''})),
      helper:ypPendingOfferRows(ypReadStock()).map(r=>r.id)
    };
  })()`);
  await shot('pending-offers-open-390x844.png');
  if (pending.empty != null) problems.push('pending empty '+pending.empty);
  if (pending.rows.length !== 2 || pending.helper.join(',') !== kepnock+','+otherId) problems.push('pending rows '+JSON.stringify(pending));
  if (!pending.rows.some(r=>r.id===kepnock && r.status==='Pending') || !pending.rows.some(r=>r.id===otherId && r.status==='Pending')) problems.push('pending labels '+JSON.stringify(pending.rows));

  const confirmed = await evalJson(`(()=>{
    document.getElementById('yp-pending')?.remove();
    document.getElementById('toast')?.classList.remove('show');
    G.started=1; G.homeChosen=0; G.clockOn=0; G.week=0; G.acc=0; G.cash=30000; G.statusPick='rent'; G.statusLease=6; G.housing='rent'; G.cur='c1';
    delete G.lease; G.placeName='';
    const store=ypReadStock();
    const keep=store.rentals.find(r=>r.id===${JSON.stringify(kepnock)});
    if(keep){keep.status='approved';keep.expiresAt=Date.now()+86400000;}
    ypWriteStock(store);
    ypSubmitConfirm(${JSON.stringify(kepnock)});
    document.getElementById('toast')?.classList.remove('show');
    const stock=ypReadStock().rentals.map(r=>({id:r.id,status:r.status}));
    ypOpenPendingOffers();
    return {
      stock,
      helper:ypPendingOfferRows(ypReadStock()).map(r=>({id:r.id,status:r.status})),
      title:document.getElementById('yp-pending-title')?.textContent||'',
      empty:document.getElementById('yp-pending-empty')?.textContent||'',
      rows:[...document.querySelectorAll('#yp-pending .yp-rent-row')].map(btn=>btn.dataset.id),
      living:(typeof ypActiveTenancy==='function'&&ypActiveTenancy()||ypReadStock().rentals.find(r=>r.status==='active')||{}).status
    };
  })()`);
  await shot('pending-offers-after-confirm-390x844.png');
  const kepnockRow = (confirmed.stock||[]).find(r=>r.id===kepnock);
  const otherRow = (confirmed.stock||[]).find(r=>r.id===otherId);
  if (!kepnockRow || kepnockRow.status !== 'active') problems.push('confirmed tenancy '+JSON.stringify(confirmed.stock));
  if (!otherRow || otherRow.status !== 'cancelled') problems.push('cancelled other '+JSON.stringify(confirmed.stock));
  if (confirmed.living !== 'active') problems.push('active tenancy missing');
  if (confirmed.helper.length) problems.push('helper after confirm '+JSON.stringify(confirmed.helper));
  if (confirmed.title !== 'Pending Offers' || confirmed.empty !== 'You have no pending offers' || confirmed.rows.length) problems.push('after confirm card '+JSON.stringify(confirmed));

  if (problems.length) { console.error(problems.join('\n')); console.error(JSON.stringify({empty, pending, confirmed}, null, 2).slice(0, 5000)); await finish(1); }
  else { console.log('PASS pending offers', {empty: empty.empty, open: pending.rows.length, after: confirmed.empty}); await finish(0); }
} catch (error) {
  console.error(error);
  await finish(1);
}
