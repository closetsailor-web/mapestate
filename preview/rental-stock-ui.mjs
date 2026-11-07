import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const OUT = '/opt/cursor/artifacts/map-preview';
mkdirSync(OUT, {recursive: true});
const server = spawn('python3', ['preview/localhost-server.py', '--port', '8766'], {cwd: '/workspace', stdio: 'ignore'});
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=9236', '--user-data-dir=/tmp/chrome-yp-rentals', 'about:blank',
], {stdio: 'ignore'});

async function browserWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const info = await (await fetch('http://127.0.0.1:9236/json/version')).json();
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
await cdp.send('Page.addScriptToEvaluateOnNewDocument', {source: `window.__geoReads=0;window.__geoWatch=0;const g={getCurrentPosition(){window.__geoReads++;},watchPosition(){window.__geoWatch++; return 1;}};try{Object.defineProperty(navigator,'geolocation',{configurable:true,get(){return g;}});}catch(e){}`}, sessionId);
await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);

async function evalJson(expression) {
  const result = await cdp.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 700));
  return result.result.value;
}
async function shot(name) {
  const image = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
  writeFileSync(`${OUT}/${name}`, Buffer.from(image.data, 'base64'));
}
async function boot() {
  await cdp.send('Page.navigate', {url: 'http://127.0.0.1:8766/?rentals=' + Date.now()}, sessionId);
  const ready = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof flowFinish==='function'&&typeof ypChooseTown==='function')r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,100)};tick()})`);
  if (!ready) throw new Error('Game did not boot');
  await evalJson(`(()=>{G.hwSeen=1;flowFinish({nick:'tester1',band:7,view:'week',exp:{freq:'week',items:{},yearly:{}},start:'Glimmerbrook'});document.getElementById('st_rent').click();document.getElementById('st_go').click();document.getElementById('st_lease12').click();document.getElementById('st_go').click();return 1;})()`);
  await delay(500);
}

try {
  await boot();
  await evalJson(`localStorage.removeItem('yp.previewStock.v1');1`);
  const beforeList = await evalJson(`(()=>({where:document.getElementById('yp-where-title')?.textContent,placeholder:document.getElementById('yp-where-town')?.placeholder,locate:!!document.getElementById('yp-where-locate'),home:getComputedStyle(document.getElementById('home')).display,list:!!document.getElementById('yp-rent-list'),geo:window.__geoReads||0,watch:window.__geoWatch||0}))()`);
  await evalJson(`ypChooseTown({label:'Split Town',name:'Split Town',lon:152.36,lat:-24.87,postcodes:['4670','4671']});1`);
  await delay(200);
  await shot('no-key-mocked-postcode-choice.png');
  const choice = await evalJson(`document.getElementById('yp-where')?.innerText.replace(/\\s+/g,' ').trim()||''`);
  await evalJson(`([...document.querySelectorAll('#yp-where-suggestions button')].find(b=>b.textContent==='4670')||document.querySelector('#yp-where-suggestions button')).click();1`);
  await delay(200);
  const afterChoice = await evalJson(`(()=>({show:!!document.getElementById('yp-show-rentals'),list:!!document.getElementById('yp-rent-list'),ids:JSON.parse(localStorage.getItem('yp.previewStock.v1')).rentals.map(r=>r.id)}))()`);
  await evalJson(`document.getElementById('yp-show-rentals').click();1`);
  await delay(200);
  await shot('no-key-mocked-rental-list-mobile.png');
  const list = await evalJson(`(()=>{const p=document.getElementById('yp-rent-list');return {text:p.innerText.replace(/\\s+/g,' ').trim(),rows:p.querySelectorAll('.yp-rent-row').length,filter:window.__ypListPostcode};})()`);
  const cashBefore = await evalJson(`(()=>{const fe={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('fe.'))fe[k]=localStorage.getItem(k);}return {cash:typeof G==='undefined'?null:G.cash,fe};})()`);
  await evalJson(`document.querySelector('#yp-rent-list .yp-rent-row').click();1`);
  await delay(150);
  await shot('no-key-mocked-rental-detail-mobile.png');
  const detail = await evalJson(`document.getElementById('yp-rent-detail')?.innerText.replace(/\\s+/g,' ').trim()||''`);
  await evalJson(`document.getElementById('yp-rent-apply').click();1`);
  const applied = await evalJson(`(()=>{const fe={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('fe.'))fe[k]=localStorage.getItem(k);}return {cash:typeof G==='undefined'?null:G.cash,fe,text:document.getElementById('yp-rent-detail')?.innerText.replace(/\\s+/g,' ').trim()||'',status:JSON.parse(localStorage.getItem('yp.previewStock.v1')).rentals.find(r=>r.id==='preview:split town:1').status};})()`);
  const ids = afterChoice.ids;
  await boot();
  await evalJson(`ypChooseTown({label:'Avenell Heights',name:'Avenell Heights',lon:152.35,lat:-24.88,postcode:'4670'});1`);
  await delay(150);
  const reloaded = await evalJson(`(()=>{const rows=JSON.parse(localStorage.getItem('yp.previewStock.v1')).rentals;const split=rows.filter(r=>r.suburbKey==='split town').map(r=>r.id);const avenell=rows.filter(r=>r.suburbKey==='avenell heights');return {split,avenell:avenell.length,unique:new Set(rows.map(r=>r.id)).size,total:rows.length,pending:rows.find(r=>r.id===split[0])?.status||''};})()`);
  await evalJson(`document.getElementById('yp-show-rentals').click();1`);
  const filterBefore = await evalJson(`window.__ypListPostcode`);
  await evalJson(`(()=>{if(window.__ypMap)window.__ypMap.jumpTo({center:[151, -33], zoom:5});return 1;})()`);
  await delay(200);
  const filterAfter = await evalJson(`(()=>({filter:window.__ypListPostcode,rows:document.querySelectorAll('#yp-rent-list .yp-rent-row').length,text:document.getElementById('yp-rent-list').innerText.includes('4670')}))()`);
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 800, deviceScaleFactor: 1, mobile: false}, sessionId);
  await delay(150);
  await shot('no-key-mocked-rental-list-desktop.png');
  await evalJson(`ypChooseTown({label:'No Code Hills',name:'No Code Hills',lon:152.2,lat:-24.7});document.getElementById('yp-show-rentals').click();1`);
  await delay(150);
  await shot('no-key-mocked-empty-postcode-list.png');
  const empty = await evalJson(`(()=>({text:document.getElementById('yp-rent-list').innerText.replace(/\\s+/g,' ').trim(),rows:document.querySelectorAll('#yp-rent-list .yp-rent-row').length,stock:JSON.parse(localStorage.getItem('yp.previewStock.v1')).rentals.length,geo:window.__geoReads||0,watch:window.__geoWatch||0}))()`);
  const report = {label:'no API key; mocked place result with a postcode attribute; not live tiles or live vacancies', beforeList, choice, afterChoice:{show:afterChoice.show,list:afterChoice.list,count:ids.length}, list, cashBefore, detail, applied, ids, reloaded, filterBefore, filterAfter, empty};
  writeFileSync(`${OUT}/rental-stock-ui.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  const ok = beforeList.where === 'Choose location' && beforeList.placeholder === 'enter town or suburb' && !beforeList.locate && beforeList.home === 'none' && !beforeList.list && beforeList.geo === 0
    && choice.includes('4670') && choice.includes('4671') && afterChoice.show && !afterChoice.list && ids.length === 10 && new Set(ids).size === 10
    && list.rows === 10 && list.filter === '4670' && list.text.includes('Not real') === false && list.text.includes('not real vacancies')
    && detail.includes('Preview weekly rent') && detail.includes('Bond') && detail.includes('Not a real vacancy') && detail.includes('Apply to rent')
    && applied.cash === cashBefore.cash && JSON.stringify(applied.fe) === JSON.stringify(cashBefore.fe) && applied.status === 'application-pending'
    && reloaded.split.join() === ids.join() && reloaded.avenell === 10 && reloaded.total === 20 && reloaded.pending === 'application-pending'
    && filterAfter.filter === filterBefore && filterAfter.rows === 20 && filterAfter.text
    && empty.rows === 0 && empty.text.includes('No postcode was guessed') && empty.stock === 20 && empty.geo === 0 && empty.watch === 0;
  if (!ok) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  chrome.kill('SIGTERM');
}
