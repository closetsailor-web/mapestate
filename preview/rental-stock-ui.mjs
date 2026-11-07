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
await cdp.send('Page.addScriptToEvaluateOnNewDocument', {source: `window.__geoReads=0;window.__geoWatch=0;window.__geoPerm=0;window.__locCalls=[];const g={getCurrentPosition(){window.__geoReads++;window.__locCalls.push('getCurrentPosition');},watchPosition(){window.__geoWatch++;window.__locCalls.push('watchPosition');return 1;},clearWatch(){window.__locCalls.push('clearWatch');}};try{Object.defineProperty(navigator,'geolocation',{configurable:true,get(){return g;}});}catch(e){}try{const perms=navigator.permissions;if(perms&&perms.query){const orig=perms.query.bind(perms);perms.query=function(desc){if(desc&&desc.name==='geolocation'){window.__geoPerm++;window.__locCalls.push('permissions:geolocation');return Promise.resolve({state:'prompt',addEventListener(){},removeEventListener(){}});}return orig(desc);};}}catch(e){}`}, sessionId);
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
  const banned = 'No 4-digit Australian postcode came with the place you chose';
  const beforeList = await evalJson(`(()=>({where:document.getElementById('yp-where-title')?.textContent,placeholder:document.getElementById('yp-where-town')?.placeholder,locate:!!document.getElementById('yp-where-locate'),home:getComputedStyle(document.getElementById('home')).display,list:!!document.getElementById('yp-rent-list'),geo:window.__geoReads||0,watch:window.__geoWatch||0,perm:window.__geoPerm||0,loc:(window.__locCalls||[]).slice()}))()`);
  await evalJson(`ypChooseTown({label:'Avenell Heights',name:'Avenell Heights',lon:152.35,lat:-24.88});1`);
  await delay(300);
  await shot('no-key-mocked-radius.png');
  const choice = await evalJson(`document.getElementById('yp-radius-note')?.textContent||''`);
  const afterChoice = await evalJson(`(()=>({show:!!document.getElementById('yp-show-rentals'),list:!!document.getElementById('yp-rent-list'),where:!!document.getElementById('yp-where'),ids:JSON.parse(localStorage.getItem('yp.previewStock.v1')).rentals.map(r=>r.id)}))()`);
  await evalJson(`document.getElementById('yp-show-rentals').click();1`);
  await delay(200);
  await shot('no-key-mocked-rental-list-mobile.png');
  const list = await evalJson(`(()=>{const p=document.getElementById('yp-rent-list');return {text:p.innerText.replace(/\\s+/g,' ').trim(),rows:p.querySelectorAll('.yp-rent-row').length,label:window.__ypListCentre&&window.__ypListCentre.label};})()`);
  const cashBefore = await evalJson(`(()=>{const fe={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('fe.'))fe[k]=localStorage.getItem(k);}return {cash:typeof G==='undefined'?null:G.cash,fe};})()`);
  await evalJson(`document.querySelector('#yp-rent-list .yp-rent-row').click();1`);
  await delay(150);
  await shot('no-key-mocked-rental-detail-mobile.png');
  const detail = await evalJson(`document.getElementById('yp-rent-detail')?.innerText.replace(/\\s+/g,' ').trim()||''`);
  await evalJson(`document.getElementById('yp-rent-apply').click();1`);
  const applied = await evalJson(`(()=>{const fe={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.startsWith('fe.'))fe[k]=localStorage.getItem(k);}return {cash:typeof G==='undefined'?null:G.cash,fe,status:JSON.parse(localStorage.getItem('yp.previewStock.v1')).rentals.find(r=>r.id==='preview:avenell heights:1').status};})()`);
  const ids = afterChoice.ids;
  await boot();
  await evalJson(`ypChooseTown({label:'Avenell Heights',name:'Avenell Heights',lon:152.35,lat:-24.88});1`);
  await delay(200);
  const reloaded = await evalJson(`(()=>{const rows=JSON.parse(localStorage.getItem('yp.previewStock.v1')).rentals;const avenell=rows.filter(r=>r.suburbKey==='avenell heights');return {ids:avenell.map(r=>r.id),total:rows.length,pending:avenell.find(r=>r.id==='preview:avenell heights:1')?.status||''};})()`);
  await evalJson(`document.getElementById('yp-show-rentals').click();1`);
  const filterBefore = await evalJson(`({label:window.__ypListCentre&&window.__ypListCentre.label,lon:window.__ypListCentre&&window.__ypListCentre.lon,rows:document.querySelectorAll('#yp-rent-list .yp-rent-row').length,first:document.querySelector('#yp-rent-list .yp-rent-row')?.textContent||''})`);
  await evalJson(`(()=>{if(window.__ypMap)window.__ypMap.jumpTo({center:[151, -33], zoom:5});return 1;})()`);
  await delay(250);
  const filterAfter = await evalJson(`({label:window.__ypListCentre&&window.__ypListCentre.label,lon:window.__ypListCentre&&window.__ypListCentre.lon,rows:document.querySelectorAll('#yp-rent-list .yp-rent-row').length,first:document.querySelector('#yp-rent-list .yp-rent-row')?.textContent||''})`);
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 800, deviceScaleFactor: 1, mobile: false}, sessionId);
  await delay(150);
  await shot('no-key-mocked-rental-list-desktop.png');
  const near = await evalJson(`ypDestination(152.35,-24.88,0,80)`);
  const south = await evalJson(`ypDestination(152.35,-24.88,180,80)`);
  await evalJson(`ypChooseTown({label:'Near A',lon:${near.lon},lat:${near.lat}});ypChooseTown({label:'Near B',lon:${south.lon},lat:${south.lat}});ypChooseTown({label:'Avenell Heights',lon:152.35,lat:-24.88});document.getElementById('yp-show-rentals').click();1`);
  await delay(200);
  const page1 = await evalJson(`(()=>{const rows=[...document.querySelectorAll('#yp-rent-list .yp-rent-row')].map(b=>b.textContent);return {rows:rows.length,first:rows[0]||'',label:window.__ypListCentre&&window.__ypListCentre.label};})()`);
  await evalJson(`document.getElementById('yp-rent-next').click();1`);
  await delay(100);
  const page2 = await evalJson(`(()=>{const rows=[...document.querySelectorAll('#yp-rent-list .yp-rent-row')].map(b=>b.textContent);return {rows:rows.length,first:rows[0]||'',page:window.__ypListPage};})()`);
  await evalJson(`(()=>{if(window.__ypMap)window.__ypMap.jumpTo({center:[151,-33],zoom:4});return 1;})()`);
  await delay(300);
  const page2AfterPan = await evalJson(`(()=>{const rows=[...document.querySelectorAll('#yp-rent-list .yp-rent-row')].map(b=>b.textContent);return {rows:rows.length,first:rows[0]||'',label:window.__ypListCentre&&window.__ypListCentre.label,page:window.__ypListPage};})()`);
  await evalJson(`document.getElementById('yp-rent-list-back').click();1`);
  const mapReady = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{const map=window.__ypMap;if(map&&map.isStyleLoaded()&&map.getLayer('yp-rental-cluster'))r(1);else if(Date.now()-t>20000)r(0);else setTimeout(tick,100)};tick()})`);
  const clusters = await evalJson(`new Promise(r=>{const map=window.__ypMap;const t=Date.now();const read=()=>{const feats=map.queryRenderedFeatures({layers:['yp-rental-cluster']});if(feats.length)r({count:feats.length,points:feats.map(f=>f.properties.point_count)});else if(Date.now()-t>8000)r({count:0,points:[]});else setTimeout(read,120)};map.jumpTo({center:[152.35,-24.88],zoom:4});map.once('idle',read);setTimeout(read,400)})`);
  await shot('no-key-mocked-clusters.png');
  const pinTarget = await evalJson(`(()=>{const row=JSON.parse(localStorage.getItem('yp.previewStock.v1')).rentals.find(r=>r.id==='preview:avenell heights:1');window.__ypMap.jumpTo({center:[row.lon,row.lat],zoom:16});return {id:row.id,lon:row.lon,lat:row.lat};})()`);
  await evalJson(`new Promise(r=>{window.__ypMap.once('idle',()=>r(1));setTimeout(()=>r(0),8000)})`);
  const pinHit = await evalJson(`(()=>{const map=window.__ypMap;const feats=map.queryRenderedFeatures({layers:['yp-rental-point']});const hit=feats.find(f=>f.properties.id==='preview:avenell heights:1')||feats[0];if(!hit)return null;const p=map.project(hit.geometry.coordinates);const rect=map.getCanvas().getBoundingClientRect();return {id:hit.properties.id,x:rect.left+p.x,y:rect.top+p.y,points:feats.length};})()`);
  if (pinHit) {
    await cdp.send('Input.dispatchMouseEvent', {type: 'mousePressed', x: pinHit.x, y: pinHit.y, button: 'left', clickCount: 1}, sessionId);
    await cdp.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: pinHit.x, y: pinHit.y, button: 'left', clickCount: 1}, sessionId);
  }
  await delay(250);
  const pinDetail = await evalJson(`document.getElementById('yp-rent-detail')?.innerText.replace(/\\s+/g,' ').trim()||''`);
  await shot('no-key-mocked-pin-detail.png');
  await evalJson(`document.querySelector('#yp-rent-detail .hwx')?.click();document.getElementById('yp-show-rentals').click();1`);
  await delay(150);
  const listDetail = await evalJson(`(()=>{const row=document.querySelector('#yp-rent-list .yp-rent-row[data-id="preview:avenell heights:1"]');if(!row)return 'missing-row';row.click();return document.getElementById('yp-rent-detail')?.innerText.replace(/\\s+/g,' ').trim()||'';})()`);
  const distances = await evalJson(`(()=>{const rows=JSON.parse(localStorage.getItem('yp.previewStock.v1')).rentals;return {n:rows.length,max:Math.max(...rows.map(r=>ypDistanceM(r.centreLon,r.centreLat,r.lon,r.lat))),min:Math.min(...rows.map(r=>ypDistanceM(r.centreLon,r.centreLat,r.lon,r.lat)))};})()`);
  await evalJson(`(()=>{if(window.L&&L.Map&&L.Map.prototype.locate)L.Map.prototype.locate.call({on(){return this;},fire(){return this;}});return 1;})()`);
  const locAfter = await evalJson(`({reads:window.__geoReads||0,watch:window.__geoWatch||0,perm:window.__geoPerm||0,calls:(window.__locCalls||[]).slice(),accuracy:!!document.querySelector('[id*=accuracy]'),home:getComputedStyle(document.getElementById('home')).display})`);
  await evalJson(`document.querySelector('nav button[data-v="sale"]').click();1`);
  await delay(150);
  await shot('no-key-mocked-listings-categories.png');
  const cats = await evalJson(`(()=>{const p=document.getElementById('yp-prop');return {labels:p?[...p.querySelectorAll('button')].map(b=>b.textContent):[],rent:!!document.getElementById('yp-rent-list')};})()`);
  await evalJson(`document.getElementById('yp-cat-sale').click();1`);
  const saleTagged = await evalJson(`document.getElementById('yp-prop-note')?.textContent||''`);
  await evalJson(`document.getElementById('yp-cat-back').click();document.getElementById('yp-cat-room').click();1`);
  const roomTagged = await evalJson(`document.getElementById('yp-prop-note')?.textContent||''`);
  await evalJson(`document.getElementById('yp-cat-back').click();document.getElementById('yp-cat-auction').click();1`);
  const auctionTagged = await evalJson(`document.getElementById('yp-prop-note')?.textContent||''`);
  await evalJson(`document.getElementById('yp-cat-back').click();document.getElementById('yp-cat-rent').click();1`);
  const rentFromTab = await evalJson(`(()=>{const p=document.getElementById('yp-rent-list');return {label:window.__ypListCentre&&window.__ypListCentre.label,rows:p?p.querySelectorAll('.yp-rent-row').length:0,text:p?p.innerText:''};})()`);
  await evalJson(`ypChooseTown({label:'No Code Hills',name:'No Code Hills',lon:152.2,lat:-24.7});document.getElementById('yp-show-rentals').click();1`);
  await delay(150);
  await shot('no-key-mocked-empty-postcode-list.png');
  const empty = await evalJson(`(()=>({text:document.getElementById('yp-rent-list').innerText.replace(/\\s+/g,' ').trim(),rows:document.querySelectorAll('#yp-rent-list .yp-rent-row').length,stock:JSON.parse(localStorage.getItem('yp.previewStock.v1')).rentals.length,geo:window.__geoReads||0,watch:window.__geoWatch||0,perm:window.__geoPerm||0}))()`);
  const report = {label:'no API key; mocked place result; 2 km sample pins; not live tiles or live vacancies', beforeList, choice, afterChoice:{show:afterChoice.show,list:afterChoice.list,count:ids.length}, list, cashBefore, detail, applied, ids, reloaded, filterBefore, filterAfter, page1, page2, page2AfterPan, mapReady, clusters, pinTarget, pinHit, pinDetail, listDetail, distances, locAfter, cats, saleTagged, roomTagged, auctionTagged, rentFromTab, empty};
  writeFileSync(`${OUT}/rental-stock-ui.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  const ok = beforeList.where === 'Choose location' && beforeList.placeholder === 'enter town or suburb' && !beforeList.locate && beforeList.home === 'none' && !beforeList.list && beforeList.geo === 0 && beforeList.perm === 0 && beforeList.loc.length === 0
    && choice.includes('Not this device') && afterChoice.show && !afterChoice.list && !afterChoice.where && ids.length === 10 && new Set(ids).size === 10
    && list.rows === 10 && list.label === 'Avenell Heights' && list.text.includes('2 km') && !list.text.includes(banned) && !list.text.includes('No postcode was guessed')
    && detail.includes('Test weekly rent') && detail.includes('Test bond') && detail.includes('2 km') && detail.includes('Not a real vacancy') && detail.includes('Apply to rent') && !detail.includes(banned)
    && applied.cash === cashBefore.cash && JSON.stringify(applied.fe) === JSON.stringify(cashBefore.fe) && applied.status === 'application-pending'
    && reloaded.ids.join() === ids.join() && reloaded.total === 10 && reloaded.pending === 'application-pending'
    && filterAfter.label === 'Avenell Heights' && filterAfter.lon === filterBefore.lon && filterAfter.rows === 10 && filterAfter.first === filterBefore.first
    && page1.rows === 20 && page1.label === 'Avenell Heights' && page2.rows === 10 && page2.page === 2 && page2AfterPan.rows === 10 && page2AfterPan.page === 2 && page2AfterPan.label === 'Avenell Heights' && page2AfterPan.first === page2.first
    && mapReady === 1 && clusters.count >= 1 && clusters.points.some(n => Number(n) >= 10)
    && pinHit && pinHit.id === 'preview:avenell heights:1' && pinDetail.includes('Avenell Heights') && listDetail === pinDetail
    && distances.n === 30 && distances.max <= 2000 && distances.min > 100
    && locAfter.reads === 0 && locAfter.watch === 0 && locAfter.perm === 0 && locAfter.calls.length === 0 && locAfter.home === 'none' && !locAfter.accuracy
    && cats.labels.slice(0,4).join('|') === 'For Sale|For Rent|Room Share|Auctions' && !cats.rent
    && saleTagged.includes('Avenell Heights') && saleTagged.includes('For Sale has no listings') && !saleTagged.includes(banned) && roomTagged.includes('Room Share has no listings') && auctionTagged.includes('Auctions has no listings')
    && rentFromTab.label === 'Avenell Heights' && rentFromTab.rows === 20 && !rentFromTab.text.includes(banned)
    && empty.rows === 10 && empty.text.includes('2 km') && empty.text.includes('No Code Hills') && !empty.text.includes(banned) && !empty.text.includes('No postcode was guessed') && empty.stock === 40 && empty.geo === 0 && empty.perm === 0;
  if (!ok) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  chrome.kill('SIGTERM');
}
