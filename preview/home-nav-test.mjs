// Regression: closing a section or menu returns to the coastal Home screen.
// Closing one Property History entry returns to the history list.
// The live map opens only from a Listings choice (For Sale, For Rent, Room Share, Family, Auctions).
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'preview-406b69525cf5');
const outDir = process.env.YP_SHOT_DIR || '/opt/cursor/artifacts';
const port = 8812;
const debugPort = 9286;

function stateExpr(){
  return `(()=>{
    const rows=[...document.querySelectorAll('#yp-history .yp-rent-row .yp-row-title')].map(el=>el.textContent.trim());
    const detail=[...document.querySelectorAll('#yp-history-detail .yp-flow div')].map(el=>({label:el.querySelector('dt').childNodes[0].textContent.trim(),value:el.querySelector('dd').textContent.trim()}));
    const status=detail.find(row=>row.label==='Status');
    return {
      home:document.documentElement.classList.contains('yp-home'),
      mapOn:document.documentElement.classList.contains('yp-map-on'),
      hold:typeof ypTilesHold!=='undefined'?ypTilesHold:null,
      history:!!document.getElementById('yp-history'),
      detail:!!document.getElementById('yp-history-detail'),
      menu:!!(document.getElementById('yp-property-menu')||document.getElementById('yp-section-menu')),
      nav:!!document.querySelector('nav'),
      rows,
      status:status?status.value:'',
      title:document.getElementById('yp-history-detail-title')?.textContent||document.querySelector('#yp-history h2')?.textContent||''
    };
  })()`;
}

const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: root, stdio: 'ignore'});
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', `--remote-debugging-port=${debugPort}`, '--user-data-dir=/tmp/chrome-yp-homenav', 'about:blank'], {stdio: 'ignore'});

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
  constructor(ws){ this.ws = ws; this.id = 0; this.pending = new Map(); this.tiles = [];
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.method === 'Network.requestWillBeSent' && String(msg.params.request.url || '').includes('maptiler.com')) this.tiles.push(msg.params.request.url);
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

const ws = new WebSocket(await browserWs());
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
const cdp = new CDP(ws);
const {targetId} = await cdp.send('Target.createTarget', {url: 'about:blank'});
const {sessionId} = await cdp.send('Target.attachToTarget', {targetId, flatten: true});
await cdp.send('Page.enable', {}, sessionId);
await cdp.send('Runtime.enable', {}, sessionId);
await cdp.send('Network.enable', {}, sessionId);
async function evalJson(expression){
  const result = await cdp.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 1600));
  return result.result.value;
}
async function shot(name){
  const image = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
  writeFileSync(path.join(outDir, name), Buffer.from(image.data, 'base64'));
}
await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
await cdp.send('Page.navigate', {url: `http://127.0.0.1:${port}/?fresh=1`}, sessionId);
await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(document.getElementById('yp-home-bg')&&typeof ypOpenListingsMenu==='function')r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,80)};tick()})`);

const home = await evalJson(`(()=>{window.advance=()=>0;window.toast=()=>{};document.getElementById('flow')?.remove();ypOffsetFreshNote();return ${stateExpr()};})()`);
await shot('home-screen-390x844.png');
const tilesAtHome = cdp.tiles.length;
await delay(1200);
const tilesAfterWait = cdp.tiles.length;

await evalJson(`(()=>{
  G.clockOn=0;G.week=1;G.acc=0;G.statusLease=12;
  const centre={label:'Bargara, Queensland, Australia',lon:152.464,lat:-24.814,stockKey:'home-nav',locality:'Bargara'};
  window.__ypListCentre=centre;
  const store=ypEnsureSuburbStock(ypFreshStock(),centre,[{lon:152.465,lat:-24.813}]);
  store.rentals[0].weeklyRent=500;store.rentals[0].bond=3000;store.rentals[0].status='available';store.rentals[0].locality='Bargara';
  ypWriteStock(store);
  localStorage.removeItem('yp.propertyHistory.v1');
  ypOpenRentalDetail(store.rentals[0].id);
  document.getElementById('yp-rent-apply').click();
  document.getElementById('yp-review-confirm').click();
  return 1;
})()`);
const afterConfirm = await evalJson(stateExpr());
await evalJson(`document.querySelector('#yp-history .yp-rent-row').click();1`);
await delay(50);
const entry = await evalJson(stateExpr());
await evalJson(`document.getElementById('yp-history-detail-close').click();1`);
await delay(40);
const afterEntry = await evalJson(stateExpr());
await shot('history-list-after-entry-close-390x844.png');

await evalJson(`(()=>{document.getElementById('yp-history')?.remove();document.getElementById('yp-history-detail')?.remove();([...document.querySelectorAll('nav button')].find(b=>b.getAttribute('aria-label')==='Property')).click();document.getElementById('yp-property-history-open').click();document.querySelector('#yp-history .yp-rent-row').click();return 1;})()`);
await delay(40);
await evalJson(`document.getElementById('yp-history-detail-close').click();1`);
await delay(40);
const fromMenu = await evalJson(stateExpr());

await evalJson(`document.getElementById('yp-history-close').click();1`);
const afterHistory = await evalJson(stateExpr());
await shot('home-after-history-close-390x844.png');

await evalJson(`(()=>{([...document.querySelectorAll('nav button')].find(b=>b.getAttribute('aria-label')==='Listings')).click();document.getElementById('yp-section-menu').dispatchEvent(new MouseEvent('click',{bubbles:true}));return 1;})()`);
const afterMenu = await evalJson(stateExpr());

const tilesBeforeMap = cdp.tiles.length;
await evalJson(`(()=>{([...document.querySelectorAll('nav button')].find(b=>b.getAttribute('aria-label')==='Listings')).click();document.getElementById('yp-cat-rent').click();return 1;})()`);
await delay(400);
const onMap = await evalJson(stateExpr());

const problems = [];
if (!(home.home && !home.mapOn && home.nav && !home.history)) problems.push('load is not Home '+JSON.stringify(home));
if (tilesAfterWait !== tilesAtHome) problems.push('tiles loaded on Home '+(tilesAfterWait-tilesAtHome));
if (!(afterConfirm.history && afterConfirm.home && !afterConfirm.mapOn && afterConfirm.rows.includes('Applied for Rental'))) problems.push('confirm did not land on history '+JSON.stringify(afterConfirm));
if (!(entry.detail && entry.history && entry.status === 'Pending' && entry.status[0] === entry.status[0].toUpperCase())) problems.push('entry card '+JSON.stringify(entry));
if (!(afterEntry.history && !afterEntry.detail && afterEntry.home && !afterEntry.mapOn && afterEntry.hold)) problems.push('confirm route entry close '+JSON.stringify(afterEntry));
if (!(fromMenu.history && !fromMenu.detail && fromMenu.home && !fromMenu.mapOn)) problems.push('menu route entry close '+JSON.stringify(fromMenu));
if (!(!afterHistory.history && !afterHistory.menu && afterHistory.home && !afterHistory.mapOn && afterHistory.nav)) problems.push('history close '+JSON.stringify(afterHistory));
if (!(afterMenu.home && !afterMenu.mapOn && !afterMenu.menu)) problems.push('menu close '+JSON.stringify(afterMenu));
if (!(onMap.mapOn && !onMap.home)) problems.push('For Rent did not open the map '+JSON.stringify(onMap));
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else console.log('PASS home navigation', {tilesAtHome, tilesBeforeMap, onMap: onMap.mapOn});

server.kill('SIGTERM');
chrome.kill('SIGTERM');
setTimeout(() => process.exit(process.exitCode || 0), 200);
