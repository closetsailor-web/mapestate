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
const centred = await evalJson(`(()=>{const card=document.querySelector('#yp-history .card');const h=document.querySelector('header').getBoundingClientRect();const n=document.querySelector('nav').getBoundingClientRect();const r=card.getBoundingClientRect();return {off:Math.round(((r.top+r.bottom)/2)-((h.bottom+n.top)/2)),clear:Math.round(Math.min(r.top-h.bottom,n.top-r.bottom))};})()`);
const afterConfirm = await evalJson(stateExpr());
await evalJson(`document.querySelector('#yp-history .yp-rent-row').click();1`);
await delay(50);
const entry = await evalJson(stateExpr());
await evalJson(`document.getElementById('yp-history-detail-close').click();1`);
await delay(40);
const afterEntry = await evalJson(stateExpr());
await shot('history-list-after-entry-close-390x844.png');
await evalJson(`document.querySelector('#yp-history .yp-rent-row').click();1`);
await delay(40);
const entryX = await evalJson(`(()=>{const b=document.getElementById('yp-history-detail-x');const r=b.getBoundingClientRect();return {label:b.getAttribute('aria-label'),text:b.textContent,w:Math.round(r.width),h:Math.round(r.height),close:document.getElementById('yp-history-detail-close').textContent};})()`);
await evalJson(`document.getElementById('yp-history-detail-x').click();1`);
await delay(40);
const afterEntryX = await evalJson(stateExpr());

await evalJson(`(()=>{document.getElementById('yp-history')?.remove();document.getElementById('yp-history-detail')?.remove();([...document.querySelectorAll('nav button')].find(b=>b.getAttribute('aria-label')==='Property')).click();document.getElementById('yp-property-history-open').click();document.querySelector('#yp-history .yp-rent-row').click();return 1;})()`);
await delay(40);
await evalJson(`document.getElementById('yp-history-detail-close').click();1`);
await delay(40);
const fromMenu = await evalJson(stateExpr());

const pin = await evalJson(`(async()=>{
  const events=Array.from({length:28},(_,i)=>({key:'seed|applied|'+i,propertyId:'seed',kind:'applied',gameMs:i*1000,text:'Applied for Rental '+(i+1)}));
  localStorage.setItem('yp.propertyHistory.v1',JSON.stringify({version:1,events}));
  ypOpenPropertyHistory();
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const card=document.querySelector('#yp-history .card');
  card.scrollTop=card.scrollHeight;
  const head=document.querySelector('#yp-history .hwh').getBoundingClientRect();
  const cardR=card.getBoundingClientRect();
  const xEl=document.getElementById('yp-history-x');
  const x=xEl.getBoundingClientRect();
  return {
    scrolled:card.scrollTop>120,
    headStuck:Math.abs(head.top-cardR.top)<4,
    label:xEl.getAttribute('aria-label'),
    text:xEl.textContent,
    w:Math.round(x.width),
    h:Math.round(x.height),
    dy:Math.round(Math.abs((x.top+x.height/2)-(head.top+head.height/2))*10)/10,
    rightPad:Math.round((head.right-x.right)*10)/10,
    xInside:x.top>=head.top-1&&x.bottom<=head.bottom+1&&x.right<=head.right+1&&x.left>=head.left,
    color:getComputedStyle(xEl).color,
    closeKept:document.getElementById('yp-history-close').textContent
  };
})()`);
await shot('history-scrolled-x-390x844.png');

await evalJson(`document.getElementById('yp-history-close').click();1`);
const afterHistory = await evalJson(stateExpr());
await shot('home-after-history-close-390x844.png');
await evalJson(`ypOpenPropertyHistory();1`);
await evalJson(`document.getElementById('yp-history-x').click();1`);
const afterX = await evalJson(stateExpr());
async function openSheet(call){
  await evalJson(`(()=>{${call};return 1;})()`);
  await evalJson(`new Promise(resolve=>{const el=document.querySelector('.sheet.open');const done=()=>requestAnimationFrame(()=>requestAnimationFrame(resolve));if(!el||typeof el.getAnimations!=='function')return done();Promise.all(el.getAnimations().map(a=>a.finished.catch(()=>0))).then(done);})`);
  await delay(450);
}
function sheetBoxExpr(){
  return `(()=>{
    const sheet=document.querySelector('.sheet.open');
    const r=sheet.getBoundingClientRect();
    const header=document.querySelector('header').getBoundingClientRect();
    const nav=document.querySelector('nav').getBoundingClientRect();
    const h2=sheet.querySelector('h2');
    const x=sheet.querySelector('.close');
    const hr=h2.getBoundingClientRect();
    const xr=x.getBoundingClientRect();
    const left=r.left, right=window.innerWidth-r.right;
    return {
      title:(h2.textContent||'').trim(),
      left:Math.round(left*10)/10,
      right:Math.round(right*10)/10,
      gapDelta:Math.round(Math.abs(left-right)*10)/10,
      top:Math.round(r.top),
      bottom:Math.round(r.bottom),
      headerClear:Math.round(r.top-header.bottom),
      navClear:Math.round(nav.top-r.bottom),
      onScreen:r.left>=-0.5&&r.right<=window.innerWidth+0.5&&r.top>=-0.5&&r.bottom<=window.innerHeight+0.5,
      label:x.getAttribute('aria-label'),
      w:Math.round(xr.width),
      h:Math.round(xr.height),
      headTop:Math.round(hr.top-r.top),
      xInHead:xr.top>=hr.top-2&&xr.bottom<=hr.bottom+6,
      dy:Math.round(Math.abs((xr.top+xr.height/2)-(hr.top+hr.height/2))*10)/10,
      rightPad:Math.round((hr.right-xr.right)*10)/10,
      grab:getComputedStyle(sheet.querySelector('.grab')).display
    };
  })()`;
}
await openSheet('UI.port()');
const bank = await evalJson(sheetBoxExpr());
await shot('bank-sheet-close-390x844.png');
await openSheet('UI.mine()');
const owned = await evalJson(sheetBoxExpr());
await shot('property-owned-sheet-390x844.png');
const sharedSheets = [];
for (const call of ['UI.money()', 'UI.income()', 'UI.expenses()', 'UI.lead()']) {
  await openSheet(call);
  sharedSheets.push(await evalJson(sheetBoxExpr()));
}
await evalJson(`UI.close();1`);
async function measureCross(setup, headSel, btnSel){
  await evalJson(`(()=>{${setup};return 1;})()`);
  await evalJson(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  return evalJson(`(()=>{
    const head=document.querySelector(${JSON.stringify(headSel)});
    const btn=document.querySelector(${JSON.stringify(btnSel)});
    if(!head||!btn)return {missing:true,head:${JSON.stringify(headSel)},btn:${JSON.stringify(btnSel)}};
    const h=head.getBoundingClientRect(), b=btn.getBoundingClientRect();
    return {
      title:(head.querySelector('h2')||head).textContent.trim().slice(0,48),
      dy:Math.round(Math.abs((b.top+b.height/2)-(h.top+h.height/2))*10)/10,
      rightPad:Math.round((h.right-b.right)*10)/10,
      w:Math.round(b.width),
      h:Math.round(b.height)
    };
  })()`);
}
const crosses = [];
for (const [setup, headSel, btnSel] of [
  [`['yp-history-detail','yp-pending','yp-soon','yp-where','yp-prop','yp-rent-list','yp-rent-detail','yp-apply-review'].forEach(id=>document.getElementById(id)?.remove());ypOpenPropertyHistory()`, '#yp-history .hwh', '#yp-history-x'],
  [`document.querySelector('#yp-history .yp-rent-row').click()`, '#yp-history-detail .hwh', '#yp-history-detail-x'],
  [`document.getElementById('yp-history-detail')?.remove();document.getElementById('yp-history')?.remove();ypOpenPendingOffers()`, '#yp-pending .hwh', '#yp-pending .yp-x'],
  [`document.getElementById('yp-pending')?.remove();ypOpenComingSoon('Budget')`, '#yp-soon .hwh', '#yp-soon .yp-x'],
  [`document.getElementById('yp-soon')?.remove();ypShowWherePopup()`, '#yp-where .hwh', '#yp-where .yp-x'],
  [`ypCloseWhere();ypOpenListingsChoice()`, '#yp-prop .hwh', '#yp-prop .yp-x'],
  [`ypShowEmptyCategory('sale')`, '#yp-prop .hwh', '#yp-prop .yp-x'],
  [`document.getElementById('yp-prop')?.remove();ypRenderRentalList()`, '#yp-rent-list .hwh', '#yp-rent-list .yp-x'],
  [`document.getElementById('yp-rent-list')?.remove();ypOpenRentalDetail(ypReadStock().rentals[0].id)`, '#yp-rent-detail .hwh', '#yp-rent-detail .yp-x'],
  [`(()=>{const s=ypReadStock();s.rentals[0].status='available';ypWriteStock(s);document.getElementById('yp-rent-detail')?.remove();ypOpenApplyReview(s.rentals[0].id);})()`, '#yp-apply-review .hwh', '#yp-apply-review .yp-x']
]) crosses.push(await measureCross(setup, headSel, btnSel));
await evalJson(`['yp-history','yp-history-detail','yp-pending','yp-soon','yp-where','yp-prop','yp-rent-list','yp-rent-detail','yp-apply-review'].forEach(id=>document.getElementById(id)?.remove());1`);

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
if (!(entryX.label==='Close' && entryX.text==='✕' && entryX.w>=44 && entryX.h>=44 && entryX.close==='Close')) problems.push('entry cross '+JSON.stringify(entryX));
if (!(afterEntryX.history && !afterEntryX.detail && afterEntryX.home && !afterEntryX.mapOn)) problems.push('entry cross close '+JSON.stringify(afterEntryX));
if (!(fromMenu.history && !fromMenu.detail && fromMenu.home && !fromMenu.mapOn)) problems.push('menu route entry close '+JSON.stringify(fromMenu));
if (!(!afterHistory.history && !afterHistory.menu && afterHistory.home && !afterHistory.mapOn && afterHistory.nav)) problems.push('history close '+JSON.stringify(afterHistory));
if (!(pin.scrolled && pin.headStuck && pin.label==='Close' && pin.text==='✕' && pin.w>=44 && pin.h>=44 && pin.xInside && pin.closeKept==='Close' && pin.color==='rgb(255, 255, 255)' && pin.dy<=1 && Math.abs(pin.rightPad-10)<=1)) problems.push('history header pin '+JSON.stringify(pin));
if (!(!afterX.history && !afterX.detail && afterX.home && !afterX.mapOn)) problems.push('history cross '+JSON.stringify(afterX));
const sheets = [bank, owned, ...sharedSheets];
const offCentre = sheets.filter(box=>!(box.gapDelta<=1 && box.onScreen && box.headerClear>=8 && box.navClear>=8 && box.grab==='none' && box.label==='Close' && box.w>=44 && box.h>=44 && box.dy<=1 && Math.abs(box.rightPad-10)<=1));
const offCross = crosses.filter(box=>!(box.dy<=1 && box.w>=44 && box.h>=44 && Math.abs(box.rightPad-10)<=1));
if (offCross.length) problems.push('header cross '+JSON.stringify(offCross));
if (offCentre.length) problems.push('sheet bounds '+JSON.stringify(offCentre));
if (!(bank.xInHead && bank.headTop<40 && owned.xInHead)) problems.push('sheet close '+JSON.stringify({bank,owned}));
if (!(afterMenu.home && !afterMenu.mapOn && !afterMenu.menu)) problems.push('menu close '+JSON.stringify(afterMenu));
if (!(onMap.mapOn && !onMap.home)) problems.push('For Rent did not open the map '+JSON.stringify(onMap));
if (!(centred && Math.abs(centred.off) < 40 && centred.clear > 8)) problems.push('history list is not centred '+JSON.stringify(centred));
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else console.log('PASS home navigation', {tilesAtHome, tilesBeforeMap, onMap: onMap.mapOn, sheets: sheets.map(box=>({title:box.title,dy:box.dy,rightPad:box.rightPad})), crosses: crosses.map(box=>({title:box.title,dy:box.dy,rightPad:box.rightPad}))});

server.kill('SIGTERM');
chrome.kill('SIGTERM');
setTimeout(() => process.exit(process.exitCode || 0), 200);
