// Confirming a rental starts the week clock and keeps that rental's own town.
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'preview-406b69525cf5');
const outDir = '/opt/cursor/artifacts';
const port = 8879;
const debugPort = 9367;
const kepnock = 'preview:kepnock queensland australia:6';
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: root, stdio: 'ignore'});
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/chrome-yp-confirm-${Date.now()}`, 'about:blank'], {stdio: 'ignore'});
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
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  async function evalJson(expression){
    const result = await cdp.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, sessionId);
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 1800));
    return result.result.value;
  }
  async function shot(name){
    await evalJson(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
    const image = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
    writeFileSync(path.join(outDir, name), Buffer.from(image.data, 'base64'));
  }
  async function boot(url){
    await cdp.send('Page.navigate', {url}, sessionId);
    const ready = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof ypSubmitConfirm==='function'&&typeof clockStep==='function'&&document.readyState==='complete')r(1);else if(Date.now()-t>30000)r(0);else setTimeout(tick,100)};tick()})`);
    await delay(300);
    return ready;
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
  if (!await boot(`http://127.0.0.1:${port}/?v=${Date.now()}`)) problems.push('page did not boot');
  const confirmed = await evalJson(`(()=>{
    document.getElementById('flow')?.remove();
    document.getElementById('status')?.remove();
    document.getElementById('hwov')?.remove();
    G.started=1; G.homeChosen=0; G.clockOn=0; G.week=0; G.acc=0; G.cash=30000; G.statusPick='rent'; G.statusLease=6; G.housing='rent'; G.cur='c1';
    delete G.lease; G.placeName='';
    window.__ypListCentre={label:'Bargara, Queensland, Australia',lon:152.4632,lat:-24.8186,stockKey:'Bargara, Queensland, Australia'};
    const rental={id:${JSON.stringify(kepnock)},suburbKey:'kepnock queensland australia',placeLabel:'Kepnock, Queensland, Australia',locality:'Kepnock',placement:'mapped-building',n:6,lon:152.37,lat:-24.87,weeklyRent:400,bond:2400,kind:'game-starter',status:'approved',owner:'game',appliedGameMs:0,approveGameMs:0,expiresAt:Date.now()+86400000};
    ypWriteStock({version:1,rentals:[rental]});
    ypRecordHistory([ypHistoryEvent(rental.id,'applied',0)]);
    hud();
    const before=G.placeName;
    const logoText=(document.querySelector('header .logo')?.textContent||'').replace(/\s+/g,' ').trim();
    advance(10*60*60*1000);
    const paused={week:G.week|0,pill:document.getElementById('date').textContent,acc:G.acc};
    ypSyncSample(ypReadClock());
    document.getElementById('toast')?.classList.remove('show');
    const cur=ypReadStock().rentals.find(r=>r.id===rental.id);
    const events=ypMergeHistory(ypReadHistory(),[]).events.filter(e=>e.propertyId===rental.id).map(e=>({kind:e.kind,text:e.text,when:ypGameClockLabel(e.gameMs)}));
    const applied=events.find(e=>e.kind==='applied');
    const facts=ypLivingFacts();
    ypOpenHistoryDetail(ypMergeHistory(ypReadHistory(),[]).events.find(e=>e.propertyId===rental.id&&e.kind==='applied'));
    const status=[...document.querySelectorAll('#yp-history-detail .yp-flow div')].map(row=>({label:row.querySelector('dt')?.childNodes[0]?.textContent||'',value:row.querySelector('dd')?.textContent||''}));
    return {
      before, paused, status:cur&&cur.status, bond:cur&&cur.bondPaid, cash:G.cash, week:G.week|0, acc:G.acc,
      home:!!G.homeChosen, clock:!!G.clockOn, pill:document.getElementById('date').textContent,
      logo:logoText, townNode:!!document.getElementById('cityname'), cur:G.cur, place:G.placeName,
      lease:G.lease&&{id:G.lease.id,months:G.lease.months,start:G.lease.start,end:G.lease.end,rent:G.lease.rent},
      living:facts.status, time:facts.time, events, appliedWhen:applied&&applied.when, card:status
    };
  })()`);
  await shot('confirmed-rental-390x844.png');
  const living = await evalJson(`(()=>{
    document.getElementById('yp-history-detail')?.remove();
    document.getElementById('toast')?.classList.remove('show');
    document.querySelector('nav button[aria-label="Property"]')?.click();
    const hooked=document.getElementById('yp-prop-living')?.textContent||'';
    document.getElementById('yp-prop-living')?.click();
    const rows=[...document.querySelectorAll('#yp-living .yp-flow div')].map(row=>({label:row.dataset.label||'',value:row.querySelector('dd')?.textContent||'',hint:row.querySelector('.yp-hint')?.textContent||''}));
    const logo=document.querySelector('header .logo');
    const plot=logo.querySelector('b').getBoundingClientRect();
    const box=logo.getBoundingClientRect();
    const stats=document.querySelector('header .stats').getBoundingClientRect();
    return {open:!!document.getElementById('yp-living'),title:document.getElementById('yp-living-title')?.textContent||'',hooked,rows,logo:(logo.textContent||'').replace(/\s+/g,' ').trim(),townNode:!!logo.querySelector('small')||!!document.getElementById('cityname'),place:G.placeName,pill:document.getElementById('date').textContent,wordmarkTop:plot.top-box.top,overlap:plot.right-stats.left};
  })()`);
  await shot('living-arrangement-390x844.png');
  const livingRow=(label)=> (living.rows||[]).find(row=>row.label===label);
  if (living.hooked !== 'Living Arrangement') problems.push('menu hook '+living.hooked);
  if (!living.open || living.title !== 'Living Arrangement') problems.push('living card '+JSON.stringify({open:living.open,title:living.title}));
  if (living.logo !== 'Your Plot' || living.townNode || living.place !== 'Kepnock' || living.pill !== 'Wk 0') problems.push('living header '+JSON.stringify({logo:living.logo,townNode:living.townNode,place:living.place,pill:living.pill}));
  if (!livingRow('Event') || livingRow('Event').value !== 'Tenancy confirmed') problems.push('living event '+JSON.stringify(living.rows));
  if (!livingRow('Property ID') || livingRow('Property ID').value !== kepnock) problems.push('living id '+JSON.stringify(living.rows));
  if (!livingRow('Location') || livingRow('Location').value !== 'Kepnock') problems.push('living town '+JSON.stringify(living.rows));
  if (!livingRow('Weekly rent') || livingRow('Weekly rent').value !== '$400') problems.push('living rent '+JSON.stringify(living.rows));
  if (!livingRow('Six-week bond') || livingRow('Six-week bond').value !== '$2,400') problems.push('living bond '+JSON.stringify(living.rows));
  if (!livingRow('Tenancy length') || livingRow('Tenancy length').value !== '6 months') problems.push('living length '+JSON.stringify(living.rows));
  if (!livingRow('Lease ends') || livingRow('Lease ends').value !== 'Mon 6 Jul 2026' || livingRow('Lease ends').hint !== 'Renew lease or vacate') problems.push('lease ends '+JSON.stringify(living.rows));
  if (!(living.wordmarkTop < 4) || living.overlap > 1) problems.push('header '+JSON.stringify({wordmarkTop:living.wordmarkTop,overlap:living.overlap,logo:living.logo,pill:living.pill}));
  if (confirmed.before !== 'Bargara, Queensland, Australia') problems.push('stored search '+confirmed.before);
  if (confirmed.logo !== 'Your Plot' || confirmed.townNode) problems.push('logo '+confirmed.logo+' town '+confirmed.townNode);
  if (confirmed.paused.week !== 0 || confirmed.paused.pill !== 'Paused') problems.push('pre-confirm '+JSON.stringify(confirmed.paused));
  if (confirmed.status !== 'active' || confirmed.bond !== 2400 || confirmed.cash !== 27600) problems.push('bond '+JSON.stringify({status:confirmed.status,bond:confirmed.bond,cash:confirmed.cash}));
  if (confirmed.week !== 0 || confirmed.acc !== 0 || confirmed.pill !== 'Wk 0' || !confirmed.home || !confirmed.clock) problems.push('clock '+JSON.stringify(confirmed));
  if (confirmed.place !== 'Kepnock') problems.push('stored town '+confirmed.place);
  if (confirmed.cur !== 'c1') problems.push('cur '+confirmed.cur);
  if (!confirmed.lease || confirmed.lease.id !== kepnock || confirmed.lease.months !== 6 || confirmed.lease.start !== 0 || confirmed.lease.end !== 26 || confirmed.lease.rent !== 400) problems.push('lease '+JSON.stringify(confirmed.lease));
  if (confirmed.living !== 'Renting' || confirmed.time !== 26) problems.push('living '+confirmed.living+' '+confirmed.time);
  const texts = (confirmed.events||[]).map(e=>e.text);
  if (!texts.includes('Applied for Rental') || !texts.includes('Tenancy confirmed')) problems.push('history '+JSON.stringify(confirmed.events));
  if (confirmed.appliedWhen !== 'Mon 5 Jan 2026, 12:00\u00a0AM') problems.push('applied date '+confirmed.appliedWhen);
  const cardStatus = (confirmed.card||[]).find(row=>row.label==='Status');
  const cardEvent = (confirmed.card||[]).find(row=>row.label==='Event');
  if (!cardEvent || cardEvent.value !== 'Applied for Rental') problems.push('card event '+JSON.stringify(confirmed.card));
  if (!cardStatus || cardStatus.value !== 'Tenancy confirmed') problems.push('card status '+JSON.stringify(confirmed.card));
  const advanced = await evalJson(`(()=>{
    document.getElementById('yp-history-detail')?.remove();
    document.getElementById('yp-living')?.remove();
    ypSetTestClock(true);
    const before=G.week|0;
    advance(CFG.weekMs);
    hud();
    document.getElementById('toast')?.classList.remove('show');
    const logo=document.querySelector('header .logo');
    return {before, week:G.week|0, pill:document.getElementById('date').textContent, logo:(logo.textContent||'').replace(/\s+/g,' ').trim(), place:G.placeName, ms:CFG.weekMs};
  })()`);
  await shot('confirmed-week-390x844.png');
  if (advanced.ms !== 30000 || advanced.week !== advanced.before+1 || advanced.pill !== 'Wk '+advanced.week) problems.push('advance '+JSON.stringify(advanced));
  if (advanced.logo !== 'Your Plot' || advanced.place !== 'Kepnock') problems.push('after week '+JSON.stringify(advanced));
  const footprint = await evalJson(`(()=>{
    ypSetTestClock(false);
    G.homeChosen=0; G.clockOn=0; G.week=0; G.acc=0; G.cash=30000; delete G.lease; G.placeName=''; G.cur='c1'; G.statusLease=12;
    window.__ypListCentre={label:'Kepnock',lon:152.37,lat:-24.87,stockKey:'Kepnock'};
    const rental={id:'preview:bargara queensland australia:1',footprintId:'ypb-bargara-1',suburbKey:'bargara queensland australia',placeLabel:'Bargara, Queensland, Australia',locality:'Bargara',placement:'footprint',n:1,lon:152.465,lat:-24.813,weeklyRent:420,bond:2520,kind:'game-starter',status:'approved',owner:'game',expiresAt:Date.now()+86400000};
    ypWriteStock({version:1,rentals:[rental]});
    hud();
    const before=G.placeName;
    ypSyncSample(ypReadClock());
    document.getElementById('toast')?.classList.remove('show');
    const cur=ypReadStock().rentals.find(r=>r.id===rental.id);
    return {before, status:cur&&cur.status, id:G.lease&&G.lease.id, place:G.placeName, pill:document.getElementById('date').textContent, week:G.week|0, home:!!G.homeChosen};
  })()`);
  if (footprint.before !== 'Kepnock') problems.push('footprint before '+footprint.before);
  if (footprint.status !== 'active' || footprint.id !== 'ypb-bargara-1' || footprint.place !== 'Bargara' || footprint.pill !== 'Wk 0' || footprint.week !== 0 || !footprint.home) problems.push('footprint '+JSON.stringify(footprint));
  const oldSave = await evalJson(`(()=>{
    const rental={id:${JSON.stringify(kepnock)},suburbKey:'kepnock queensland australia',placeLabel:'Kepnock, Queensland, Australia',locality:'Kepnock',n:6,lon:152.37,lat:-24.87,weeklyRent:400,bond:2400,kind:'game-starter',status:'active',owner:'game',bondCharged:true,bondPaid:2400,startWeek:0,lastChargedWeek:0,confirmedAt:Date.now()};
    ypWriteStock({version:1,rentals:[rental]});
    window.__ypListCentre={label:'Bargara, Queensland, Australia',lon:152.4632,lat:-24.8186,stockKey:'Bargara, Queensland, Australia'};
    ypSaveCentre();
    G.homeChosen=0; G.clockOn=0; G.week=0; G.acc=0; G.started=1; G.placeName=''; delete G.lease; G.cur='c1';
    save();
    const raw=JSON.parse(localStorage.getItem('fe.global'));
    raw.homeChosen=0; raw.clockOn=0; raw.week=0; raw.acc=0; raw.placeName=''; delete raw.lease;
    raw.last=Date.now()-Math.round(raw.clockMs*1.1);
    localStorage.setItem('fe.global', JSON.stringify(raw));
    window.NOSAVE=1;
    return {clockMs:raw.clockMs,last:raw.last};
  })()`);
  if (!await boot(`http://127.0.0.1:${port}/?reload=confirmed`)) problems.push('reload did not boot');
  const resumed = await evalJson(`(()=>{
    document.getElementById('flow')?.remove();
    document.getElementById('toast')?.classList.remove('show');
    const rental=ypReadStock().rentals.find(r=>r.id===${JSON.stringify(kepnock)});
    return {status:rental&&rental.status,bond:!!(rental&&rental.bondCharged),week:G.week|0,home:!!G.homeChosen,clock:!!G.clockOn,pill:document.getElementById('date').textContent,place:G.placeName||'',logo:(document.querySelector('header .logo')?.textContent||'').replace(/\s+/g,' ').trim(),addr:G.lease&&G.lease.addr||'',id:G.lease&&G.lease.id||''};
  })()`);
  if (!resumed.home || !resumed.clock || resumed.status !== 'active' || !resumed.bond) problems.push('resume tenancy '+JSON.stringify(resumed));
  if (resumed.week !== 1 || resumed.pill !== 'Wk 1') problems.push('resume week '+JSON.stringify(resumed));
  if (resumed.place !== 'Kepnock' || resumed.logo !== 'Your Plot' || resumed.addr !== 'Kepnock' || resumed.id !== kepnock) problems.push('resume place '+JSON.stringify(resumed));
  if (problems.length) { console.error(problems.join('\n')); console.error(JSON.stringify({confirmed, living, advanced, footprint, oldSave, resumed}, null, 2).slice(0, 5000)); await finish(1); }
  else { console.log('PASS confirm clock', {place: confirmed.place, pill: confirmed.pill, cash: confirmed.cash, history: texts, footprint: footprint.place, resumed: resumed.pill}); await finish(0); }
} catch (error) {
  console.error(error);
  await finish(1);
}
