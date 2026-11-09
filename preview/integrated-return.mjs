import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const OUT = '/opt/cursor/artifacts/map-preview';
mkdirSync(OUT, {recursive: true});
const server = spawn('python3', ['preview/localhost-server.py', '--port', '8768'], {cwd: '/workspace', stdio: 'ignore'});
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=9239', '--user-data-dir=/tmp/chrome-yp-return', 'about:blank',
], {stdio: 'ignore'});

async function browserWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const info = await (await fetch('http://127.0.0.1:9239/json/version')).json();
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
const geoSpy = [
  'window.__geoReads=0;window.__geoWatch=0;window.__geoPerm=0;',
  'const g={getCurrentPosition(){window.__geoReads++;},watchPosition(){window.__geoWatch++;return 1;},clearWatch(){}};',
  'try{Object.defineProperty(navigator,"geolocation",{configurable:true,get(){return g;}});}catch(e){}',
  'try{const perms=navigator.permissions;if(perms&&perms.query){const orig=perms.query.bind(perms);perms.query=function(desc){if(desc&&desc.name==="geolocation"){window.__geoPerm++;return Promise.resolve({state:"prompt"});}return orig(desc);};}}catch(e){}'
].join('');
await cdp.send('Page.addScriptToEvaluateOnNewDocument', {source: geoSpy}, sessionId);

async function evalJson(expression) {
  const result = await cdp.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 700));
  return result.result.value;
}
async function shot(name) {
  const image = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
  writeFileSync(`${OUT}/${name}`, Buffer.from(image.data, 'base64'));
}
async function size(width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width < 700}, sessionId);
}
async function armSearch() {
  await evalJson(`(()=>{
    window.ypGeoKey='preview-test';
    const orig=window.fetch;
    window.fetch=function(url,opts){
      const href=String(url);
      if(!href.includes('/v1/geocode/autocomplete'))return orig.apply(this,arguments);
      const body={results:[{place_id:'ah',result_type:'suburb',name:'Avenell Heights',state:'Queensland',country:'Australia',country_code:'au',lon:152.35,lat:-24.88}]};
      return Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}}));
    };
    return 1;
  })()`);
}
async function clickId(id) {
  const box = await evalJson(`(()=>{const b=document.getElementById(${JSON.stringify(id)});const r=b.getBoundingClientRect();const x=Math.round(r.left+r.width/2),y=Math.round(r.top+r.height/2);const top=document.elementFromPoint(x,y);return {x,y,text:b.textContent,top:top&&(top.id||top.className||top.tagName)};})()`);
  if (box.top !== id && !(await evalJson(`document.elementFromPoint(${box.x},${box.y})===document.getElementById(${JSON.stringify(id)})||document.getElementById(${JSON.stringify(id)}).contains(document.elementFromPoint(${box.x},${box.y}))`))) throw new Error('click missed '+id+' hit '+box.top);
  await cdp.send('Input.dispatchMouseEvent', {type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1}, sessionId);
  await cdp.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1}, sessionId);
  return box;
}
async function snapshot() {
  return evalJson(`(()=>{const fe=localStorage.getItem('fe.global');const g=fe?JSON.parse(fe):null;const city=localStorage.getItem('fe.city.c1');const props=city?Object.keys(JSON.parse(city).props||{}).length:0;const stock=JSON.parse(localStorage.getItem('yp.previewStock.v1')||'{"rentals":[]}');const canvas=document.getElementById('w3dc');const topEl=document.getElementById('view3d');return {started:!!(g&&g.started),cash:g&&g.cash,user:g&&g.username,week:g&&g.week,props,ids:(stock.rentals||[]).map(r=>r.id),centre:window.__ypListCentre&&window.__ypListCentre.label,lon:window.__ypListCentre&&window.__ypListCentre.lon,flow:!!document.getElementById('flow'),where:!!document.getElementById('yp-where'),listOld:!!document.getElementById('listings'),canvas:canvas?getComputedStyle(canvas).display:'',top:topEl?getComputedStyle(topEl).display:'',preview:document.documentElement.className,ready:document.readyState,scripts:[...document.scripts].map(s=>s.src).filter(s=>s.includes('map-preview')||s.includes('maplibre')).length,geo:window.__geoReads||0,watch:window.__geoWatch||0,perm:window.__geoPerm||0,locate:typeof (window.L&&L.Map&&L.Map.prototype.locate)};})()`);
}

try {
  await size(390, 844);
  await cdp.send('Page.navigate', {url: 'http://127.0.0.1:8768/?integrated=' + Date.now()}, sessionId);
  const ready = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof flowFinish==='function')r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,100)};tick()})`);
  if (!ready) throw new Error('Game did not boot');
  await evalJson(`(()=>{G.hwSeen=1;flowFinish({nick:'sailor',band:7,view:'week',exp:{freq:'week',items:{},yearly:{}},start:'Glimmerbrook'});document.getElementById('st_rent').click();document.getElementById('st_go').click();document.getElementById('st_lease12').click();document.getElementById('st_go').click();return 1;})()`);
  const popup = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(document.getElementById('yp-where-town'))r(1);else if(Date.now()-t>15000)r(0);else setTimeout(tick,80)};tick()})`);
  if (!popup) throw new Error('Choose location did not open');
  await armSearch();
  await evalJson(`(()=>{const i=document.getElementById('yp-where-town');i.focus();i.value='avenell';i.dispatchEvent(new Event('input',{bubbles:true}));return 1;})()`);
  const rows = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{const n=document.querySelectorAll('#yp-where-suggestions button').length;if(n)r(n);else if(Date.now()-t>4000)r(0);else setTimeout(tick,50)};tick()})`);
  await clickId('yp-where-opt-0');
  await delay(400);
  const mapReady = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(window.__ypMap&&window.__ypMap.getCenter)r(1);else if(Date.now()-t>20000)r(0);else setTimeout(tick,100)};tick()})`);
  const chosen = await snapshot();
  await shot('integrated-selected-mobile.png');
  const held = await evalJson(`new Promise(resolve=>{const before=window.__ypListCentre.lon;let done=false;const finish=()=>{if(done)return;done=true;resolve({same:window.__ypListCentre.lon===before,map:+window.__ypMap.getCenter().lng.toFixed(4)});};window.__ypMap.once('moveend',finish);window.__ypMap.panBy([420,60]);setTimeout(finish,1500);})`);
  await clickId('yp-search-area');
  await delay(250);
  const searched = await snapshot();
  await shot('integrated-search-area-mobile.png');
  const beforeZoom = await evalJson(`window.__ypMap.getZoom()`);
  await clickId('zoomin');
  await delay(200);
  const afterZoom = await evalJson(`window.__ypMap.getZoom()`);
  await clickId('list3d');
  await delay(200);
  const cats = await evalJson(`(()=>{const p=document.getElementById('yp-prop');return {labels:p?[...p.querySelectorAll('button')].map(b=>b.textContent):[],old:!!document.getElementById('listings'),canvas:getComputedStyle(document.getElementById('w3dc')).display};})()`);
  await shot('integrated-listings-mobile.png');
  await evalJson(`document.getElementById('yp-cat-rent').click();1`);
  await delay(150);
  await evalJson(`document.querySelector('#yp-rent-list .yp-rent-row').click();1`);
  await delay(150);
  const detail = await evalJson(`document.getElementById('yp-rent-detail')?.innerText.replace(/\\s+/g,' ').trim()||''`);
  await shot('integrated-detail-mobile.png');
  const beforeReload = await snapshot();
  await evalJson(`document.getElementById('yp-rent-detail')?.remove();document.getElementById('yp-rent-list')?.remove();1`);
  await cdp.send('Page.reload', {ignoreCache: true}, sessionId);
  const returned = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{const root=document.documentElement;if(root&&root.classList.contains('yp-preview')&&window.__ypMap&&localStorage.getItem('fe.global'))r(1);else if(Date.now()-t>45000)r(0);else setTimeout(tick,150)};tick()})`);
  await delay(400);
  const afterReload = await snapshot();
  await shot('integrated-return-mobile.png');
  await size(1280, 800);
  await delay(200);
  const deskZoom = await evalJson(`window.__ypMap?window.__ypMap.getZoom():null`);
  await clickId('zoomout');
  await delay(200);
  const deskZoomAfter = await evalJson(`window.__ypMap?window.__ypMap.getZoom():null`);
  await clickId('home');
  await delay(250);
  const recentred = await snapshot();
  await shot('integrated-return-desktop.png');
  const report = {rows, mapReady, chosen, held, searched, beforeZoom, afterZoom, cats, detail: detail.slice(0, 180), beforeReload, returned, afterReload, deskZoom, deskZoomAfter, recentred};
  writeFileSync(`${OUT}/integrated-return.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  const ok = rows === 1 && mapReady === 1
    && chosen.started && chosen.where === false && chosen.centre.includes('Avenell Heights') && chosen.canvas === 'none' && chosen.top === 'none' && chosen.geo === 0 && chosen.locate === 'undefined' && chosen.props === 0
    && held.same && held.map !== 152.35
    && searched.centre.startsWith('Searched area ') && searched.listOld === false && searched.cash === chosen.cash
    && afterZoom > beforeZoom
    && cats.labels.slice(0, 4).join('|') === 'For Sale|For Rent|Room Share|Auctions' && !cats.old && cats.canvas === 'none'
    && detail.includes('Sample rental') && detail.includes('Not a real vacancy') && !detail.includes('you own') && !detail.includes('Preview starter rental')
    && beforeReload.cash === chosen.cash && beforeReload.props === 0 && beforeReload.ids.length === 20
    && returned === 1 && afterReload.started && afterReload.flow === false && afterReload.cash === beforeReload.cash && afterReload.user === 'sailor' && afterReload.week === beforeReload.week && afterReload.props === 0 && afterReload.ids.join() === beforeReload.ids.join() && afterReload.canvas === 'none' && afterReload.top === 'none' && afterReload.geo === 0 && afterReload.watch === 0 && afterReload.perm === 0
    && deskZoomAfter < deskZoom && recentred.centre === searched.centre && recentred.lon === searched.lon;
  if (!ok) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  chrome.kill('SIGTERM');
}
