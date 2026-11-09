// Settings → Start fresh deletes only this preview's storage and returns to onboarding.
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'preview-406b69525cf5');
const outDir = process.env.YP_SHOT_DIR || '/opt/cursor/artifacts';
const port = 8844;
const debugPort = 9315;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: root, stdio: 'ignore'});
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', `--remote-debugging-port=${debugPort}`, '--user-data-dir=/tmp/chrome-yp-fresh', 'about:blank'], {stdio: 'ignore'});
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
await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof ypOpenSettingsMenu==='function')r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,80)};tick()})`);
await evalJson(`(()=>{document.getElementById('flow')?.remove();document.getElementById('status')?.remove();const board=document.getElementById('picker');if(board)board.style.display='none';window.advance=()=>0;return 1;})()`);
const seeded = await evalJson(`(async()=>{
  window.__ypNativeSet('fe.global', JSON.stringify({cash:999001,username:'OtherPage',started:1}));
  window.__ypNativeSet('other.page.key', 'stay');
  sessionStorage.setItem('other-session', 'stay');
  sessionStorage.setItem('yppreview-406b69525cf5.temp', 'gone');
  localStorage.setItem('fe.global', JSON.stringify({schema:7,cash:55555,week:4,started:1,username:'Mine',homeChosen:1,hist:[{t:'Kept'}],offers:[],visited:['c1'],notifs:[],cur:'c1'}));
  localStorage.setItem('yp.propertyHistory.v1', JSON.stringify({version:1,events:[{key:'r1|applied|1',gameMs:1,text:'Applied',kind:'applied'}]}));
  localStorage.setItem('yp.previewStock.v1', JSON.stringify({version:1,rentals:[{id:'r1',status:'application-pending',weeklyRent:300}]}));
  localStorage.setItem('mt.build', '3d-20261103-081221');
  await new Promise(done=>{const req=indexedDB.open('yppreview-406b69525cf5.notes',1);req.onsuccess=()=>{req.result.close();done(1);};});
  await new Promise(done=>{const req=indexedDB.open('other-page-db',1);req.onsuccess=()=>{req.result.close();done(1);};});
  const mine=await caches.open('yppreview-406b69525cf5.tiles');
  await mine.put(location.origin+'/', new Response('preview'));
  const other=await caches.open('other-page-cache');
  await other.put(location.origin+'/other', new Response('other'));
  return 1;
})()`);
await evalJson(`([...document.querySelectorAll('nav button')].find(b=>b.getAttribute('aria-label')==='Settings')).click();1`);
await evalJson(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
await shot('settings-menu-390x844.png');
const menu = await evalJson(`(()=>{const card=document.querySelector('#yp-section-menu .card');const s=getComputedStyle(card);return {items:[...card.querySelectorAll('.yp-menu-item')].map(b=>b.textContent),bg:s.backgroundColor,title:card.querySelector('h2').textContent};})()`);
await evalJson(`document.getElementById('yp-settings-fresh').click();1`);
await evalJson(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
await shot('start-fresh-confirm-390x844.png');
const card = await evalJson(`(()=>{
  const go=document.getElementById('yp-start-fresh-go');
  const style=getComputedStyle(go);
  return {
    title:document.getElementById('yp-start-fresh-title').textContent,
    copy:document.getElementById('yp-start-fresh-copy').textContent,
    go:go.textContent,
    cancel:document.getElementById('yp-start-fresh-cancel').textContent,
    x:document.getElementById('yp-start-fresh-x').getAttribute('aria-label'),
    red:style.backgroundColor,
    dialogs:ypOpenDialogs(),
    menu:!!document.getElementById('yp-section-menu')
  };
})()`);
const cancelled = await evalJson(`(()=>{document.getElementById('yp-start-fresh-cancel').click();return {open:!!document.getElementById('yp-start-fresh'),mine:localStorage.getItem('fe.global').includes('Mine'),other:window.__ypReadReal('other.page.key')};})()`);
await evalJson(`(()=>{([...document.querySelectorAll('nav button')].find(b=>b.getAttribute('aria-label')==='Settings')).click();document.getElementById('yp-settings-fresh').click();ypGoFresh=()=>{window.__ypWent=location.pathname;};return 1;})()`);
await evalJson(`document.getElementById('yp-start-fresh-go').click();new Promise(r=>{const t=Date.now();const tick=()=>{if(window.__ypWent)r(1);else if(Date.now()-t>5000)r(0);else setTimeout(tick,40)};tick()})`);
const wiped = await evalJson(`(async()=>{
  const dbs=indexedDB.databases?await indexedDB.databases():[];
  const names=await caches.keys();
  return {went:window.__ypWent,previewSave:window.__ypReadReal('yppreview-406b69525cf5.fe.global'),previewHist:window.__ypReadReal('yppreview-406b69525cf5.yp.propertyHistory.v1'),previewStock:window.__ypReadReal('yppreview-406b69525cf5.yp.previewStock.v1'),otherSave:window.__ypReadReal('fe.global'),otherKey:window.__ypReadReal('other.page.key'),otherSession:sessionStorage.getItem('other-session'),previewSession:sessionStorage.getItem('yppreview-406b69525cf5.temp'),dbs:dbs.map(db=>db.name),caches:names,nosave:window.NOSAVE};
})()`);
await cdp.send('Page.navigate', {url: `http://127.0.0.1:${port}/`}, sessionId);
const onboard = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(document.getElementById('flow')||document.getElementById('uname'))r(1);else if(Date.now()-t>20000)r(0);else setTimeout(tick,100)};tick()})`);
const after = await evalJson(`(async()=>{
  const dbs=indexedDB.databases?await indexedDB.databases():[];
  const names=await caches.keys();
  return {
    flow:!!document.getElementById('flow'),
    nickname:!!document.getElementById('uname'),
    started:!!G.started,
    user:G.username||'',
    cash:G.cash,
    history:ypReadHistory().events.length,
    apps:(ypReadStock().rentals||[]).filter(r=>r.status==='application-pending').length,
    previewSave:window.__ypReadReal('yppreview-406b69525cf5.fe.global'),
    previewHist:window.__ypReadReal('yppreview-406b69525cf5.yp.propertyHistory.v1'),
    previewStock:window.__ypReadReal('yppreview-406b69525cf5.yp.previewStock.v1'),
    otherSave:window.__ypReadReal('fe.global'),
    otherKey:window.__ypReadReal('other.page.key'),
    otherSession:sessionStorage.getItem('other-session'),
    previewSession:sessionStorage.getItem('yppreview-406b69525cf5.temp'),
    dbs:dbs.map(db=>db.name),
    caches:names
  };
})()`);
const problems=[];
if (menu.title!=='Settings'||menu.bg!=='rgb(255, 255, 255)'||menu.items.join('|')!=='Profile|Income|Expenses|Budget|Test option: fast clock|Start fresh') problems.push('menu '+JSON.stringify(menu));
if (!(card.title==='Start fresh'&&card.copy==='This deletes your saved game on this device and starts again from the beginning.'&&card.go==='Delete and start fresh'&&card.cancel==='Cancel'&&card.x==='Close'&&card.red==='rgb(180, 35, 24)'&&card.dialogs.length===1&&card.dialogs[0]==='yp-start-fresh'&&!card.menu)) problems.push('card '+JSON.stringify(card));
if (!(!cancelled.open&&cancelled.mine&&cancelled.other==='stay')) problems.push('cancel '+JSON.stringify(cancelled));
const freshSave=after.previewSave?JSON.parse(after.previewSave):null;
if (!onboard||!(after.flow||after.nickname)||after.started||after.user||after.cash!==30000||after.history||after.apps||after.previewHist||after.previewStock||(freshSave&&(freshSave.username==='Mine'||freshSave.cash===55555))) problems.push('reload '+JSON.stringify({onboard,after}));
if (!(String(after.otherSave).includes('OtherPage')&&after.otherKey==='stay'&&after.otherSession==='stay'&&!after.previewSession)) problems.push('foreign '+JSON.stringify(after));
if (after.dbs.includes('yppreview-406b69525cf5.notes')||!after.dbs.includes('other-page-db')) problems.push('idb '+JSON.stringify(after.dbs));
if (after.caches.includes('yppreview-406b69525cf5.tiles')||!after.caches.includes('other-page-cache')) problems.push('caches '+JSON.stringify(after.caches));
if (!seeded) problems.push('seed failed');
if (problems.length){console.error(problems.join('\n'));process.exitCode=1;}
else console.log('PASS start fresh', {cash:after.cash, flow:after.flow, other:after.otherKey});
server.kill('SIGTERM');
chrome.kill('SIGTERM');
setTimeout(()=>process.exit(process.exitCode||0),200);
