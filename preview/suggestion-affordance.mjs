import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const OUT = '/opt/cursor/artifacts/map-preview';
mkdirSync(OUT, {recursive: true});
const server = spawn('python3', ['preview/localhost-server.py', '--port', '8766'], {cwd: '/workspace', stdio: 'ignore'});
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=9241', '--user-data-dir=/tmp/chrome-yp-affordance', 'about:blank',
], {stdio: 'ignore'});
const BARGARA = {
  datasource: {sourcename: 'openstreetmap', attribution: '© OpenStreetMap contributors', license: 'Open Database License'},
  name: 'Bargara', country: 'Australia', country_code: 'au', state: 'Queensland', state_code: 'QLD',
  lon: 152.464, lat: -24.814, formatted: 'Bargara, Queensland, Australia',
  address_line1: 'Bargara', address_line2: 'Queensland, Australia',
  result_type: 'suburb', place_id: '51bargaraqld0001',
  rank: {importance: 0.45, confidence: 1, match_type: 'full_match'},
  bbox: {lon1: 152.43, lat1: -24.85, lon2: 152.5, lat2: -24.78}
};

async function browserWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const info = await (await fetch('http://127.0.0.1:9241/json/version')).json();
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
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params?.exceptionDetails;
        this.errors.push(d?.exception?.description || d?.text || 'exception');
      }
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
async function boxOf(id) {
  return evalJson(`(()=>{const b=document.getElementById(${JSON.stringify(id)});const r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
}
async function styleOf(id) {
  return evalJson(`(()=>{const b=document.getElementById(${JSON.stringify(id)});const c=getComputedStyle(b);return {cursor:c.cursor,bg:c.backgroundColor,outline:c.outlineStyle,outlineW:c.outlineWidth,transform:c.transform,text:b.textContent};})()`);
}
async function arm() {
  await evalJson(`(()=>{window.ypGeoKey='preview-test';const body=${JSON.stringify({results:[BARGARA]})};const orig=window.fetch;window.fetch=function(url,opts){if(!String(url).includes('/v1/geocode/autocomplete'))return orig.apply(this,arguments);return Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}}));};return 1;})()`);
}
async function typeBargara() {
  await evalJson(`(()=>{const i=document.getElementById('yp-where-town');i.focus();i.value='bargara';i.dispatchEvent(new Event('input',{bubbles:true}));return 1;})()`);
  return evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{const b=document.getElementById('yp-where-opt-0');if(b)r(b.textContent);else if(Date.now()-t>4000)r('');else setTimeout(tick,50)};tick()})`);
}
function chosen() {
  return evalJson(`(()=>{const p=window.__ypPlace;const c=window.__ypMap&&window.__ypMap.getCenter?window.__ypMap.getCenter():null;const pins=(JSON.parse(localStorage.getItem('yp.previewStock.v1')||'{"rentals":[]}').rentals||[]);return {popup:!!document.getElementById('yp-where'),label:p&&p.label,header:(document.getElementById('cityname')||{}).textContent||'',lon:p&&p.lon,lat:p&&p.lat,mapLon:c&&c.lng,mapLat:c&&c.lat,note:(document.getElementById('yp-chosen-note')||{}).textContent||'',list:!!document.getElementById('yp-rent-list'),pins:pins.length,fresh:window.__ypFreshTest||0};})()`);
}

try {
  await cdp.send('Page.navigate', {url: 'http://127.0.0.1:8766/?fresh=1'}, sessionId);
  const ready = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof flowFinish==='function'&&document.getElementById('flowframe'))r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,100)};tick()})`);
  if (!ready) throw new Error('Fresh onboarding did not open');
  await evalJson(`(()=>{G.hwSeen=1;flowFinish({nick:'bargara',band:7,view:'week',exp:{freq:'week',items:{},yearly:{}},start:'Glimmerbrook'});document.getElementById('st_rent').click();document.getElementById('st_go').click();document.getElementById('st_lease12').click();document.getElementById('st_go').click();return 1;})()`);
  const popup = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(document.getElementById('yp-where-town'))r(1);else if(Date.now()-t>15000)r(0);else setTimeout(tick,80)};tick()})`);
  if (!popup) throw new Error('Choose location did not open');
  await arm();
  const label = await typeBargara();
  const rest = await styleOf('yp-where-opt-0');
  const spot = await boxOf('yp-where-opt-0');
  await cdp.send('Input.dispatchMouseEvent', {type: 'mouseMoved', x: spot.x, y: spot.y}, sessionId);
  await delay(120);
  const hover = await styleOf('yp-where-opt-0');
  await shot('suggestion-hover-mobile.png');
  await evalJson(`document.getElementById('yp-where-opt-0').focus({focusVisible:true});1`);
  const focus = await styleOf('yp-where-opt-0');
  await cdp.send('Input.dispatchMouseEvent', {type: 'mousePressed', x: spot.x, y: spot.y, button: 'left', clickCount: 1}, sessionId);
  await delay(40);
  const pressed = await styleOf('yp-where-opt-0');
  await cdp.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: spot.x, y: spot.y, button: 'left', clickCount: 1}, sessionId);
  await delay(250);
  const afterClick = await chosen();
  await shot('suggestion-selected-bargara-mobile.png');
  await evalJson(`ypShowWherePopup();1`);
  await arm();
  await typeBargara();
  await evalJson(`document.getElementById('yp-where-town').focus();1`);
  await cdp.send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40, nativeVirtualKeyCode: 40}, sessionId);
  await cdp.send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40, nativeVirtualKeyCode: 40}, sessionId);
  const keyedStyle = await evalJson(`(()=>{const b=document.getElementById('yp-where-opt-0');const c=getComputedStyle(b);return {cursor:c.cursor,bg:c.backgroundColor,on:b.classList.contains('on')};})()`);
  await cdp.send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13}, sessionId);
  await cdp.send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13}, sessionId);
  await delay(200);
  const afterKey = await chosen();
  await evalJson(`ypShowWherePopup();1`);
  await arm();
  await typeBargara();
  const touch = await boxOf('yp-where-opt-0');
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: touch.x, y: touch.y, id: 1}]}, sessionId);
  await delay(40);
  const touchPressed = await styleOf('yp-where-opt-0');
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}, sessionId);
  await delay(250);
  const afterTouch = await chosen();
  const beforePan = afterTouch.header;
  await evalJson(`new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;resolve(1);};window.__ypMap.once('moveend',finish);window.__ypMap.panBy([420,40]);setTimeout(finish,1500);})`);
  const afterPan = await chosen();
  const searchBox = await boxOf('yp-search-area');
  await cdp.send('Input.dispatchMouseEvent', {type: 'mousePressed', x: searchBox.x, y: searchBox.y, button: 'left', clickCount: 1}, sessionId);
  await cdp.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: searchBox.x, y: searchBox.y, button: 'left', clickCount: 1}, sessionId);
  await delay(200);
  const afterSearch = await chosen();
  await evalJson(`ypShowWherePopup();1`);
  await evalJson(`(()=>{window.ypGeoKey='preview-test';const body={results:[{name:'Roma',state:'Queensland',country:'Australia',country_code:'au',lon:148.787,lat:-26.571,result_type:'suburb',place_id:'51roma0001',formatted:'Roma, Queensland, Australia'}]};const orig=window.fetch;window.fetch=function(url,opts){if(!String(url).includes('/v1/geocode/autocomplete'))return orig.apply(this,arguments);return Promise.resolve(new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}}));};return 1;})()`);
  await evalJson(`(()=>{const i=document.getElementById('yp-where-town');i.focus();i.value='roma';i.dispatchEvent(new Event('input',{bubbles:true}));return 1;})()`);
  await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(document.getElementById('yp-where-opt-0'))r(1);else if(Date.now()-t>4000)r(0);else setTimeout(tick,50)};tick()})`);
  const inlandBox = await boxOf('yp-where-opt-0');
  await cdp.send('Input.dispatchMouseEvent', {type: 'mousePressed', x: inlandBox.x, y: inlandBox.y, button: 'left', clickCount: 1}, sessionId);
  await cdp.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: inlandBox.x, y: inlandBox.y, button: 'left', clickCount: 1}, sessionId);
  await delay(250);
  const inland = await chosen();
  const report = {label, rest, hover, focus, pressed, afterClick, keyedStyle, afterKey, touchPressed, afterTouch, beforePan, afterPan, afterSearch, inland, errors: cdp.errors.slice(0, 6)};
  writeFileSync(`${OUT}/suggestion-affordance.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  const near = (s) => s && !s.popup && String(s.label).includes('Bargara') && String(s.header).includes('Bargara') && Math.abs(s.lon - 152.464) < 0.01 && Math.abs(s.lat + 24.814) < 0.01 && s.note.includes('No mapped buildings') && s.pins === 0 && !s.list && !s.note.startsWith('Selected:');
  const ok = label === 'Bargara, Queensland, Australia'
    && rest.cursor === 'pointer' && rest.bg === 'rgb(231, 240, 255)'
    && hover.bg === 'rgb(212, 228, 255)' && hover.bg !== rest.bg
    && focus.outline !== 'none' && focus.outlineW !== '0px'
    && pressed.bg === 'rgb(197, 217, 251)'
    && near(afterClick) && afterClick.fresh === 1
    && keyedStyle.bg === 'rgb(212, 228, 255)' && near(afterKey)
    && touchPressed.bg === 'rgb(197, 217, 251)' && near(afterTouch)
    && afterPan.header === beforePan && afterPan.label.includes('Bargara')
    && afterSearch.header.startsWith('Searched area ') && !afterSearch.header.includes('Bargara') && afterSearch.pins === 0
    && inland.header.includes('Roma') && inland.pins === 0 && !inland.popup && Math.abs(inland.lon - 148.787) < 0.01
    && cdp.errors.length === 0;
  if (!ok) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  chrome.kill('SIGTERM');
}
