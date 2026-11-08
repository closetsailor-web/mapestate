import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const OUT = '/opt/cursor/artifacts/map-preview';
mkdirSync(OUT, {recursive: true});
const server = spawn('python3', ['preview/localhost-server.py', '--port', '8769'], {cwd: '/workspace', stdio: 'ignore'});
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=9242', '--user-data-dir=/tmp/chrome-yp-buildings', 'about:blank',
], {stdio: 'ignore'});

async function browserWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const info = await (await fetch('http://127.0.0.1:9242/json/version')).json();
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
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 800));
  return result.result.value;
}

try {
  await cdp.send('Page.navigate', {url: 'http://127.0.0.1:8769/?fresh=1'}, sessionId);
  const ready = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof flowFinish==='function')r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,100)};tick()})`);
  if (!ready) throw new Error('page did not boot');
  await evalJson(`(()=>{G.hwSeen=1;flowFinish({nick:'bargara',band:7,view:'week',exp:{freq:'week',items:{},yearly:{}},start:'Glimmerbrook'});document.getElementById('st_rent').click();document.getElementById('st_go').click();document.getElementById('st_lease12').click();document.getElementById('st_go').click();ypChooseTown({label:'Bargara, Queensland, Australia',lon:152.464,lat:-24.814});return 1;})()`);
  const mapReady = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(window.__ypMap&&window.__ypMap.isStyleLoaded&&window.__ypMap.isStyleLoaded())r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,100)};tick()})`);
  const placed = await evalJson(`(()=>{
    const house=(lon,lat)=>{const s=0.00012;return [[lon,lat],[lon+s,lat],[lon+s,lat+s],[lon,lat+s],[lon,lat]];};
    const centre={lon:152.464,lat:-24.814};
    const west=ypDestination(centre.lon,centre.lat,270,400);
    const west2=ypDestination(centre.lon,centre.lat,300,650);
    const splitA=ypDestination(centre.lon,centre.lat,240,280);
    const splitB=ypDestination(centre.lon,centre.lat,210,420);
    const houses=[house(west.lon,west.lat),house(west2.lon,west2.lat),house(splitA.lon,splitA.lat),house(splitB.lon,splitB.lat)];
    for(let i=0;i<4;i++){const p=ypDestination(centre.lon,centre.lat,250+i*8,500+i*80);houses.push(house(p.lon,p.lat));}
    const park=[[152.474,-24.812],[152.480,-24.812],[152.480,-24.806],[152.474,-24.806],[152.474,-24.812]];
    const gap={lon:(splitA.lon+splitB.lon)/2,lat:(splitA.lat+splitB.lat)/2};
    const map=window.__ypMap;
    const features=houses.map(ring=>({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[ring]}}));
    features.push({type:'Feature',properties:{},geometry:{type:'MultiPolygon',coordinates:[[house(splitA.lon-0.001,splitA.lat)],[house(splitB.lon-0.001,splitB.lat)]]}});
    map.addSource('yp-test-buildings',{type:'geojson',data:{type:'FeatureCollection',features}});
    map.addLayer({id:'building',type:'fill',source:'yp-test-buildings',paint:{'fill-color':'#c4b7a6','fill-opacity':0.9}});
    map.addSource('yp-test-park',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[park]}}});
    map.addLayer({id:'park',type:'fill',source:'yp-test-park',paint:{'fill-color':'#b7d7a8','fill-opacity':0.8}});
    return new Promise(resolve=>{
      const finish=()=>{ypApplyPlacePins();
        const pins=JSON.parse(localStorage.getItem('yp.previewStock.v1')).rentals;
        const inside=(lon,lat,ring)=>ypPointInRing(lon,lat,ring);
        const rings=houses.concat([house(splitA.lon-0.001,splitA.lat),house(splitB.lon-0.001,splitB.lat)]);
        const queried=map.querySourceFeatures('yp-test-buildings')||[];
        resolve({count:pins.length,onHouse:pins.filter(p=>rings.some(ring=>inside(p.lon,p.lat,ring))).length,onPark:pins.filter(p=>inside(p.lon,p.lat,park)).length,inGap:pins.filter(p=>ypDistanceM(gap.lon,gap.lat,p.lon,p.lat)<20).length,max:pins.length?Math.max(...pins.map(p=>ypDistanceM(centre.lon,centre.lat,p.lon,p.lat))):null,ids:pins.map(p=>p.id),queried:queried.length,layer:!!map.getLayer('building')});
      };
      map.once('idle',finish);
      setTimeout(finish,4000);
    });
  })()`);
  console.log(JSON.stringify({mapReady, placed, errors: cdp.errors.slice(0, 4)}, null, 2));
  const ok = mapReady === 1 && placed.count === 10 && placed.onHouse === 10 && placed.onPark === 0 && placed.inGap === 0 && placed.max <= 2000 && new Set(placed.ids).size === 10 && cdp.errors.length === 0;
  if (!ok) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  chrome.kill('SIGTERM');
}
