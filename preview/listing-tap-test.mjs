// A touch on a filled listing at street zoom opens that rental, not the building card.
// The listing dot stays visible after the old zoom-15 cutoff, and a tap on the dot still opens the rental.
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'preview-406b69525cf5');
const outDir = '/opt/cursor/artifacts';
const port = 8876;
const debugPort = 9356;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: root, stdio: 'ignore'});
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', `--remote-debugging-port=${debugPort}`, '--user-data-dir=/tmp/chrome-yp-listing-tap', 'about:blank'], {stdio: 'ignore'});
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
  await cdp.send('Network.enable', {}, sessionId);
  await cdp.send('Network.setCacheDisabled', {cacheDisabled: true}, sessionId);
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  async function evalJson(expression){
    const result = await cdp.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, sessionId);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 1500));
    return result.result.value;
  }
  async function shot(name){
    await evalJson(`(()=>{document.getElementById('yp-where')?.remove();document.getElementById('yp-chosen-note')?.remove();const t=document.getElementById('toast');if(t)t.classList.remove('show');return 1;})()`);
    await evalJson(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const image = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
    writeFileSync(path.join(outDir, name), Buffer.from(image.data, 'base64'));
  }
  async function touch(x, y){
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x, y, id: 1}]}, sessionId);
    await delay(50);
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []}, sessionId);
    await delay(450);
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
  await cdp.send('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 1}, sessionId);
  await cdp.send('Page.navigate', {url: `http://127.0.0.1:${port}/?v=${Date.now()}`}, sessionId);
  const booted = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof ypChooseTown==='function')r(1);else if(Date.now()-t>30000)r(0);else setTimeout(tick,100)};tick()})`);
  if (!booted) problems.push('page did not boot');
  await evalJson(`(()=>{document.getElementById('flow')?.remove();document.getElementById('status')?.remove();document.getElementById('hwov')?.remove();const board=document.getElementById('picker');if(board)board.style.display='none';return 1;})()`);
  await evalJson(`ypUseMap()`);
  await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(window.__ypMap){ypChooseTown({label:'Bargara',name:'Bargara',lon:152.4632,lat:-24.8186});r(1);}else if(Date.now()-t>25000)r(0);else setTimeout(tick,200)};tick()})`);
  const ready = await evalJson(`new Promise(r=>{const t=Date.now();let last=-1,same=0;ypMap.jumpTo({center:[152.461717,-24.822881],zoom:14,animate:false});const tick=()=>{try{ypApplyPlacePins();}catch(e){}const pool=ypAdoptedHomes(window.__ypListCentre).length;const n=ypRadiusList(ypReadStock(),window.__ypListCentre).items.filter(it=>it.footprintId).length;const feet=!!ypMap.getLayer('ypb-fill');if(pool===last&&pool>0)same++;else same=0;last=pool;if(feet&&n>=10&&pool>=200&&same>=2)r({n,pool});else if(Date.now()-t>45000)r({n,pool,timeout:1});else setTimeout(tick,500)};tick()})`);
  if (!(ready && ready.n >= 10)) problems.push('listings '+JSON.stringify(ready));
  const dotLayer = await evalJson(`(()=>{const layer=(ypMap.getStyle().layers||[]).find(l=>l.id==='yp-rental-point');return {maxzoom:layer&&layer.maxzoom,radius:ypMap.getPaintProperty('yp-rental-point','circle-radius')};})()`);
  if (dotLayer.maxzoom != null) problems.push('dot still has maxzoom '+dotLayer.maxzoom);
  await evalJson(`ypMap.jumpTo({center:[152.461717,-24.822881],zoom:14,animate:false});1`);
  await evalJson(`new Promise(r=>{ypMap.once('idle',()=>setTimeout(()=>r(1),400));setTimeout(()=>r(0),8000);})`);
  await shot('listing-zoom14-390x844.png');
  const house = await evalJson(`(()=>{const items=ypRadiusList(ypReadStock(),window.__ypListCentre).items;const feats=window.__ygParts.adopted.features;let best=items[0],bestN=-1;for(const r of items){let n=0;for(const f of feats){const p=f.geometry.coordinates[0][0];if(ypDistanceM(r.lon,r.lat,p[0],p[1])<70)n++;}if(n>bestN){best=r;bestN=n;}}return {id:best.id,lon:best.lon,lat:best.lat};})()`);
  await evalJson(`ypMap.jumpTo({center:[${house.lon},${house.lat}],zoom:15,animate:false});1`);
  await evalJson(`new Promise(r=>{ypMap.once('idle',()=>setTimeout(()=>r(1),500));setTimeout(()=>r(0),8000);})`);
  await evalJson(`ypApplyPlacePins();1`);
  const at15 = await evalJson(`(()=>{const rental=ypRadiusList(ypReadStock(),window.__ypListCentre).items.find(r=>r.id==='${house.id}');const p=ypMap.project([rental.lon,rental.lat]);const rect=ypMap.getCanvas().getBoundingClientRect();const pt=[p.x,p.y];const count=id=>ypMap.getLayer(id)?ypMap.queryRenderedFeatures(pt,{layers:[id]}).length:0;return {zoom:+ypMap.getZoom().toFixed(2),fill:count('yp-listing-fill'),dot:count('yp-rental-point'),x:rect.left+p.x,y:rect.top+p.y};})()`);
  if (!(at15.zoom === 15 && at15.dot > 0 && at15.fill > 0)) problems.push('zoom 15 marker '+JSON.stringify(at15));
  await shot('listing-zoom15-390x844.png');
  await touch(at15.x + 10, at15.y);
  const dotTap = await evalJson(`({rent:document.getElementById('yp-rent-detail')?.dataset.ypId||'',building:!!document.getElementById('yp-building')})`);
  if (dotTap.rent !== house.id || dotTap.building) problems.push('zoom 15 dot tap '+JSON.stringify(dotTap));
  await evalJson(`document.getElementById('yp-rent-detail')?.remove();1`);
  await delay(500);
  await evalJson(`ypMap.jumpTo({center:[${house.lon},${house.lat}],zoom:17.2,animate:false});1`);
  await evalJson(`new Promise(r=>{ypMap.once('idle',()=>setTimeout(()=>r(1),500));setTimeout(()=>r(0),8000);})`);
  await evalJson(`ypApplyPlacePins();1`);
  const atStreet = await evalJson(`(()=>{const rental=ypRadiusList(ypReadStock(),window.__ypListCentre).items.find(r=>r.id==='${house.id}');const centre=ypMap.project([rental.lon,rental.lat]);const ring=rental.geometry.coordinates[0];const lon=rental.lon*0.7+ring[0][0]*0.3,lat=rental.lat*0.7+ring[0][1]*0.3;const inside=ypPointInRing(lon,lat,ring);const use=inside?[lon,lat]:[rental.lon,rental.lat];const p=ypMap.project(use);const rect=ypMap.getCanvas().getBoundingClientRect();const count=(pt,id)=>ypMap.getLayer(id)?ypMap.queryRenderedFeatures(pt,{layers:[id]}).length:0;return {zoom:+ypMap.getZoom().toFixed(2),fill:count([p.x,p.y],'yp-listing-fill'),dot:count([centre.x,centre.y],'yp-rental-point'),inside,x:rect.left+p.x,y:rect.top+p.y};})()`);
  if (!(atStreet.zoom > 17 && atStreet.fill > 0 && atStreet.dot > 0 && atStreet.inside)) problems.push('street marker '+JSON.stringify(atStreet));
  await shot('listing-street-390x844.png');
  await touch(atStreet.x, atStreet.y);
  const houseTap = await evalJson(`({rent:document.getElementById('yp-rent-detail')?.dataset.ypId||'',building:!!document.getElementById('yp-building'),title:document.getElementById('yp-listing-title')?.textContent||''})`);
  if (houseTap.rent !== house.id || houseTap.building || !houseTap.title) problems.push('street tap '+JSON.stringify(houseTap));
  await shot('listing-card-tap-390x844.png');
  if (problems.length) { console.error(problems.join('\n')); await finish(1); }
  else { console.log('PASS listing tap', {at15, atStreet, title: houseTap.title}); await finish(0); }
} catch (error) {
  console.error(error);
  await finish(1);
}
