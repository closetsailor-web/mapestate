import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const OUT = '/opt/cursor/artifacts/map-preview';
mkdirSync(OUT, {recursive: true});
const server = spawn('python3', ['preview/localhost-server.py', '--port', '8767'], {cwd: '/workspace', stdio: 'ignore'});
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=9238', '--user-data-dir=/tmp/chrome-yp-select', 'about:blank',
], {stdio: 'ignore'});

async function browserWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const info = await (await fetch('http://127.0.0.1:9238/json/version')).json();
      if (info.webSocketDebuggerUrl) return info.webSocketDebuggerUrl;
    } catch {}
    await delay(250);
  }
  throw new Error('Chrome debugging port did not open');
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.events = [];
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const pending = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? pending.reject(new Error(JSON.stringify(msg.error))) : pending.resolve(msg.result);
      } else if (msg.method) this.events.push(msg);
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
  async waitEvent(method, sessionId, timeout = 8000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const i = this.events.findIndex(e => e.method === method && (!sessionId || e.sessionId === sessionId));
      if (i >= 0) return this.events.splice(i, 1)[0];
      await delay(50);
    }
    throw new Error('missing event ' + method);
  }
}
const ws = new WebSocket(await browserWs());
await new Promise((resolve, reject) => {ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
const cdp = new CDP(ws);
const {targetId} = await cdp.send('Target.createTarget', {url: 'about:blank'});
const {sessionId} = await cdp.send('Target.attachToTarget', {targetId, flatten: true});
await cdp.send('Page.enable', {}, sessionId);
await cdp.send('Runtime.enable', {}, sessionId);
await cdp.send('Page.addScriptToEvaluateOnNewDocument', {source: `try{localStorage.clear()}catch(e){}window.__geoReads=0;window.__geoWatch=0;window.__geoPerm=0;window.__locCalls=[];const g={getCurrentPosition(){window.__geoReads++;window.__locCalls.push('getCurrentPosition');},watchPosition(){window.__geoWatch++;window.__locCalls.push('watchPosition');return 1;},clearWatch(){window.__locCalls.push('clearWatch');}};try{Object.defineProperty(navigator,'geolocation',{configurable:true,get(){return g;}});}catch(e){}try{const perms=navigator.permissions;if(perms&&perms.query){const orig=perms.query.bind(perms);perms.query=function(desc){if(desc&&desc.name==='geolocation'){window.__geoPerm++;window.__locCalls.push('permissions:geolocation');return Promise.resolve({state:'prompt',addEventListener(){},removeEventListener(){}});}return orig(desc);};}}catch(e){}try{const proto=HTMLScriptElement.prototype;const desc=Object.getOwnPropertyDescriptor(proto,'src');Object.defineProperty(proto,'src',{configurable:true,get(){return desc.get.call(this);},set(v){if(String(v).includes('maplibre-gl.js')&&!window.__ypReleaseMap){window.__ypHeldMapScript=this;window.__ypHeldMapSrc=String(v);return;}return desc.set.call(this,v);}});}catch(e){}`}, sessionId);
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
function place(name, state, country, lon, lat, type, id) {
  return {place_id: id, result_type: type, name, state, country, country_code: 'au', lon, lat};
}
const bodies = {
  avenell: {results: [
    place('Avenell Heights', 'Queensland', 'Australia', 152.35, -24.88, 'suburb', 'ah-suburb'),
    place('Avenell Heights', 'Queensland', 'Australia', 152.351, -24.881, 'district', 'ah-district'),
    place('Avenel', 'Victoria', 'Australia', 145.23, -36.9, 'suburb', 'avenel-vic'),
  ]},
  avenel: {results: [place('Avenel', 'Victoria', 'Australia', '145.23', '-36.90', 'suburb', 'avenel-str')]},
  nocentre: {results: [{place_id: 'none', result_type: 'suburb', name: 'Nowhere', state: 'Queensland', country: 'Australia', country_code: 'au'}]},
  ave: {results: [place('Avenell Heights', 'Queensland', 'Australia', 152.35, -24.88, 'suburb', 'ah-slow')]},
};
async function installSearch() {
  return evalJson(`(()=>{
    window.ypGeoKey='preview-test';
    window.__ypBodies=${JSON.stringify(bodies)};
    window.__ypDelay={ave:1500};
    window.__searchLog=[];
    const orig=window.fetch;
    window.fetch=function(url,opts){
      const href=String(url);
      if(!href.includes('/v1/geocode/autocomplete'))return orig.apply(this,arguments);
      const text=new URL(href).searchParams.get('text')||'';
      window.__searchLog.push(text);
      const body=window.__ypBodies[text]||{results:[]};
      const wait=window.__ypDelay[text]||40;
      return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>resolve(new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}})),wait);
        if(opts&&opts.signal)opts.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));});
      });
    };
    return 1;
  })()`);
}
async function typeTown(text) {
  await evalJson(`(()=>{const i=document.getElementById('yp-where-town');i.focus();i.value=${JSON.stringify(text)};i.dispatchEvent(new Event('input',{bubbles:true}));return 1;})()`);
}
async function waitRows(n, timeout = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const rows = await evalJson(`[...document.querySelectorAll('#yp-where-suggestions button')].map(b=>b.textContent)`);
    if (rows && rows.length === n) return rows;
    await delay(50);
  }
  return evalJson(`[...document.querySelectorAll('#yp-where-suggestions button')].map(b=>b.textContent)`);
}
async function boxOf(id) {
  return evalJson(`(()=>{const b=document.getElementById(${JSON.stringify(id)});const r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,w:r.width,h:r.height};})()`);
}
async function mouseClick(id) {
  const box = await boxOf(id);
  await cdp.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: box.x, y: box.y}, sessionId);
  await cdp.send('Input.dispatchMouseEvent', {type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1}, sessionId);
  await cdp.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1}, sessionId);
  return box;
}
async function touchTap(id) {
  const box = await boxOf(id);
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: box.x, y: box.y, id: 1}]}, sessionId);
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}, sessionId);
  return box;
}
async function key(name, code, vk) {
  await cdp.send('Input.dispatchKeyEvent', {type: 'keyDown', key: name, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk}, sessionId);
  await cdp.send('Input.dispatchKeyEvent', {type: 'keyUp', key: name, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk}, sessionId);
}
function closeStyleExpr() {
  return `(()=>{const b=document.getElementById('yp-where-close'),card=document.querySelector('#yp-where .card'),cs=getComputedStyle(b);const br=b.getBoundingClientRect();return {text:b.textContent,bg:cs.backgroundColor,color:cs.color,weight:cs.fontWeight,size:cs.fontSize,minH:cs.minHeight,shadow:cs.boxShadow,bottom:Math.round(br.bottom),view:window.innerHeight,width:Math.round(br.width),card:Math.round(card.getBoundingClientRect().width)};})()`;
}
async function state() {
  return evalJson(`(()=>{const map=window.__ypMap;const c=map&&map.getCenter?map.getCenter():null;const stock=JSON.parse(localStorage.getItem('yp.previewStock.v1')||'{"rentals":[]}');const centre=window.__ypListCentre;const near=centre?(stock.rentals||[]).filter(r=>ypDistanceM(centre.lon,centre.lat,r.lon,r.lat)<=2000).length:0;return {popup:!!document.getElementById('yp-where'),status:(document.getElementById('yp-where-status')||{}).textContent||'',note:(document.getElementById('yp-chosen-note')||{}).textContent||'',label:centre&&centre.label,lon:centre&&centre.lon,lat:centre&&centre.lat,mapLon:c&&c.lng,mapLat:c&&c.lat,zoom:map&&map.getZoom?map.getZoom():null,near,rentals:(stock.rentals||[]).length,list:!!document.getElementById('yp-rent-list'),geo:window.__geoReads||0,watch:window.__geoWatch||0,perm:window.__geoPerm||0,tiles:document.querySelector('.maplibregl-ctrl-attrib')?.textContent||''};})()`);
}

await cdp.send('Page.navigate', {url: 'http://127.0.0.1:8767/?select=' + Date.now()}, sessionId);
const ready = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof flowFinish==='function')r(1);else if(Date.now()-t>20000)r(0);else setTimeout(tick,80)};tick()})`);
if (!ready) throw new Error('Game did not boot');
await evalJson(`(()=>{G.hwSeen=1;flowFinish({nick:'tester1',band:7,view:'week',exp:{freq:'week',items:{},yearly:{}},start:'Glimmerbrook'});document.getElementById('st_rent').click();document.getElementById('st_go').click();document.getElementById('st_lease12').click();document.getElementById('st_go').click();return 1;})()`);
const held = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(document.getElementById('yp-where')&&window.__ypHeldMapScript&&!window.__ypMap)r(1);else if(Date.now()-t>15000)r(0);else setTimeout(tick,50)};tick()})`);
if (!held) throw new Error('map script was not held before selection');
const beforeMap = await evalJson(`({map:!!window.__ypMap,popup:!!document.getElementById('yp-where'),held:!!window.__ypHeldMapScript})`);
const emptyClose = await evalJson(closeStyleExpr());
await installSearch();
await typeTown('avenell');
const rows = await waitRows(2);
await shot('no-key-select-suggestions-mobile.png');
await cdp.send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 800, deviceScaleFactor: 1, mobile: false}, sessionId);
await delay(150);
const desktopClose = await evalJson(closeStyleExpr());
await shot('no-key-select-suggestions-desktop.png');
await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
await delay(100);
await mouseClick('yp-where-opt-0');
await delay(150);
const early = await state();
await shot('no-key-selected-before-map-mobile.png');
await evalJson(`(()=>{window.__ypReleaseMap=1;window.__ypHeldMapScript.src=window.__ypHeldMapSrc;return 1;})()`);
await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{const m=window.__ypMap;if(m&&m.getCenter&&Math.abs(m.getCenter().lng-152.35)<0.05)r(1);else if(Date.now()-t>20000)r(0);else setTimeout(tick,100)};tick()})`);
await delay(300);
const centred = await state();
await shot('no-key-selected-mobile.png');
await cdp.send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 800, deviceScaleFactor: 1, mobile: false}, sessionId);
await delay(200);
await shot('no-key-selected-desktop.png');
const panned = await evalJson(`new Promise(resolve=>{const before={...window.__ypListCentre};const start=window.__ypMap.getCenter();window.__ypMap.once('moveend',()=>{const c=window.__ypMap.getCenter();resolve({label:window.__ypListCentre.label,lon:window.__ypListCentre.lon,same:window.__ypListCentre.lon===before.lon&&window.__ypListCentre.lat===before.lat,moved:Math.abs(c.lng-start.lng)+Math.abs(c.lat-start.lat)>0.001,list:!!document.getElementById('yp-rent-list')});});window.__ypMap.panBy([140,90]);})`);
await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
await evalJson(`ypShowWherePopup();1`);
await installSearch();
await typeTown('avenel');
const stringRows = await waitRows(1);
await evalJson(`document.getElementById('yp-where-town').focus();1`);
await key('ArrowDown', 'ArrowDown', 40);
await key('Enter', 'Enter', 13);
await delay(200);
const keyed = await state();
await evalJson(`ypShowWherePopup();1`);
await installSearch();
await typeTown('nocentre');
await waitRows(1);
await mouseClick('yp-where-opt-0');
await delay(150);
const failed = await state();
await shot('no-key-select-failed-mobile.png');
await evalJson(`document.getElementById('yp-where-suggestions').replaceChildren();document.getElementById('yp-where-town').value='';1`);
await installSearch();
await typeTown('ave');
await delay(700);
await typeTown('avenell');
const staleRows = await waitRows(2, 3000);
await delay(1600);
const staleLater = await evalJson(`[...document.querySelectorAll('#yp-where-suggestions button')].map(b=>b.textContent)`);
const searchLog = await evalJson(`window.__searchLog`);
await evalJson(`document.getElementById('yp-where-suggestions').replaceChildren();1`);
await typeTown('avenell');
await waitRows(2);
await touchTap('yp-where-opt-1');
await delay(250);
const touched = await state();
await shot('no-key-selected-touch-mobile.png');
const searchBefore = await evalJson(`({label:window.__ypListCentre.label,lon:window.__ypListCentre.lon,n:JSON.parse(localStorage.getItem('yp.previewStock.v1')).rentals.length,radius:!!document.getElementById('yp-radius-note'),provider:!!document.getElementById('yp-provider-note'),locate:typeof L.Map.prototype.locate,control:typeof (window.maplibregl&&maplibregl.GeolocateControl),button:document.getElementById('yp-search-area')?.textContent||''})`);
const searchHeld = await evalJson(`new Promise(resolve=>{const before={label:window.__ypListCentre.label,lon:window.__ypListCentre.lon};window.__ypMap.once('moveend',()=>{const c=window.__ypMap.getCenter();resolve({before,label:window.__ypListCentre.label,lon:window.__ypListCentre.lon,same:window.__ypListCentre.lon===before.lon,mapLon:+c.lng.toFixed(4),mapLat:+c.lat.toFixed(4)});});window.__ypMap.panBy([260,30]);setTimeout(()=>resolve({timeout:1}),4000);})`);
await mouseClick('yp-search-area');
await delay(200);
const searchClick = await evalJson(`(()=>{const c=window.__ypListCentre;const n=JSON.parse(localStorage.getItem('yp.previewStock.v1')).rentals.length;return {label:c&&c.label,lon:c&&c.lon,lat:c&&c.lat,n,list:!!document.getElementById('yp-rent-list'),note:document.getElementById('yp-chosen-note')?.textContent||'',popup:!!document.getElementById('yp-where')};})()`);
await shot('no-key-search-area-mobile.png');
const searchRepeat = await evalJson(`(()=>{ypSearchArea();return JSON.parse(localStorage.getItem('yp.previewStock.v1')).rentals.length;})()`);

const orange = c => c && c.text === 'Close' && c.bg === 'rgb(184, 65, 10)' && c.color === 'rgb(255, 255, 255)' && c.weight === '700' && c.size === '17px' && c.minH === '54px' && String(c.shadow).includes('rgba(196, 71, 11') && c.bottom <= c.view && c.width >= c.card - 50;
const near = (s, lon, lat) => s && Math.abs(s.mapLon - lon) < 0.05 && Math.abs(s.mapLat - lat) < 0.05 && Math.abs(s.zoom - 13) < 0.2;
const report = {beforeMap, emptyClose, desktopClose, rows, early, centred, panned, stringRows, keyed, failed, staleRows, staleLater, searchLog, touched, searchBefore, searchHeld, searchClick, searchRepeat};
writeFileSync(`${OUT}/location-select.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
const ok = beforeMap && beforeMap.popup && !beforeMap.map
  && orange(emptyClose) && orange(desktopClose)
  && rows.join('|') === 'Avenell Heights, Queensland, Australia|Avenel, Victoria, Australia'
  && early && !early.popup && early.label.includes('Avenell Heights') && early.lon === 152.35 && early.near === 10 && !early.list && early.note.includes('Selected:') && early.note.includes('when it is ready') && !early.note.includes('Map tiles are not loaded')
  && centred && !centred.popup && near(centred, 152.35, -24.88) && centred.note.includes('Selected:') && centred.note.includes('Map tiles are not loaded') && centred.note.includes('Avenell Heights') && centred.tiles.includes('Basemap tiles were not loaded') && !centred.list && centred.geo === 0 && centred.watch === 0 && centred.perm === 0
  && panned && panned.same && panned.moved && !panned.list && panned.label.includes('Avenell Heights')
  && stringRows.length === 1 && keyed && !keyed.popup && keyed.label.includes('Avenel') && near(keyed, 145.23, -36.9) && keyed.near >= 10 && !keyed.list
  && failed && failed.popup && failed.status.includes('no map centre') && failed.label.includes('Avenel') && failed.note.includes('Avenel')
  && staleRows.join('|') === rows.join('|') && staleLater.join('|') === rows.join('|') && searchLog.includes('ave') && searchLog.includes('avenell')
  && touched && !touched.popup && touched.label.includes('Avenel') && near(touched, 145.23, -36.9) && !touched.list
  && searchBefore && searchBefore.button === 'Search Area' && !searchBefore.radius && !searchBefore.provider && searchBefore.locate === 'undefined' && searchBefore.control === 'undefined'
  && searchHeld && searchHeld.same && searchHeld.label.includes('Avenel')
  && searchClick && searchClick.label.startsWith('Searched area ') && searchClick.lon === searchHeld.mapLon && searchClick.lat === searchHeld.mapLat && !searchClick.label.includes('Avenel') && searchClick.n === searchBefore.n + 10 && !searchClick.list && !searchClick.popup && searchClick.note.includes('Search area set to') && searchClick.note.includes('Map tiles are not loaded')
  && searchRepeat === searchClick.n;
server.kill('SIGTERM');
chrome.kill('SIGTERM');
if (!ok) process.exit(1);
