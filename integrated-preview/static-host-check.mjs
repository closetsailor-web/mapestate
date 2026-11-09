import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import http from 'node:http';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const folder = 'preview-406b69525cf5';
const prefix = 'yppreview-406b69525cf5.';
const OUT = '/opt/cursor/artifacts/static-preview';
mkdirSync(OUT, {recursive: true});
const port = 8791;
const root = `http://127.0.0.1:${port}/${folder}/`;

function request(method, path) {
  return new Promise((resolvePromise, reject) => {
    const req = http.request({hostname: '127.0.0.1', port, path, method}, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolvePromise({status: res.statusCode, body: Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error', reject);
    req.end();
  });
}

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: repo, stdio: 'ignore'});
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=9333', '--user-data-dir=/tmp/chrome-yp-static', 'about:blank'
], {stdio: 'ignore'});

async function browserWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const info = await (await fetch('http://127.0.0.1:9333/json/version')).json();
      if (info.webSocketDebuggerUrl) return info.webSocketDebuggerUrl;
    } catch {}
    await delay(250);
  }
  throw new Error('Chrome debugging port did not open');
}

const PRICED = 'ypb-3be0a2ac226ef07bee0a8a8115b3cf2d';
const NONE = 'ypb-efa38c358cdbf1399b256f56726df084';

try {
  let up = false;
  for (let i = 0; i < 40; i++) {
    try { await request('GET', `/${folder}/config.json`); up = true; break; } catch { await delay(100); }
  }
  if (!up) throw new Error('static server did not start');
  const config = await request('GET', `/${folder}/config.json`);
  const configJson = JSON.parse(config.body);
  if (config.status !== 200 || configJson.key !== 'MAPTILER_KEY' || configJson.geoapifyKey !== 'GEOAPIFY_KEY') throw new Error('config placeholders ' + config.body.slice(0, 200));
  const page = await request('GET', `/${folder}/index.html`);
  if (page.status !== 200 || !page.body.includes('name="robots" content="noindex, nofollow"') || !page.body.includes(prefix) || page.body.includes("fetch('/runtime-config'") || page.body.includes("fetch('/data/")) throw new Error('index markers');
  const script = await request('GET', `/${folder}/map-preview.js`);
  const layer = await request('GET', `/${folder}/overture-layer.js`);
  if (!script.body.includes("fetch('config.json'") || script.body.includes('/runtime-config') || !layer.body.includes("fetch('data/chunk-manifest.json')") || layer.body.includes("fetch('/data/")) throw new Error('relative fetches');
  const manifestRes = await request('GET', `/${folder}/data/chunk-manifest.json`);
  const manifest = JSON.parse(manifestRes.body);
  if (manifestRes.status !== 200 || manifest.chunks.length !== 244) throw new Error('manifest ' + manifest.chunks?.length);
  const sample = manifest.chunks[0].id;
  const chunk = await request('GET', `/${folder}/data/chunks/${sample}.json`);
  if (chunk.status !== 200 || !chunk.body.includes('Feature')) throw new Error('chunk http ' + chunk.status);
  const boundary = await request('GET', `/${folder}/data/boundary.geojson`);
  if (boundary.status !== 200 || !boundary.body.includes('Feature')) throw new Error('boundary');
  const registry = await request('GET', `/${folder}/data/registry-v1.json`);
  if (registry.status !== 200 || !registry.body.includes('"frozen":true')) throw new Error('registry');
  const robots = await request('GET', `/${folder}/robots.txt`);
  if (robots.status !== 200 || !robots.body.includes('Disallow: /')) throw new Error('robots');
  const missingRuntime = await request('GET', '/runtime-config');
  if (missingRuntime.status === 200) throw new Error('root runtime-config should not exist on the static server');
  const claim = await request('POST', `/${folder}/api/claim`);
  if (claim.status === 200) throw new Error('claim served');

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
  await send('Page.addScriptToEvaluateOnNewDocument', {source: `
    if (!sessionStorage.getItem('yp-static-planted')) {
      localStorage.setItem('fe.global', 'live-site-value');
      localStorage.setItem('fe.theme', 'live-theme');
      localStorage.setItem('mt.build', 'test-build-keep');
      sessionStorage.setItem('yp-static-planted', '1');
    }
    const origFetch = window.fetch.bind(window);
    window.__ypNet = [];
    window.fetch = function (input, init) {
      const url = typeof input === 'string' ? input : (input && input.url) || String(input);
      const method = (init && init.method) || (input && input.method) || 'GET';
      if (String(url).indexOf('api.geoapify.com') !== -1) {
        window.__ypNet.push({url: String(url), status: 200, method, mocked: true});
        const body = JSON.stringify({results:[{place_id:'bundaberg-central-test',result_type:'suburb',name:'Bundaberg Central',suburb:'Bundaberg Central',city:'Bundaberg',state:'Queensland',country:'Australia',country_code:'au',lon:152.3489,lat:-24.8661}]});
        return Promise.resolve(new Response(body, {status: 200, headers: {'Content-Type': 'application/json'}}));
      }
      return origFetch(input, init).then(res => {
        try { window.__ypNet.push({url: String(url), status: res.status, method, mocked: false}); } catch (e) {}
        return res;
      });
    };
  `}, sessionId);
  async function evalJson(expression) {
    const result = await send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, sessionId);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 1200));
    return result.result.value;
  }
  async function click(x, y) {
    const px = Math.round(Number(x)), py = Math.round(Number(y));
    await send('Input.dispatchMouseEvent', {type: 'mousePressed', x: px, y: py, button: 'left', clickCount: 1}, sessionId);
    await send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: px, y: py, button: 'left', clickCount: 1}, sessionId);
  }
  async function shot(name) {
    const image = await send('Page.captureScreenshot', {format: 'png'}, sessionId);
    writeFileSync(`${OUT}/${name}`, Buffer.from(image.data, 'base64'));
  }
  async function pixelFor(gameId) {
    let last = null;
    for (let i = 0; i < 25; i++) {
      const point = await evalJson(`(()=>{
        const id=${JSON.stringify(gameId)};
        const feature=window.__ygParts&&window.__ygParts.adopted.features.find(f=>f.properties.gameId===id);
        if(!feature||!window.__ypMap||!window.__ypMap.getLayer('ypb-fill'))return {missing:!feature,layer:!!(window.__ypMap&&window.__ypMap.getLayer('ypb-fill'))};
        const ring=feature.geometry.type==='Polygon'?feature.geometry.coordinates[0]:feature.geometry.coordinates[0][0];
        let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
        for (const p of ring){const s=window.__ypMap.project(p); if(s.x<minX)minX=s.x; if(s.y<minY)minY=s.y; if(s.x>maxX)maxX=s.x; if(s.y>maxY)maxY=s.y;}
        const rect=window.__ypMap.getCanvas().getBoundingClientRect();
        for (let x=minX;x<=maxX;x+=3) for (let y=minY;y<=maxY;y+=3){
          if(window.__ypMap.queryRenderedFeatures([x,y],{layers:['ypb-fill']}).some(h=>h.properties.gameId===id)) return {x:rect.left+x,y:rect.top+y};
        }
        return null;
      })()`);
      if (point && Number.isFinite(point.x)) return point;
      last = point;
      await delay(200);
    }
    throw new Error('no rendered pixel for ' + gameId + ' ' + JSON.stringify(last));
  }

  await send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 800, deviceScaleFactor: 1, mobile: false}, sessionId);
  await send('Page.navigate', {url: `${root}?static=1`}, sessionId);
  const ready = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof flowFinish==='function'&&typeof ypEnterRealMap==='function'&&window.__ypPreviewNs)r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,100)};tick()})`);
  if (!ready) throw new Error('page did not boot');
  const storageBoot = await evalJson(`(()=>{
    localStorage.setItem('yp.static.marker', 'keep-me');
    localStorage.setItem('fe.theme', 'preview-theme');
    const keys = Object.keys(localStorage);
    return {
      mode: window.__ypStorageMode,
      ns: window.__ypPreviewNs,
      marker: localStorage.getItem('yp.static.marker'),
      theme: localStorage.getItem('fe.theme'),
      liveGlobal: window.__ypReadReal('fe.global'),
      liveTheme: window.__ypReadReal('fe.theme'),
      liveBuild: window.__ypReadReal('mt.build'),
      prefixedMarker: window.__ypReadReal(${JSON.stringify(prefix + 'yp.static.marker')}),
      prefixedTheme: window.__ypReadReal(${JSON.stringify(prefix + 'fe.theme')}),
      keysHavePrefix: keys.some(k => k.indexOf('yppreview-') === 0),
      hasMarkerKey: keys.includes('yp.static.marker'),
      length: localStorage.length
    };
  })()`);
  await evalJson(`(()=>{
    G.hwSeen=1;
    flowFinish({nick:'list',band:7,view:'week',exp:{freq:'week',items:{},yearly:{}},start:'Glimmerbrook'});
    return 1;
  })()`);
  const mapReady = await evalJson(`(async()=>{await ypEnterRealMap(); const t=Date.now(); while(!window.__ypMap && Date.now()-t<20000) await new Promise(r=>setTimeout(r,100)); if (typeof ypCloseWhere==='function') ypCloseWhere(); document.getElementById('yp-where')?.remove(); ['status','hwov','gate','coach'].forEach(id=>document.getElementById(id)?.remove()); return !!window.__ypMap;})()`);
  if (!mapReady) throw new Error('map did not start');
  await evalJson(`(()=>{ window.__ypMap && window.__ypMap.jumpTo({center:[152.347279,-24.865565], zoom:17}); return 1; })()`);
  const loaded = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(window.__ygParts&&window.__ygParts.adopted.features.length&&window.__ypMap&&window.__ypMap.getLayer('ypb-fill'))r(window.__ygView);else if(Date.now()-t>25000)r(0);else setTimeout(tick,150)};tick()})`);
  if (!loaded) {
    const diag = await evalJson(`({map:!!window.__ypMap, layer:window.__ygLayer||null, view:window.__ygView||null, net:(window.__ypNet||[]).slice(0,12), mode:window.__ypStorageMode||null})`);
    throw new Error('buildings did not load ' + JSON.stringify(diag));
  }
  const pricedPoint = await pixelFor(PRICED);
  await click(pricedPoint.x, pricedPoint.y);
  await delay(400);
  const opened = await evalJson(`(()=>{
    const feature=window.__ygParts.adopted.features.find(f=>f.properties.gameId===${JSON.stringify(PRICED)});
    const card=document.querySelector('#yp-building .yp-listing');
    return {
      title: document.getElementById('yp-building-title')?.textContent||'',
      estimate: document.getElementById('yp-building-estimate')?.textContent||'',
      text: card ? card.innerText : '',
      apply: !!document.querySelector('#yp-building #yp-rent-apply'),
      claim: /claim/i.test(card ? card.innerText : ''),
      props: feature ? {tone: feature.properties.tone, eligible: feature.properties.eligible, estimate: feature.properties.estimate} : null
    };
  })()`);
  await shot('desktop-property-card.png');
  const back = await evalJson(`(()=>{const b=document.querySelector('#yp-building .hwx');const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,h:r.height,w:r.width};})()`);
  await click(back.x, back.y);
  const ignored = await evalJson(`(()=>{const open=!!document.getElementById('yp-building'); return {open};})()`);
  await click(pricedPoint.x, pricedPoint.y);
  const stillClosed = await evalJson(`!!document.getElementById('yp-building')`);
  await delay(800);
  await click(pricedPoint.x, pricedPoint.y);
  await delay(300);
  const reopened = await evalJson(`({title:document.getElementById('yp-building-title')?.textContent||'', estimate:document.getElementById('yp-building-estimate')?.textContent||''})`);
  const backdrop = await evalJson(`(()=>{const card=document.querySelector('#yp-building .card').getBoundingClientRect(); return {x: Math.max(8, card.left-24), y: card.top+30};})()`);
  await click(backdrop.x, backdrop.y);
  await delay(200);
  const backdropClosed = await evalJson(`!!document.getElementById('yp-building')`);
  await delay(800);
  await evalJson(`(()=>{window.__ypMap.jumpTo({center:[152.46495,-24.832689],zoom:17});return 1;})()`);
  await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{const c=window.__ypMap.getCenter();if(Math.abs(c.lng-152.46495)<0.002)r(1);else if(Date.now()-t>5000)r(0);else setTimeout(tick,50)};tick()})`);
  const nonePoint = await pixelFor(NONE);
  await click(nonePoint.x, nonePoint.y);
  await delay(300);
  const noneCard = await evalJson(`(()=>{
    const feature=window.__ygParts.adopted.features.find(f=>f.properties.gameId===${JSON.stringify(NONE)});
    return {
      title: document.getElementById('yp-building-title')?.textContent||'',
      estimate: document.getElementById('yp-building-estimate')?.textContent||'',
      text: document.querySelector('#yp-building .yp-listing')?.innerText||'',
      props: feature ? {tone: feature.properties.tone, eligible: feature.properties.eligible, estimate: feature.properties.estimate} : null
    };
  })()`);
  const noneBackdrop = await evalJson(`(()=>{const card=document.querySelector('#yp-building .card').getBoundingClientRect(); return {x: Math.max(8, card.left-24), y: card.top+30};})()`);
  await click(noneBackdrop.x, noneBackdrop.y);
  await delay(800);
  await evalJson(`(()=>{window.__ypMap.jumpTo({center:[152.347279,-24.865565],zoom:17});return 1;})()`);
  await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{const c=window.__ypMap.getCenter();if(Math.abs(c.lng-152.347279)<0.002)r(1);else if(Date.now()-t>5000)r(0);else setTimeout(tick,50)};tick()})`);
  const again = await pixelFor(PRICED);
  await click(again.x, again.y);
  await delay(300);
  const reselected = await evalJson(`({title:document.getElementById('yp-building-title')?.textContent||'', estimate:document.getElementById('yp-building-estimate')?.textContent||''})`);

  await send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 2, mobile: true}, sessionId);
  await delay(400);
  const phoneBack = await evalJson(`(()=>{const b=document.querySelector('#yp-building .hwx');const card=document.querySelector('#yp-building .card').getBoundingClientRect();const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,h:r.height,w:r.width,cardW:card.width,title:document.getElementById('yp-building-title')?.textContent||'',estimate:document.getElementById('yp-building-estimate')?.textContent||''};})()`);
  await shot('phone-property-card.png');
  await click(phoneBack.x, phoneBack.y);
  await delay(200);
  const phoneClosed = await evalJson(`!!document.getElementById('yp-building')`);

  const beforeSearch = await evalJson(`(window.__ypNet||[]).filter(x=>x.url.includes('geoapify')).length`);
  await evalJson(`(()=>{ window.ypGeoKey=''; try{ypGeoKey='';}catch(e){} ypShowWherePopup(); const input=document.getElementById('yp-where-town'); input.value='Bun'; input.dispatchEvent(new Event('input',{bubbles:true})); return 1; })()`);
  await delay(800);
  const blocked = await evalJson(`({status:document.getElementById('yp-where-status')?.textContent||'', geo:(window.__ypNet||[]).filter(x=>x.url.includes('geoapify')).length})`);
  await evalJson(`(()=>{ window.ypGeoKey='static-preview-test-key'; try{ypGeoKey='static-preview-test-key';}catch(e){} const input=document.getElementById('yp-where-town'); input.value='Bundaberg'; input.dispatchEvent(new Event('input',{bubbles:true})); return 1; })()`);
  await delay(900);
  const suggested = await evalJson(`(()=>{
    const button=document.querySelector('#yp-where-suggestions button');
    const hits=(window.__ypNet||[]).filter(x=>x.url.includes('geoapify'));
    return {label:button?button.textContent:'', count:document.querySelectorAll('#yp-where-suggestions button').length, status:document.getElementById('yp-where-status')?.textContent||'', hits};
  })()`);
  await shot('phone-suburb-search.png');
  await evalJson(`document.querySelector('#yp-where-suggestions button')?.click()`);
  await delay(400);
  const chosen = await evalJson(`(()=>{
    const c=window.__ypMap.getCenter();
    return {open:!!document.getElementById('yp-where'), lon:+c.lng.toFixed(4), lat:+c.lat.toFixed(4), label:(window.__ypPlace&&window.__ypPlace.label)||''};
  })()`);
  const firstNet = await evalJson(`window.__ypNet||[]`);

  await send('Page.navigate', {url: `${root}?static=1`}, sessionId);
  await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(window.__ypPreviewNs&&localStorage.getItem)r(1);else if(Date.now()-t>20000)r(0);else setTimeout(tick,100)};tick()})`);
  const persisted = await evalJson(`({
    marker: localStorage.getItem('yp.static.marker'),
    liveGlobal: window.__ypReadReal('fe.global'),
    liveTheme: window.__ypReadReal('fe.theme'),
    liveBuild: window.__ypReadReal('mt.build')
  })`);
  await send('Page.navigate', {url: `${root}?fresh=1`}, sessionId);
  await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(window.__ypPreviewFresh===1&&document.getElementById('yp-fresh-note'))r(1);else if(Date.now()-t>20000)r(0);else setTimeout(tick,100)};tick()})`);
  const fresh = await evalJson(`(()=>{
    const normal = ${JSON.stringify(prefix + 'yp.static.marker')};
    const seen = localStorage.getItem('yp.static.marker');
    localStorage.setItem('yp.static.marker', 'fresh-only');
    const freshKey = ${JSON.stringify(prefix + 'fresh.yp.static.marker')};
    const beforeClear = window.__ypReadReal(freshKey);
    localStorage.clear();
    return {
      seen,
      normalKept: window.__ypReadReal(normal),
      freshBefore: beforeClear,
      freshAfter: window.__ypReadReal(freshKey),
      liveGlobal: window.__ypReadReal('fe.global'),
      liveTheme: window.__ypReadReal('fe.theme'),
      liveBuild: window.__ypReadReal('mt.build'),
      note: !!document.getElementById('yp-fresh-note')
    };
  })()`);
  await send('Page.navigate', {url: `${root}?static=1`}, sessionId);
  await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(window.__ypPreviewNs&&window.__ypPreviewFresh===0)r(1);else if(Date.now()-t>20000)r(0);else setTimeout(tick,100)};tick()})`);
  const restored = await evalJson(`localStorage.getItem('yp.static.marker')`);

  const searchHit = (suggested.hits || [])[0] || {};
  const chunkNet = firstNet.filter(x => x.url.includes('data/chunks/'));
  const report = {storageBoot, loaded, opened, back, ignored, stillClosed, reopened, backdropClosed, noneCard, reselected, phoneBack, phoneClosed, beforeSearch, blocked, suggested: {label: suggested.label, count: suggested.count, status: suggested.status, mocked: searchHit.mocked === true, autocomplete: String(searchHit.url || '').includes('geocode/autocomplete'), sentTestKey: String(searchHit.url || '').includes('static-preview-test-key'), sentPlaceholder: String(searchHit.url || '').includes('GEOAPIFY_KEY') || String(searchHit.url || '').includes('MAPTILER_KEY')}, chosen, persisted, fresh, restored, chunkCount: chunkNet.length, chunkStatuses: [...new Set(chunkNet.map(x => x.status))], manifest: firstNet.filter(x => x.url.includes('chunk-manifest')).map(x => x.status), boundary: firstNet.filter(x => x.url.includes('boundary.geojson')).map(x => x.status), config: firstNet.filter(x => x.url.includes('config.json')).map(x => x.status), posts: firstNet.filter(x => x.method && x.method !== 'GET').length, maptiler: firstNet.filter(x => x.url.includes('maptiler') || x.url.includes('MAPTILER_KEY')).length};
  writeFileSync(`${OUT}/static-host-check.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  const chunksOk = report.chunkCount > 0 && report.chunkStatuses.length === 1 && report.chunkStatuses[0] === 200 && report.manifest[0] === 200 && report.boundary[0] === 200 && report.config[0] === 200;
  const ok = storageBoot.mode === 'proxy'
    && storageBoot.marker === 'keep-me'
    && storageBoot.theme === 'preview-theme'
    && storageBoot.liveGlobal === 'live-site-value'
    && storageBoot.liveTheme === 'live-theme'
    && storageBoot.liveBuild === 'test-build-keep'
    && storageBoot.prefixedMarker === 'keep-me'
    && storageBoot.prefixedTheme === 'preview-theme'
    && storageBoot.keysHavePrefix === false
    && storageBoot.hasMarkerKey === true
    && chunksOk
    && opened.title === PRICED && opened.estimate === '$1,152,835' && !opened.apply && !opened.claim
    && opened.text.includes('No owner is recorded') && opened.text.includes('not for rent and not for sale')
    && ignored.open === false && stillClosed === false
    && reopened.title === PRICED && reopened.estimate === '$1,152,835'
    && backdropClosed === false
    && noneCard.title === NONE && noneCard.estimate === ''
    && noneCard.props && noneCard.props.tone === 'none' && noneCard.props.eligible === false && noneCard.props.estimate === null
    && noneCard.text.includes('No game estimate') && noneCard.text.includes('No owner is recorded')
    && reselected.title === PRICED && reselected.estimate === '$1,152,835'
    && phoneBack.h >= 48 && phoneBack.w > 200 && phoneBack.title === PRICED && phoneClosed === false
    && beforeSearch === 0
    && blocked.geo === 0 && blocked.status.includes('Search key missing')
    && suggested.count === 1 && suggested.label.includes('Bundaberg Central')
    && report.suggested.mocked && report.suggested.autocomplete && report.suggested.sentTestKey && !report.suggested.sentPlaceholder && report.maptiler === 0
    && chosen.open === false && Math.abs(chosen.lon - 152.3489) < 0.01 && Math.abs(chosen.lat + 24.8661) < 0.01
    && persisted.marker === 'keep-me' && persisted.liveGlobal === 'live-site-value' && persisted.liveTheme === 'live-theme' && persisted.liveBuild === 'test-build-keep'
    && fresh.seen === null && fresh.normalKept === 'keep-me' && fresh.freshBefore === 'fresh-only' && fresh.freshAfter === null
    && fresh.liveGlobal === 'live-site-value' && fresh.liveTheme === 'live-theme' && fresh.liveBuild === 'test-build-keep'
    && restored === 'keep-me'
    && report.posts === 0;
  if (!ok) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  chrome.kill('SIGTERM');
  setTimeout(() => { server.kill('SIGKILL'); chrome.kill('SIGKILL'); process.exit(process.exitCode || 0); }, 400);
}
