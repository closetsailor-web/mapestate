// A rental application is decided after one game hour of real time even while the week clock stays paused.
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'preview-406b69525cf5');
const outDir = '/opt/cursor/artifacts';
const port = 8878;
const debugPort = 9366;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: root, stdio: 'ignore'});
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/chrome-yp-apphour-${Date.now()}`, 'about:blank'], {stdio: 'ignore'});
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
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 1600));
    return result.result.value;
  }
  async function shot(name){
    await evalJson(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const image = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
    writeFileSync(path.join(outDir, name), Buffer.from(image.data, 'base64'));
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
  await cdp.send('Page.navigate', {url: `http://127.0.0.1:${port}/?v=${Date.now()}`}, sessionId);
  const booted = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof ypSubmitApply==='function'&&typeof clockStep==='function')r(1);else if(Date.now()-t>30000)r(0);else setTimeout(tick,100)};tick()})`);
  if (!booted) problems.push('page did not boot');
  const open = await evalJson(`(()=>{
    document.getElementById('flow')?.remove();
    document.getElementById('status')?.remove();
    document.getElementById('hwov')?.remove();
    G.started=1; G.homeChosen=0; G.clockOn=0; G.week=0; G.acc=0; G.statusPick='rent';
    if(typeof hud==='function')hud();
    const place={label:'Bargara',lon:152.4632,lat:-24.8186,stockKey:'Bargara'};
    const store=ypEnsureSuburbStock(ypFreshStock(),place,[{lon:152.465,lat:-24.813}]);
    ypWriteStock(store);
    const id=store.rentals[0].id;
    ypSubmitApply(id);
    ypOpenRentalDetail(id);
    const rental=ypReadStock().rentals.find(r=>r.id===id);
    const hour=CFG.weekMs/168;
    const wait=rental.approveAt-Date.now();
    return {
      id, weekMs:CFG.weekMs, hour, wait, status:rental.status, week:G.week, home:!!G.homeChosen, clock:!!G.clockOn,
      pill:document.getElementById('date')?.textContent||'',
      text:document.getElementById('yp-rent-detail')?.innerText||''
    };
  })()`);
  await shot('application-pending-390x844.png');
  if (open.weekMs !== 49676585) problems.push('not the real clock '+open.weekMs);
  if (Math.abs(open.hour - open.weekMs/168) > 1) problems.push('hour '+open.hour);
  if (open.status !== 'application-pending') problems.push('status '+open.status);
  if (open.week !== 0 || open.home || open.clock) problems.push('clock moved '+JSON.stringify(open));
  if (open.pill !== 'Paused') problems.push('pill '+open.pill);
  if (Math.abs(open.wait - open.hour) > 5000) problems.push('wait '+open.wait+' hour '+open.hour);
  if (!/choosing a home/.test(open.text) || /clock pauses/.test(open.text)) problems.push('copy '+open.text.slice(0, 240));
  const early = await evalJson(`(()=>{clockStep();const r=ypReadStock().rentals.find(r=>r.id==='${open.id}');return {status:r.status,week:G.week,pill:document.getElementById('date').textContent};})()`);
  if (early.status !== 'application-pending' || early.week !== 0 || early.pill !== 'Paused') problems.push('early '+JSON.stringify(early));
  const decided = await evalJson(`(()=>{
    const rental=ypReadStock().rentals.find(r=>r.id==='${open.id}');
    const real=Date.now;
    Date.now=()=>rental.approveAt+1000;
    try{clockStep();}finally{Date.now=real;}
    const cur=ypReadStock().rentals.find(r=>r.id==='${open.id}');
    ypOpenRentalDetail('${open.id}');
    return {status:cur.status,week:G.week,home:!!G.homeChosen,pill:document.getElementById('date').textContent,title:document.getElementById('yp-listing-title')?.textContent||'',text:document.getElementById('yp-rent-detail')?.innerText||''};
  })()`);
  await shot('application-decided-390x844.png');
  if (decided.status !== 'approved' || decided.week !== 0 || decided.home || decided.pill !== 'Paused') problems.push('decided '+JSON.stringify(decided));
  if (!/Confirm and pay bond|Approved|approval/i.test(decided.text)) problems.push('decision text '+decided.text.slice(0, 240));
  const futureId = await evalJson(`(()=>{
    const place={label:'Bargara',lon:152.4632,lat:-24.8186,stockKey:'Bargara'};
    const store=ypEnsureSuburbStock(ypFreshStock(),place,[{lon:152.466,lat:-24.814}]);
    const rental=store.rentals[0];
    rental.status='application-pending'; rental.owner='game'; rental.appliedGameMs=0; rental.approveGameMs=CFG.weekMs/168; rental.approveAt=Date.now()+3600000;
    ypWriteStock(store); save();
    return rental.id;
  })()`);
  await cdp.send('Page.navigate', {url: `http://127.0.0.1:${port}/?reload=future`}, sessionId);
  await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof ypReadStock==='function'&&document.readyState==='complete')r(1);else if(Date.now()-t>30000)r(0);else setTimeout(tick,100)};tick()})`);
  await delay(500);
  const future = await evalJson(`(()=>{const rental=ypReadStock().rentals.find(r=>r.id==='${futureId}');return {status:rental&&rental.status,week:G.week,home:!!G.homeChosen};})()`);
  const pastId = await evalJson(`(()=>{
    const place={label:'Bargara',lon:152.4632,lat:-24.8186,stockKey:'Bargara'};
    const store=ypEnsureSuburbStock(ypFreshStock(),place,[{lon:152.467,lat:-24.815}]);
    const rental=store.rentals[0];
    rental.status='application-pending'; rental.owner='game'; rental.appliedGameMs=0; rental.approveGameMs=CFG.weekMs/168; rental.approveAt=Date.now()-1000;
    ypWriteStock(store); save();
    return rental.id;
  })()`);
  await cdp.send('Page.navigate', {url: `http://127.0.0.1:${port}/?reload=past`}, sessionId);
  await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof ypReadStock==='function'&&document.readyState==='complete')r(1);else if(Date.now()-t>30000)r(0);else setTimeout(tick,100)};tick()})`);
  await delay(500);
  const past = await evalJson(`(()=>{const rental=ypReadStock().rentals.find(r=>r.id==='${pastId}');return {status:rental&&rental.status,week:G.week,home:!!G.homeChosen,pill:document.getElementById('date')?.textContent||''};})()`);
  const after = {future: future.status, past: past.status, week: past.week, home: past.home, pill: past.pill};
  if (future.status !== 'application-pending' || past.status !== 'approved' || past.week !== 0 || past.home) problems.push('reload '+JSON.stringify(after));
  if (problems.length) { console.error(problems.join('\n')); await finish(1); }
  else { console.log('PASS application hour', {waitMin: +(open.wait/60000).toFixed(2), hourMin: +(open.hour/60000).toFixed(2), early: early.status, decided: decided.status, reload: after}); await finish(0); }
} catch (error) {
  console.error(error);
  await finish(1);
}
