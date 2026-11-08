import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const OUT = '/opt/cursor/artifacts/overture-preview';
mkdirSync(OUT, {recursive: true});
const server = spawn('python3', ['overture-preview/server.py', '--port', '8767'], {cwd: '/workspace', stdio: 'ignore'});
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
  const ready = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{const text=document.getElementById('status')?.textContent||'';if(text.includes('adopted')&&window.__ypMap?.getSource('ypb-buildings'))r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,150)};tick()})`);
  if (!ready) throw new Error('overlay did not load');
  const point = await evalJson(`(async()=>{
    const map=window.__ypMap;
    map.resize();
    const inside=(lon,lat,ring)=>{let on=false, inn=false; for(let i=0;i<ring.length-1;i++){const a=ring[i],b=ring[i+1];const cross=(lat-a[1])*(b[0]-a[0])-(lon-a[0])*(b[1]-a[1]); if(Math.abs(cross)<1e-12 && lon>=Math.min(a[0],b[0])&&lon<=Math.max(a[0],b[0])&&lat>=Math.min(a[1],b[1])&&lat<=Math.max(a[1],b[1]))on=true;} if(on)return false; for(let i=0,j=ring.length-1;i<ring.length;j=i++){const yi=ring[i][1],yj=ring[j][1],xi=ring[i][0],xj=ring[j][0]; if((yi>lat)!==(yj>lat)&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi))inn=!inn;} return inn;};
    const features=map.getSource('ypb-buildings')._data.features.filter(f=>f.geometry.type==='Polygon');
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
  const selected = await evalJson(`({game:document.getElementById('game-id').textContent, meta:document.getElementById('meta').textContent, status:document.getElementById('status').textContent})`);
  const image = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
  writeFileSync(`${OUT}/selected-building.png`, Buffer.from(image.data, 'base64'));
  const first = await fetch('http://127.0.0.1:8767/api/claim', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({gameId:point.gameId, playerId:'player-a', role:'owner'})});
  const second = await fetch('http://127.0.0.1:8767/api/claim', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({gameId:point.gameId, playerId:'player-b', role:'owner'})});
  const report = {expected: point.gameId, selected, first: first.status, second: second.status, body: await second.json()};
  console.log(JSON.stringify(report, null, 2));
  const ok = selected.game === point.gameId && selected.meta.includes(point.gersId) && first.status === 200 && second.status === 409;
  if (!ok) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  chrome.kill('SIGTERM');
}
