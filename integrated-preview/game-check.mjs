import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import http from 'node:http';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = '/opt/cursor/artifacts/integrated-preview';
mkdirSync(OUT, {recursive: true});
const port = 8774;
const fakeKey = 'maptiler-browser-test-key';

function request(method, path, headers, body) {
  return new Promise((resolvePromise, reject) => {
    const req = http.request({hostname: '127.0.0.1', port, path, method, headers}, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolvePromise({status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const server = spawn('python3', [resolve(here, 'server.py'), '--port', String(port)], {
  cwd: here,
  env: {...process.env, MAPTILER_TEST_API_KEY: '', GEOAPIFY_API_KEY: ''},
  stdio: 'ignore'
});
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=9248', '--user-data-dir=/tmp/chrome-yp-integrated', 'about:blank'
], {stdio: 'ignore'});

function browserWs() {
  return (async () => {
    for (let i = 0; i < 40; i++) {
      try {
        const info = await (await fetch('http://127.0.0.1:9248/json/version')).json();
        if (info.webSocketDebuggerUrl) return info.webSocketDebuggerUrl;
      } catch {}
      await delay(250);
    }
    throw new Error('Chrome debugging port did not open');
  })();
}

try {
  let up = false;
  for (let i = 0; i < 40; i++) {
    try { await request('GET', '/', {Host: `127.0.0.1:${port}`}); up = true; break; } catch { await delay(100); }
  }
  if (!up) throw new Error('server did not start');
  const same = {Host: `127.0.0.1:${port}`, Origin: `http://127.0.0.1:${port}`, 'Sec-Fetch-Site': 'same-origin'};
  const config = await request('GET', '/runtime-config', same);
  if (config.status !== 200 || JSON.parse(config.body).key !== '' || 'access-control-allow-origin' in config.headers) throw new Error('config');
  const foreign = await request('GET', '/runtime-config', {...same, Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site'});
  if (foreign.status !== 403) throw new Error('foreign');
  const claim = await request('POST', '/api/claim', {...same, 'Content-Type': 'application/json'}, '{}');
  if (claim.status !== 404) throw new Error('claim');
  const manifest = await request('GET', '/data/chunk-manifest.json', same);
  if (manifest.status !== 200) throw new Error('manifest ' + manifest.status);
  const manifestBody = JSON.parse(manifest.body);
  if (!Array.isArray(manifestBody.chunks) || !manifestBody.chunks.length) throw new Error('manifest empty');
  const boundary = await request('GET', '/data/boundary.geojson', same);
  if (boundary.status !== 200 || !boundary.body.includes('Feature')) throw new Error('boundary ' + boundary.status);
  const sampleChunk = manifestBody.chunks[0].id;
  const chunk = await request('GET', `/data/chunks/${sampleChunk}.json`, same);
  if (chunk.status !== 200 || !chunk.body.includes('Feature')) throw new Error('chunk ' + chunk.status);
  const page = await request('GET', '/', same);
  const script = await request('GET', '/map-preview.js', same);
  const layer = await request('GET', '/overture-layer.js', same);
  if (page.status !== 200 || script.status !== 200 || layer.status !== 200) throw new Error('pages');
  const escaped = await request('GET', '/data/chunks/../registry-v1.json', same);
  if (escaped.status === 200) throw new Error('traversal');

  const ws = new WebSocket(await browserWs());
  await new Promise((resolvePromise, reject) => { ws.addEventListener('open', resolvePromise); ws.addEventListener('error', reject); });
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const item = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? item.reject(new Error(JSON.stringify(msg.error))) : item.resolve(msg.result);
    }
  });
  const send = (method, params = {}, sessionId) => new Promise((resolvePromise, reject) => {
    const messageId = ++id;
    pending.set(messageId, {resolve: resolvePromise, reject});
    const payload = {id: messageId, method, params};
    if (sessionId) payload.sessionId = sessionId;
    ws.send(JSON.stringify(payload));
  });
  const {targetId} = await send('Target.createTarget', {url: 'about:blank'});
  const {sessionId} = await send('Target.attachToTarget', {targetId, flatten: true});
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  async function evalJson(expression) {
    const result = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, sessionId);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 900));
    return result.result.value;
  }
  async function shot(name) {
    const image = await send('Page.captureScreenshot', {format: 'png'}, sessionId);
    writeFileSync(`${OUT}/${name}`, Buffer.from(image.data, 'base64'));
  }
  await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 800, deviceScaleFactor: 1, mobile: false}, sessionId);
  await send('Page.navigate', {url: `http://127.0.0.1:${port}/?fresh=1`}, sessionId);
  const ready = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof flowFinish==='function'&&typeof ypEnterRealMap==='function')r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,100)};tick()})`);
  if (!ready) throw new Error('page did not boot');
  const boot = await evalJson(`(()=>{
    localStorage.setItem('fe.global', JSON.stringify({marker:'keep-v19'}));
    localStorage.setItem('yp.mapsel.v1', JSON.stringify({version:1,gameId:'yp-legacy-uuid',coordinate:[152.35,-24.86]}));
    G.hwSeen=1;
    flowFinish({nick:'list',band:7,view:'week',exp:{freq:'week',items:{},yearly:{}},start:'Glimmerbrook'});
    return {nav:[...document.querySelectorAll('nav button')].map(b=>b.innerText.replace(/\\s+/g,' ').trim())};
  })()`);
  await evalJson(`ypEnterRealMap()`);
  const loaded = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(window.__ygParts&&window.__ygParts.adopted.features.length)r(window.__ygView);else if(Date.now()-t>25000)r(0);else setTimeout(tick,150)};tick()})`);
  if (!loaded) {
    const diag = await evalJson(`({map:!!window.__ypMap, boot:window.__ygBoot||null, layer:window.__ygLayer||null, style:window.__ypMap&&window.__ypMap.isStyleLoaded&&window.__ypMap.isStyleLoaded(), visible:(()=>{const host=document.getElementById('map');if(!host)return false;const cs=getComputedStyle(host);return cs.display+' '+cs.visibility;})(), view:window.__ygView||null})`);
    throw new Error('buildings did not load ' + JSON.stringify(diag));
  }
  const opened = await evalJson(`(()=>{
    const id='ypb-3be0a2ac226ef07bee0a8a8115b3cf2d';
    const feature=window.__ygParts.adopted.features.find(f=>f.properties.gameId===id);
    if(!feature)return {missing:true};
    const ring=feature.geometry.coordinates[0];
    const lon=ring.reduce((s,p)=>s+p[0],0)/ring.length;
    const lat=ring.reduce((s,p)=>s+p[1],0)/ring.length;
    window.__ypMap.jumpTo({center:[lon,lat],zoom:17});
    ['status','hwov','gate','coach'].forEach(id=>document.getElementById(id)?.remove());
    window.__ygOpen(feature);
    const card=document.querySelector('#yp-building .yp-listing');
    return {estimate:document.getElementById('yp-building-estimate')?.textContent||'',title:document.getElementById('yp-building-title')?.textContent||'',text:card?card.innerText:'',apply:!!document.querySelector('#yp-building #yp-rent-apply'),saved:localStorage.getItem('yp.mapsel.v1'),fe:JSON.parse(localStorage.getItem('fe.global')).marker,real:window.__ypReadReal?window.__ypReadReal('fe.global'):'no-shim'};
  })()`);
  await evalJson(`(()=>{const n=document.createElement('p');n.id='yg-test-note';n.textContent='Stand-in basemap. Not the live MapTiler map.';n.style.cssText='position:fixed;left:12px;bottom:92px;z-index:70;margin:0;background:#fff;padding:6px 8px;border-radius:8px;font:600 12px Inter,sans-serif';document.body.appendChild(n);return 1})()`);
  await shot('property-popup-desktop.png');
  await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
  await delay(300);
  await shot('property-popup-phone.png');
  await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 800, deviceScaleFactor: 1, mobile: false}, sessionId);
  const styled = await evalJson(`(async()=>{
    const map=window.__ypMap;
    const before=document.getElementById('yp-building-estimate').textContent;
    map.setStyle({version:8,name:'labeled-test-basemap-not-maptiler',sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#d7e7c8'}}]});
    const deadline=Date.now()+8000;
    while(Date.now()<deadline && !map.getLayer('ypb-fill')) await new Promise(r=>setTimeout(r,100));
    return {overlay:!!map.getLayer('ypb-fill'),estimate:document.getElementById('yp-building-estimate')?.textContent||'',before,selected:map.getSource('ypb-selected')._data.features[0]?.properties?.gameId||''};
  })()`);
  const rental = await evalJson(`(()=>{
    document.getElementById('yp-building')?.remove();
    const place={label:'Test rental area',lon:152.5,lat:-24.82,stockKey:'Test rental area'};
    const store=ypEnsureSuburbStock(ypFreshStock(),place,[{lon:152.501,lat:-24.819}]);
    store.rentals[0].weeklyRent=500;store.rentals[0].bond=3000;
    ypWriteStock(store);
    const id=store.rentals[0].id;
    const cash0=G.cash;
    G.clockOn=0;G.homeChosen=0;G.started=1;G.week=0;G.acc=0;
    ypSubmitApply(id);
    const pending={status:ypReadStock().rentals[0].status,cash:G.cash,bond:ypReadStock().rentals[0].bond};
    G.clockOn=1;
    const hour=CFG.weekMs/168;
    if(typeof advance==='function'){advance(Math.floor(hour)+5);} else {G.acc=hour+5;}
    ypSyncSample(ypReadClock());
    const approved={status:ypReadStock().rentals[0].status,cash:G.cash};
    ypSubmitConfirm(id);
    const confirmed={status:ypReadStock().rentals[0].status,cash:G.cash};
    ypOpenRentalDetail(id);
    const text=document.querySelector('#yp-rent-detail')?.innerText||'';
    return {id,pending,approved,confirmed,cash0,sample:text.includes('Sample'),linked:text.includes('ypb-')};
  })()`);
  const quarantine = await evalJson(`(()=>{
    const held=(window.__ygParts.held.features||[])[0];
    if(!held)return {none:true};
    window.__ygOpen(held);
    return {title:document.getElementById('yp-building-title')?.textContent||'',estimate:document.getElementById('yp-building-estimate')?.textContent||'',apply:!!document.querySelector('#yp-building #yp-rent-apply')};
  })()`);
  const report = {boot, loaded, opened, styled, rental, quarantine};
  writeFileSync(`${OUT}/game-check.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  const nav = boot.nav.join(' ');
  const ok = nav.includes('My properties') && nav.includes('Map') && !nav.includes('Leaderboard') && !nav.includes('Finances')
    && opened.estimate === '$1,152,835' && opened.title === 'ypb-3be0a2ac226ef07bee0a8a8115b3cf2d' && !opened.apply
    && opened.text.includes('not for rent') && opened.saved.includes('yp-legacy-uuid') && opened.real == null
    && styled.overlay && styled.estimate === '$1,152,835' && styled.selected === opened.title
    && rental.id.startsWith('preview:') && rental.pending.cash === rental.cash0 && rental.pending.status === 'application-pending' && rental.pending.bond === 3000
    && rental.approved.status === 'approved' && rental.approved.cash === rental.cash0
    && rental.confirmed.status === 'active' && rental.confirmed.cash === rental.cash0 - 3000
    && rental.sample && !rental.linked
    && quarantine.title === 'No game id' && quarantine.estimate === '' && !quarantine.apply;
  if (!ok) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  chrome.kill('SIGTERM');
}
