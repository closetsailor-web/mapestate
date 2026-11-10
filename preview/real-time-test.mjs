// Cards, history and notifications show the player's real local date and time, not the game calendar.
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'preview-406b69525cf5');
const outDir = process.env.YP_SHOT_DIR || '/opt/cursor/artifacts';
const port = 8891;
const debugPort = 9391;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: root, stdio: 'ignore'});
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/chrome-yp-realtime-${Date.now()}`, 'about:blank'], {stdio: 'ignore'});
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
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function brisbane(wall){ return new Date(wall + 10*3600000); } // Queensland has no daylight saving
function dateLabel(wall){ const d = brisbane(wall); return DAYS[d.getUTCDay()]+' '+d.getUTCDate()+' '+MONTHS[d.getUTCMonth()]+' '+d.getUTCFullYear(); }
function clockLabel(wall){ const d = brisbane(wall); let h = d.getUTCHours(); const ap = h >= 12 ? 'PM' : 'AM'; h = h%12 || 12; return dateLabel(wall)+', '+h+':'+String(d.getUTCMinutes()).padStart(2,'0')+'\u00a0'+ap; }
try {
  const ws = new WebSocket(await browserWs());
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
  const cdp = new CDP(ws);
  const {targetId} = await cdp.send('Target.createTarget', {url: 'about:blank'});
  const {sessionId} = await cdp.send('Target.attachToTarget', {targetId, flatten: true});
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setTimezoneOverride', {timezoneId: 'Australia/Brisbane'}, sessionId);
  async function evalJson(expression){
    const result = await cdp.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, sessionId);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 1600));
    return result.result.value;
  }
  async function shot(name){
    await evalJson(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const image = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
    writeFileSync(path.join(outDir, name), Buffer.from(image.data, 'base64'));
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
  await cdp.send('Page.navigate', {url: `http://127.0.0.1:${port}/?v=${Date.now()}`}, sessionId);
  const booted = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof ypOpenApplyReview==='function'&&typeof clockStep==='function'&&document.readyState==='complete')r(1);else if(Date.now()-t>30000)r(0);else setTimeout(tick,100)};tick()})`);
  if (!booted) problems.push('page did not boot');
  await delay(300);
  // Real time is shifted inside the page only, so the test does not have to wait five real minutes.
  const review = await evalJson(`(()=>{
    window.__ypRealNow=Date.now; window.__ypOff=0; Date.now=()=>window.__ypRealNow()+window.__ypOff;
    document.getElementById('flow')?.remove(); document.getElementById('status')?.remove(); document.getElementById('hwov')?.remove();
    document.getElementById('toast')?.classList.remove('show');
    G.started=1; G.homeChosen=0; G.clockOn=0; G.week=0; G.acc=0; G.cash=30000; G.statusPick='rent'; G.statusLease=12; G.housing='rent'; G.cur='c1'; delete G.lease; G.notifs=[];
    localStorage.removeItem(YP_HIST_KEY);
    hud();
    const place={label:'Bargara',lon:152.4632,lat:-24.8186,stockKey:'Bargara'};
    const store=ypEnsureSuburbStock(ypFreshStock(),place,[{lon:152.465,lat:-24.813},{lon:152.466,lat:-24.814}]);
    ypWriteStock(store);
    const ids=store.rentals.map(r=>r.id);
    const opened=Date.now();
    ypOpenApplyReview(ids[0]);
    const rows=[...document.querySelectorAll('#yp-apply-review .yp-flow div')].map(row=>({label:row.querySelector('dt')?.childNodes[0]?.textContent||'',value:row.querySelector('dd')?.textContent||''}));
    return {ids, opened, rows, text:document.getElementById('yp-apply-review')?.innerText||''};
  })()`);
  await shot('realtime-1-application-card-390x844.png');
  const reviewDate = (review.rows||[]).find(r=>r.label==='Application Date');
  if (!reviewDate || reviewDate.value !== clockLabel(review.opened)) problems.push('review date '+JSON.stringify(reviewDate)+' want '+clockLabel(review.opened));
  if (/5 Jan 2026|In-game/.test(review.text)) problems.push('review shows game calendar '+review.text.slice(0, 400));
  const applied = await evalJson(`(()=>{
    document.getElementById('yp-review-confirm').click();
    const first=ypReadStock().rentals.find(r=>r.id===${JSON.stringify(review.ids[0])});
    const step=Math.floor(CFG.weekMs/168/4);
    window.__ypOff+=step;
    ypSubmitApply(${JSON.stringify(review.ids[1])});
    const second=ypReadStock().rentals.find(r=>r.id===${JSON.stringify(review.ids[1])});
    window.__ypOff+=step;
    clockStep();
    const hist=ypMergeHistory(ypReadHistory(),[]).events.map(e=>({kind:e.kind,id:e.propertyId,at:e.at,gameMs:e.gameMs}));
    const rows=[...document.querySelectorAll('#yp-history .yp-rent-row')].map(b=>({title:b.querySelector('.yp-row-title')?.textContent||'',when:b.querySelector('.yp-row-price')?.textContent||''}));
    return {first:{status:first.status,appliedAt:first.appliedAt,approveAt:first.approveAt},second:{status:second.status,appliedAt:second.appliedAt,approveAt:second.approveAt},cash:G.cash,week:G.week|0,acc:G.acc,home:!!G.homeChosen,clock:!!G.clockOn,pill:document.getElementById('date').textContent,hist,rows,hour:CFG.weekMs/168};
  })()`);
  if (applied.first.status !== 'application-pending' || applied.second.status !== 'application-pending') problems.push('apply status '+JSON.stringify(applied));
  if (applied.cash !== 30000 || applied.week !== 0 || applied.acc !== 0 || applied.home || applied.clock || applied.pill !== 'Paused') problems.push('boarding or clock during wait '+JSON.stringify({cash:applied.cash,week:applied.week,acc:applied.acc,home:applied.home,clock:applied.clock,pill:applied.pill}));
  if (Math.abs(applied.first.approveAt - applied.first.appliedAt - applied.hour) > 5) problems.push('landlord wait '+JSON.stringify(applied.first));
  const appliedRow = (applied.rows||[]).find(r=>r.title==='Applied for Rental');
  if (!appliedRow || appliedRow.when !== clockLabel(applied.first.appliedAt)) problems.push('applied history row '+JSON.stringify(applied.rows)+' want '+clockLabel(applied.first.appliedAt));
  const accepted = await evalJson(`(()=>{
    document.getElementById('yp-history')?.remove();
    const first=ypReadStock().rentals.find(r=>r.id===${JSON.stringify(review.ids[0])});
    window.__ypOff=first.approveAt-window.__ypRealNow()+30000;
    clockStep();
    document.getElementById('toast')?.classList.remove('show');
    const stock=ypReadStock().rentals;
    const hist=ypMergeHistory(ypReadHistory(),[]).events.map(e=>({kind:e.kind,id:e.propertyId,at:e.at,label:ypEventClockLabel(e)}));
    UI.notifs();
    const notes=[...document.querySelectorAll('.nt')].map(n=>({msg:n.querySelector('div div')?.textContent||'',when:n.querySelector('small')?.textContent||''}));
    return {status:stock.map(r=>r.status),approveAt:first.approveAt,cash:G.cash,week:G.week|0,home:!!G.homeChosen,clock:!!G.clockOn,lease:G.lease&&{months:G.lease.months,start:G.lease.start,end:G.lease.end},hist,notes,sheet:UI.body?UI.body.innerText:''};
  })()`);
  await shot('realtime-2a-notifications-390x844.png');
  const historyView = await evalJson(`(()=>{
    UI.el.classList.remove('open'); document.body.classList.remove('sheetopen');
    ypOpenPropertyHistory();
    return [...document.querySelectorAll('#yp-history .yp-rent-row')].map(b=>({title:b.querySelector('.yp-row-title')?.textContent||'',when:b.querySelector('.yp-row-price')?.textContent||''}));
  })()`);
  await shot('realtime-2b-history-390x844.png');
  if (accepted.status.join() !== 'active,cancelled') problems.push('accept status '+JSON.stringify(accepted.status));
  if (!(accepted.cash < 30000)) problems.push('bond not paid '+accepted.cash);
  if (!accepted.home || !accepted.clock || accepted.week !== 0) problems.push('accept clock '+JSON.stringify(accepted));
  const want = {applied:clockLabel(applied.first.appliedAt), accepted:clockLabel(accepted.approveAt)};
  if (want.applied === want.accepted) problems.push('accept time not later '+JSON.stringify(want));
  const byTitle = t => historyView.filter(r=>r.title===t).map(r=>r.when);
  if (historyView[0]?.title !== 'Applied for Rental') problems.push('history order '+JSON.stringify(historyView));
  if (!byTitle('Applied for Rental').includes(want.applied)) problems.push('history applied '+JSON.stringify(historyView));
  if (byTitle('Accepted')[0] !== want.accepted || byTitle('Tenancy confirmed')[0] !== want.accepted || byTitle('Cancelled')[0] !== want.accepted) problems.push('history accepted '+JSON.stringify(historyView)+' want '+want.accepted);
  if (historyView.some(r=>/5 Jan 2026/.test(r.when))) problems.push('history game calendar '+JSON.stringify(historyView));
  const note = (accepted.notes||[]).find(n=>/accepted/.test(n.msg));
  if (!note || !note.when.startsWith(want.accepted)) problems.push('notification '+JSON.stringify(accepted.notes)+' want '+want.accepted);
  if (/5 Jan 2026/.test(accepted.sheet)) problems.push('notifications game calendar '+accepted.sheet.slice(0, 400));
  const living = await evalJson(`(()=>{
    document.getElementById('yp-history')?.remove();
    ypOpenLivingArrangement();
    const rows=[...document.querySelectorAll('#yp-living .yp-flow div')].map(row=>({label:row.dataset.label||row.querySelector('dt')?.childNodes[0]?.textContent||'',value:row.querySelector('dd')?.textContent||''}));
    return {rows,weekMs:CFG.weekMs};
  })()`);
  await shot('realtime-3-living-arrangement-390x844.png');
  const ends = (living.rows||[]).find(r=>r.label==='Lease ends');
  const dateRow = (living.rows||[]).find(r=>r.label==='Date');
  const leaseEnd = accepted.approveAt + 52*living.weekMs;
  if (accepted.lease?.months !== 12 || accepted.lease?.end - accepted.lease?.start !== 52) problems.push('lease '+JSON.stringify(accepted.lease));
  const leaseDays = 52*living.weekMs/86400000;
  if (Math.abs(leaseDays - 14) > 1) problems.push('12-month lease is not about 14 real days '+living.weekMs);
  if (!ends || ends.value !== dateLabel(leaseEnd) || leaseDays < 13) problems.push('lease ends '+JSON.stringify(ends)+' want '+dateLabel(leaseEnd));
  if (!dateRow || dateRow.value !== want.accepted) problems.push('living date '+JSON.stringify(dateRow)+' want '+want.accepted);
  if (problems.length) { console.error(problems.join('\n')); await finish(1); }
  else { console.log('PASS real time', {applied: want.applied, accepted: want.accepted, leaseEnds: ends.value, leaseDays: +((leaseEnd - accepted.approveAt)/86400000).toFixed(2), history: historyView, notification: note.when}); await finish(0); }
} catch (error) {
  console.error(error);
  await finish(1);
}
