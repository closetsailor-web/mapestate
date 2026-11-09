import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const here = dirname(fileURLToPath(import.meta.url));

const OUT = '/opt/cursor/artifacts/overture-preview';
mkdirSync(OUT, {recursive: true});
const server = spawn('python3', [resolve(here, 'server.py'), '--port', '8767'], {cwd: here, env: {...process.env, MAPTILER_TEST_API_KEY: ''}, stdio: 'ignore'});
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=9247', '--user-data-dir=/tmp/chrome-yp-overture', 'about:blank'
], {stdio: 'ignore'});

async function browserWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const info = await (await fetch('http://127.0.0.1:9247/json/version')).json();
      if (info.webSocketDebuggerUrl) return info.webSocketDebuggerUrl;
    } catch {}
    await delay(250);
  }
  throw new Error('Chrome debugging port did not open');
}
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }
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
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
const cdp = new CDP(ws);
ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.id && cdp.pending.has(msg.id)) {
    const pending = cdp.pending.get(msg.id);
    cdp.pending.delete(msg.id);
    msg.error ? pending.reject(new Error(JSON.stringify(msg.error))) : pending.resolve(msg.result);
  }
});
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
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 900, height: 700, deviceScaleFactor: 1, mobile: false}, sessionId);
  await cdp.send('Page.navigate', {url: 'http://127.0.0.1:8767/'}, sessionId);
  const ready = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{const view=window.__ypView;if(view&&view.features>0&&window.__ypMap?.getSource('ypb-buildings'))r(view);else if(Date.now()-t>25000)r(0);else setTimeout(tick,150)};tick()})`);
  if (!ready) throw new Error('overlay did not load');
  const point = await evalJson(`(async()=>{
    const map=window.__ypMap;
    map.resize();
    const inside=(lon,lat,ring)=>{let on=false, inn=false; for(let i=0;i<ring.length-1;i++){const a=ring[i],b=ring[i+1];const cross=(lat-a[1])*(b[0]-a[0])-(lon-a[0])*(b[1]-a[1]); if(Math.abs(cross)<1e-12 && lon>=Math.min(a[0],b[0])&&lon<=Math.max(a[0],b[0])&&lat>=Math.min(a[1],b[1])&&lat<=Math.max(a[1],b[1]))on=true;} if(on)return false; for(let i=0,j=ring.length-1;i<ring.length;j=i++){const yi=ring[i][1],yj=ring[j][1],xi=ring[i][0],xj=ring[j][0]; if((yi>lat)!==(yj>lat)&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi))inn=!inn;} return inn;};
    const features=map.getSource('ypb-buildings')._data.features.filter(f=>f.geometry.type==='Polygon' && f.properties.gameId==='ypb-3be0a2ac226ef07bee0a8a8115b3cf2d');
    let chosen=null, center=null;
    for (const feature of features) {
      const ring=feature.geometry.coordinates[0];
      for (let i=0;i<ring.length-1;i++){
        const mid=[(ring[i][0]+ring[i+1][0])/2,(ring[i][1]+ring[i+1][1])/2];
        const inset=[(mid[0]+ring[0][0])/2,(mid[1]+ring[0][1])/2];
        if (inside(inset[0],inset[1],ring)) {chosen=feature; center=inset; break;}
      }
      if (chosen) break;
    }
    map.jumpTo({center, zoom:18});
    await new Promise(resolve=>map.once('idle', resolve));
    const projected=map.project(center);
    const hits=map.queryRenderedFeatures(projected,{layers:['ypb-fill']});
    const rect=map.getCanvas().getBoundingClientRect();
    return {gameId:chosen.properties.gameId, gersId:chosen.properties.gersId, x:rect.left+projected.x, y:rect.top+projected.y, hits:hits.map(h=>h.properties.gameId)};
  })()`);
  await cdp.send('Input.dispatchMouseEvent', {type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1}, sessionId);
  await cdp.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1}, sessionId);
  await delay(400);
  await evalJson(`document.querySelector('#panel header p').textContent='Stand-in test view. Not the live MapTiler basemap.'`);
  const selected = await evalJson(`({game:document.getElementById('game-id').textContent, estimate:document.getElementById('estimate').textContent, meta:document.getElementById('meta').textContent, status:document.getElementById('status').textContent})`);
  const image = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
  writeFileSync(`${OUT}/selected-building.png`, Buffer.from(image.data, 'base64'));
  const styled = await evalJson(`(async()=>{
    const map=window.__ypMap;
    const before={game:document.getElementById('game-id').textContent, estimate:document.getElementById('estimate').textContent};
    map.setStyle({version:8,name:'labeled-test-basemap-not-maptiler',sources:{fake:{type:'geojson',data:{type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[[152.30,-24.90],[152.40,-24.90],[152.40,-24.84],[152.30,-24.84],[152.30,-24.90]]]}}]}}},layers:[{id:'bg',type:'background',paint:{'background-color':'#d7e7c8'}},{id:'building',type:'fill',source:'fake',paint:{'fill-color':'#9aa', 'fill-opacity':0.85}}]});
    const deadline=Date.now()+8000;
    while(Date.now()<deadline && !map.getLayer('ypb-fill')) await new Promise(r=>setTimeout(r,100));
    await new Promise(r=>map.once('idle', r));
    const feature=map.getSource('ypb-buildings')._data.features.find(f=>f.properties.gameId==='${point.gameId}');
    const ring=feature.geometry.coordinates[0];
    const inside=(lon,lat,ring)=>{let on=false, inn=false; for(let i=0;i<ring.length-1;i++){const a=ring[i],b=ring[i+1];const cross=(lat-a[1])*(b[0]-a[0])-(lon-a[0])*(b[1]-a[1]); if(Math.abs(cross)<1e-12 && lon>=Math.min(a[0],b[0])&&lon<=Math.max(a[0],b[0])&&lat>=Math.min(a[1],b[1])&&lat<=Math.max(a[1],b[1]))on=true;} if(on)return false; for(let i=0,j=ring.length-1;i<ring.length;j=i++){const yi=ring[i][1],yj=ring[j][1],xi=ring[i][0],xj=ring[j][0]; if((yi>lat)!==(yj>lat)&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi))inn=!inn;} return inn;};
    let center=null;
    for (let i=0;i<ring.length-1;i++){const mid=[(ring[i][0]+ring[i+1][0])/2,(ring[i][1]+ring[i+1][1])/2]; const inset=[(mid[0]*2+ring[0][0])/3,(mid[1]*2+ring[0][1])/3]; if(inside(inset[0],inset[1],ring)){center=inset;break;}}
    map.jumpTo({center, zoom:18});
    await new Promise(r=>map.once('idle', r));
    const projected=map.project(center);
    const hits=map.queryRenderedFeatures(projected,{layers:['ypb-fill']});
    const vendor=map.getLayer('building');
    const rect=map.getCanvas().getBoundingClientRect();
    const kept=map.getSource('ypb-selected')._data.features[0];
    return {x:rect.left+projected.x,y:rect.top+projected.y,hits:hits.map(h=>h.properties.gameId),overlay:!!map.getLayer('ypb-fill'),vendorHidden:!vendor || vendor.visibility==='none' || (map.getLayoutProperty('building','visibility')==='none'), keptGame:document.getElementById('game-id').textContent, keptEstimate:document.getElementById('estimate').textContent, keptSelected:kept&&kept.properties.gameId, before};
  })()`);
  await cdp.send('Input.dispatchMouseEvent', {type: 'mousePressed', x: styled.x, y: styled.y, button: 'left', clickCount: 1}, sessionId);
  await cdp.send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: styled.x, y: styled.y, button: 'left', clickCount: 1}, sessionId);
  await delay(400);
  const styledSelected = await evalJson(`document.getElementById('game-id').textContent`);
  const styledImage = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
  writeFileSync(`${OUT}/selected-building-test-basemap.png`, Buffer.from(styledImage.data, 'base64'));
  await evalJson(`document.querySelector('#panel header p').textContent='Stand-in test view. Not the live MapTiler basemap.'`);
  const places = await evalJson(`(async()=>{
    const map=window.__ypMap;
    const go=async(bounds)=>{const t=performance.now();window.__ypView=null;map.fitBounds(bounds,{padding:{left:480,right:36,top:28,bottom:40},duration:0,maxZoom:16});await new Promise(r=>map.once('idle',r));const deadline=Date.now()+8000;while(Date.now()<deadline && !window.__ypView)await new Promise(r=>setTimeout(r,50));return {bounds,view:window.__ypView,ms:Math.round(performance.now()-t)};};
    const suburb=await go([[152.45,-24.85],[152.5,-24.8]]);
    return {suburb};
  })()`);
  const suburbImage = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
  writeFileSync(`${OUT}/suburb-bargara-stand-in.png`, Buffer.from(suburbImage.data, 'base64'));
  const rural = await evalJson(`(async()=>{const map=window.__ypMap;const t=performance.now();window.__ypView=null;map.fitBounds([[151.65,-24.8],[151.7,-24.75]],{padding:{left:480,right:36,top:28,bottom:40},duration:0,maxZoom:16});await new Promise(r=>map.once('idle',r));const deadline=Date.now()+8000;while(Date.now()<deadline && !window.__ypView)await new Promise(r=>setTimeout(r,50));return {view:window.__ypView,ms:Math.round(performance.now()-t)};})()`);
  const ruralImage = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
  writeFileSync(`${OUT}/rural-west-stand-in.png`, Buffer.from(ruralImage.data, 'base64'));
  await evalJson(`document.querySelector('#panel header p').textContent='Council boundary. Stand-in view, not the live MapTiler basemap. Zoom in to load buildings.'`);
  const region = await evalJson(`(async()=>{const map=window.__ypMap;const t=performance.now();window.__ypView=null;map.fitBounds([[151.341793,-25.4313055],[152.6330215,-24.5137614]],{padding:40,duration:0});await new Promise(r=>map.once('idle',r));const deadline=Date.now()+8000;while(Date.now()<deadline && !(window.__ypView&&window.__ypView.wide))await new Promise(r=>setTimeout(r,50));return {view:window.__ypView,ms:Math.round(performance.now()-t)};})()`);
  const coverage = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
  writeFileSync(`${OUT}/coverage-bundaberg-region.png`, Buffer.from(coverage.data, 'base64'));
  places.rural = rural;
  places.region = region;
  const failed = await evalJson(`(async()=>{
    const map=window.__ypMap;
    map.setStyle('http://127.0.0.1:8767/missing-style.json');
    const deadline=Date.now()+8000;
    while(Date.now()<deadline && !map.getLayer('ypb-fill')) await new Promise(r=>setTimeout(r,100));
    return {overlay:!!map.getLayer('ypb-fill'), status:document.getElementById('status').textContent};
  })()`);
  const report = {ready, expected: point.gameId, selected, hits: point.hits, styled, styledSelected, places, failed};
  console.log(JSON.stringify(report, null, 2));
  const priced = selected.estimate === '$1,152,835';
  const ok = selected.game === point.gameId && selected.status === 'Selected building' && priced && selected.meta.includes('Game estimate') && point.hits.includes(point.gameId)
    && styled.overlay && styled.vendorHidden && styled.hits.includes(point.gameId) && styledSelected === point.gameId
    && styled.keptGame === point.gameId && styled.keptEstimate === selected.estimate && styled.keptSelected === point.gameId
    && places.suburb.view.features > 0 && places.rural.view.features > 0 && places.region.view.wide === true
    && failed.overlay;
  if (!ok) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  chrome.kill('SIGTERM');
}
