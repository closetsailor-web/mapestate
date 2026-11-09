import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

mkdirSync('/opt/cursor/artifacts/map-preview', {recursive: true});
const server = spawn('python3', ['preview/localhost-server.py', '--port', '8770'], {cwd: '/workspace', stdio: 'ignore'});
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=9243', '--user-data-dir=/tmp/chrome-yp-spread', 'about:blank',
], {stdio: 'ignore'});

async function browserWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const info = await (await fetch('http://127.0.0.1:9243/json/version')).json();
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
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 900));
  return result.result.value;
}

try {
  await cdp.send('Page.navigate', {url: 'http://127.0.0.1:8770/?fresh=1'}, sessionId);
  const ready = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof flowFinish==='function')r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,100)};tick()})`);
  if (!ready) throw new Error('page did not boot');
  await evalJson(`(()=>{G.hwSeen=1;flowFinish({nick:'spread',band:7,view:'week',exp:{freq:'week',items:{},yearly:{}},start:'Glimmerbrook'});document.getElementById('st_rent').click();document.getElementById('st_go').click();document.getElementById('st_lease12').click();document.getElementById('st_go').click();ypChooseTown({label:'Bargara, Queensland, Australia',lon:152.464,lat:-24.814});return 1;})()`);
  const mapReady = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(window.__ypMap&&window.__ypMap.isStyleLoaded&&window.__ypMap.isStyleLoaded())r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,100)};tick()})`);
  const report = await evalJson(`(async()=>{
    const house=(lon,lat)=>{const s=0.00012;return [[lon,lat],[lon+s,lat],[lon+s,lat+s],[lon,lat+s],[lon,lat]];};
    const centre={lon:152.464,lat:-24.814};
    const ringAt=(lon,lat)=>house(lon,lat);
    const grid=[];
    for(let x=-2;x<=2;x++)for(let y=-2;y<=2;y++){
      const north=ypDestination(centre.lon,centre.lat,0,y*700);
      const point=ypDestination(north.lon,north.lat,90,x*700);
      grid.push(ringAt(point.lon,point.lat));
    }
    const far=ypDestination(centre.lon,centre.lat,90,3200);
    const far2=ypDestination(centre.lon,centre.lat,45,3500);
    const outside=[ringAt(far.lon,far.lat),ringAt(far2.lon,far2.lat)];
    const park=[[152.49,-24.80],[152.50,-24.80],[152.50,-24.79],[152.49,-24.79],[152.49,-24.80]];
    const feature=ring=>({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[ring]}});
    const map=window.__ypMap;
    const full=grid.concat(outside).map(feature);
    map.addSource('yp-test-buildings',{type:'geojson',data:{type:'FeatureCollection',features:full}});
    map.addLayer({id:'building',type:'fill',source:'yp-test-buildings',paint:{'fill-color':'#c4b7a6','fill-opacity':0.9}});
    map.addSource('yp-test-park',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[park]}}});
    map.addLayer({id:'park',type:'fill',source:'yp-test-park',paint:{'fill-color':'#b7d7a8','fill-opacity':0.8}});
    await new Promise(r=>{map.once('idle',()=>setTimeout(r,200));setTimeout(r,4000);});
    const snap=()=>{
      const place=window.__ypListCentre;
      const list=ypRadiusList(ypReadStock(),place).items;
      const raw=map.getSource('yp-rentals')._data;
      const features=(raw&&raw.features)||[];
      return {label:place.label,lon:+place.lon,lat:+place.lat,list:list.map(r=>r.id).sort(),map:features.map(f=>f.properties.id).sort(),max:list.length?Math.max(...list.map(r=>ypDistanceM(place.lon,place.lat,r.lon,r.lat))):null,farPins:list.filter(r=>ypDistanceM(place.lon,place.lat,r.lon,r.lat)>2000).length,spread:list.filter(r=>ypDistanceM(centre.lon,centre.lat,r.lon,r.lat)>1200).length,stored:ypReadStock().rentals.length};
    };
    ypApplyPlacePins();
    ypApplyPlacePins();
    const committed=snap();
    ypApplyPlacePins();
    const frozen=snap();
    const seenOutside=(map.querySourceFeatures('yp-test-buildings')||[]).filter(f=>{const c=f.geometry.coordinates[0][0];return ypDistanceM(centre.lon,centre.lat,c[0],c[1])>2500;}).length;
    return {committed,frozen,seenOutside,queried:(map.querySourceFeatures('yp-test-buildings')||[]).length};
  })()`);
  const zoomed = await evalJson(`(async()=>{
    const map=window.__ypMap;
    const centre={lon:152.464,lat:-24.814};
    const house=(lon,lat)=>{const s=0.00012;return [[lon,lat],[lon+s,lat],[lon+s,lat+s],[lon,lat+s],[lon,lat]];};
    const extra=[];
    for(let i=0;i<8;i++){const p=ypDestination(centre.lon,centre.lat,20+i*15,4000+i*200);extra.push({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[house(p.lon,p.lat)]}});}
    const current=map.getSource('yp-test-buildings')._data;
    const features=(current.features||[]).concat(extra);
    map.getSource('yp-test-buildings').setData({type:'FeatureCollection',features});
    map.jumpTo({center:[centre.lon,centre.lat],zoom:8});
    await new Promise(r=>{map.once('idle',()=>setTimeout(r,700));setTimeout(r,4000);});
    const place=window.__ypListCentre;
    const list=ypRadiusList(ypReadStock(),place).items;
    const raw=map.getSource('yp-rentals')._data;
    const mapIds=((raw&&raw.features)||[]).map(f=>f.properties.id).sort();
    const loaded=(map.getSource('yp-test-buildings')._data.features||[]);
    const loadedOutside=loaded.filter(f=>{const c=f.geometry.coordinates[0][0];return ypDistanceM(centre.lon,centre.lat,c[0],c[1])>2500;}).length;
    const queriedNow=map.querySourceFeatures('yp-test-buildings')||[];
    const cacheOutside=queriedNow.filter(f=>{const c=f.geometry&&f.geometry.coordinates&&f.geometry.coordinates[0]&&f.geometry.coordinates[0][0];return c&&ypDistanceM(centre.lon,centre.lat,c[0],c[1])>2500;}).length;
    let clusters=[];try{clusters=map.queryRenderedFeatures({layers:['yp-rental-cluster']}).map(f=>f.properties.point_count);}catch(e){}
    map.jumpTo({center:[centre.lon,centre.lat],zoom:15});
    await new Promise(r=>{map.once('idle',()=>setTimeout(r,700));setTimeout(r,4000);});
    const zoomIn=ypRadiusList(ypReadStock(),window.__ypListCentre).items.map(r=>r.id).sort();
    const beforePan={lon:window.__ypListCentre.lon,lat:window.__ypListCentre.lat,ids:zoomIn};
    map.jumpTo({center:[centre.lon+0.03,centre.lat+0.02],zoom:13});
    await new Promise(r=>{map.once('idle',()=>setTimeout(r,700));setTimeout(r,4000);});
    const afterPan={lon:window.__ypListCentre.lon,lat:window.__ypListCentre.lat,ids:ypRadiusList(ypReadStock(),window.__ypListCentre).items.map(r=>r.id).sort()};
    map.jumpTo({center:[centre.lon,centre.lat],zoom:13});
    ypSearchArea();ypSearchArea();
    const repeated={lon:window.__ypListCentre.lon,lat:window.__ypListCentre.lat,ids:ypRadiusList(ypReadStock(),window.__ypListCentre).items.map(r=>r.id).sort(),stored:ypReadStock().rentals.length};
    const other=ypDestination(centre.lon,centre.lat,0,15000);
    const otherHouses=[];
    for(let x=-2;x<=2;x++)for(let y=-2;y<=2;y++){const n=ypDestination(other.lon,other.lat,0,y*600);const p=ypDestination(n.lon,n.lat,90,x*600);otherHouses.push({type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[house(p.lon,p.lat)]}});}
    map.getSource('yp-test-buildings').setData({type:'FeatureCollection',features:otherHouses});
    map.jumpTo({center:[other.lon,other.lat],zoom:13});
    await new Promise(r=>{map.once('idle',()=>setTimeout(r,700));setTimeout(r,4000);});
    ypSearchArea();ypApplyPlacePins();
    const nextPlace=window.__ypListCentre;
    const nextList=ypRadiusList(ypReadStock(),nextPlace).items;
    const nextRaw=map.getSource('yp-rentals')._data;
    const nextMap=((nextRaw&&nextRaw.features)||[]).map(f=>f.properties.id).sort();
    return {zoom:map.getZoom(),loadedOutside,cacheOutside,queried:queriedNow.length,list:list.map(r=>r.id).sort(),mapIds,max:list.length?Math.max(...list.map(r=>ypDistanceM(place.lon,place.lat,r.lon,r.lat))):null,clusters,zoomIn,beforePan,afterPan,repeated,next:{label:nextPlace.label,lon:+nextPlace.lon,lat:+nextPlace.lat,list:nextList.map(r=>r.id).sort(),map:nextMap,max:nextList.length?Math.max(...nextList.map(r=>ypDistanceM(nextPlace.lon,nextPlace.lat,r.lon,r.lat))):null,oldShown:nextList.some(r=>String(r.id).includes('bargara'))||nextMap.some(id=>String(id).includes('bargara')),stored:ypReadStock().rentals.length}};
  })()`);
  console.log(JSON.stringify({mapReady, report, zoomed, errors: cdp.errors.slice(0, 4)}, null, 2));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const committed = report && report.committed;
  const ok = mapReady === 1
    && same(report.frozen.list, committed.list)
    && committed.list.length === 10
    && same(committed.list, committed.map)
    && committed.max <= 2000
    && committed.farPins === 0
    && committed.spread >= 4
    && report.seenOutside > 0
    && report.queried > 25
    && zoomed.loadedOutside > report.seenOutside
    && same(zoomed.list, committed.list)
    && same(zoomed.mapIds, committed.map)
    && zoomed.max <= 2000
    && !zoomed.clusters.includes(20)
    && same(zoomed.zoomIn, committed.list)
    && zoomed.afterPan.lon === zoomed.beforePan.lon
    && zoomed.afterPan.lat === zoomed.beforePan.lat
    && same(zoomed.afterPan.ids, committed.list)
    && same(zoomed.repeated.ids, committed.list)
    && zoomed.repeated.stored === 10
    && zoomed.next.list.length === 10
    && same(zoomed.next.list, zoomed.next.map)
    && zoomed.next.max <= 2000
    && zoomed.next.oldShown === false
    && zoomed.next.stored === 20
    && Math.abs(zoomed.next.lat - report.committed.lat) > 0.05
    && cdp.errors.length === 0;
  if (!ok) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  chrome.kill('SIGTERM');
}
