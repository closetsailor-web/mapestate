// Property Owned lists only homes the player owns; a rental stays under Living Arrangement.
import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'preview-406b69525cf5');
const outDir = process.env.YP_SHOT_DIR || '/workspace';
mkdirSync(outDir, {recursive: true});
const port = 8895;
const debugPort = 9375;
const bargaraId = 'preview:bargara queensland australia:1';
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: root, stdio: 'ignore'});
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', `--remote-debugging-port=${debugPort}`, `--user-data-dir=/tmp/chrome-yp-owned-${Date.now()}`, 'about:blank'], {stdio: 'ignore'});
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
    const ready = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof ypBeginConfirmedTenancy==='function'&&typeof UI!=='undefined'&&typeof UI.mine==='function'&&typeof ypOpenLivingArrangement==='function'&&document.readyState==='complete')r(1);else if(Date.now()-t>30000)r(0);else setTimeout(tick,100)};tick()})`);
    await delay(300);
    return ready;
  }
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
  if (!await boot(`http://127.0.0.1:${port}/?v=${Date.now()}`)) problems.push('page did not boot');

  const setup = await evalJson(`(()=>{
    document.getElementById('flow')?.remove();
    document.getElementById('status')?.remove();
    document.getElementById('hwov')?.remove();
    document.getElementById('toast')?.classList.remove('show');
    G.started=1; G.homeChosen=0; G.clockOn=0; G.week=0; G.acc=0; G.cash=27000; G.statusPick='rent'; G.statusLease=12; G.housing='rent'; G.cur='c1';
    delete G.lease; G.placeName='';
    if(typeof CS!=='undefined'&&CS.c1) CS.c1.props={};
    localStorage.removeItem('yp.previewStock.v1');
    localStorage.removeItem('yp.propertyHistory.v1');
    const rental={id:${JSON.stringify(bargaraId)},suburbKey:'bargara queensland australia',placeLabel:'Bargara, Queensland, Australia',locality:'Bargara',placement:'mapped-building',n:1,lon:152.465,lat:-24.813,weeklyRent:500,bond:3000,kind:'game-starter',status:'active',owner:'game',bondCharged:true,bondPaid:3000,startWeek:0,lastChargedWeek:0,confirmedAt:Date.now()};
    ypWriteStock({version:1,rentals:[rental]});
    ypBeginConfirmedTenancy(rental);
    hud();
    return {
      owned:allProps().length,
      lease:(G.lease&&{addr:G.lease.addr,rent:G.lease.rent,months:G.lease.months,end:G.lease.end})||null,
      tenancy:(typeof ypActiveTenancy==='function'&&ypActiveTenancy()||{}).status||null,
      cash:G.cash
    };
  })()`);
  if (setup.owned !== 0) problems.push('setup owned '+JSON.stringify(setup));
  if (setup.tenancy !== 'active' || !setup.lease || setup.lease.rent !== 500) problems.push('setup tenancy '+JSON.stringify(setup));

  const owned = await evalJson(`(()=>{
    UI.close();
    ['yp-living','yp-property-menu','yp-section-menu','yp-pending','yp-history'].forEach(id=>document.getElementById(id)?.remove());
    UI.mine();
    const sheet=document.getElementById('sheet');
    const body=document.getElementById('sheetBody');
    const title=(document.querySelector('#sheet .yp-card-head h2, #sheet h2')?.textContent||'').replace(/\\s+/g,' ').trim();
    const headings=[...document.querySelectorAll('#sheet h3')].map(h=>(h.textContent||'').replace(/\\s+/g,' ').trim());
    const text=(body?.innerText||sheet?.innerText||'').replace(/\\s+/g,' ').trim();
    const empty=(body?.querySelector('li.sub')?.textContent||'').trim();
    return {
      title,
      headings,
      empty,
      text,
      owned:allProps().length,
      hasRentals:headings.some(h=>/rentals/i.test(h))||/\\bRentals\\b/.test(text),
      hasBargara:/Bargara/i.test(text),
      hasRenting:/Renting/i.test(text),
      hasCount: /\\(\\s*\\d+\\s*\\)/.test(title)
    };
  })()`);
  await shot('property-owned-empty-while-renting-390x844.png');
  if (owned.title !== 'My properties' || owned.hasCount) problems.push('owned title '+JSON.stringify(owned));
  if (owned.owned !== 0) problems.push('owned count '+owned.owned);
  if (owned.empty !== "You don't own any properties") problems.push('owned empty '+JSON.stringify(owned.empty));
  if (owned.hasRentals || owned.hasBargara || owned.hasRenting) problems.push('owned still lists rental '+JSON.stringify(owned));
  if (owned.headings.includes('Rentals') || owned.headings.includes('Property I own')) problems.push('owned headings '+JSON.stringify(owned.headings));

  const living = await evalJson(`(()=>{
    UI.close();
    document.getElementById('yp-living')?.remove();
    ypOpenLivingArrangement();
    const card=document.querySelector('#yp-living');
    const title=(card?.querySelector('h2')?.textContent||'').trim();
    const rows=[...document.querySelectorAll('#yp-living .yp-flow [data-label], #yp-living .yp-flow div')].map(row=>{
      const label=row.dataset.label||row.querySelector('dt')?.childNodes[0]?.textContent?.trim()||'';
      const hint=row.querySelector('dt small, dt .yp-hint, .yp-hint')?.textContent?.trim()||row.querySelector('dt')?.textContent||'';
      const value=row.querySelector('dd')?.textContent?.trim()||'';
      return {label,hint,value};
    }).filter(row=>row.label||row.value);
    const text=(card?.innerText||'').replace(/\\s+/g,' ').trim();
    return {title,rows,text,hasBargara:/Bargara/i.test(text),hasRenew:/Renew lease or vacate/i.test(text),hasLease:/Lease ends/i.test(text)};
  })()`);
  await shot('living-arrangement-while-renting-390x844.png');
  if (living.title !== 'Living Arrangement') problems.push('living title '+JSON.stringify(living));
  if (!living.hasBargara) problems.push('living missing Bargara '+JSON.stringify(living));
  if (!living.hasRenew || !living.hasLease) problems.push('living lease row '+JSON.stringify(living));

  const bank = await evalJson(`(()=>{
    document.getElementById('yp-living')?.remove();
    UI.port();
    const title=(document.querySelector('#sheet .yp-card-head h2, #sheet h2')?.textContent||'').replace(/\\s+/g,' ').trim();
    const headings=[...document.querySelectorAll('#sheet h3')].map(h=>(h.textContent||'').replace(/\\s+/g,' ').trim());
    const text=(document.getElementById('sheetBody')?.innerText||'').replace(/\\s+/g,' ').trim();
    return {title,headings,hasRentals:headings.includes('Rentals'),hasBargara:/Bargara/i.test(text)};
  })()`);
  if (bank.title !== 'My properties' || !bank.hasRentals) problems.push('bank rentals missing '+JSON.stringify(bank));

  const menu = await evalJson(`(()=>{
    UI.close();
    ['yp-living','yp-property-menu','yp-section-menu'].forEach(id=>document.getElementById(id)?.remove());
    const btn=[...document.querySelectorAll('nav button')].find(b=>(b.getAttribute('aria-label')||'')==='Property')||document.getElementById('minebtn');
    ypOpenPropertyOptions(btn);
    const items=[...document.querySelectorAll('#yp-property-menu button, #yp-property-menu .yp-item, #yp-property-menu li')].map(el=>(el.textContent||'').trim()).filter(t=>t && t!=='Close' && t!=='✕' && t!=='Property');
    const title=(document.querySelector('#yp-property-menu h2')?.textContent||'').trim();
    return {title,items,open:!!document.getElementById('yp-property-menu')};
  })()`);
  await shot('property-menu-four-items-390x844.png');
  if (menu.title !== 'Property' || menu.items.join('|') !== 'Property Owned|Living Arrangement|Pending Offers|Property History') problems.push('property menu '+JSON.stringify(menu));

  if (problems.length) { console.error(problems.join('\n')); console.error(JSON.stringify({setup, owned, living, bank, menu}, null, 2).slice(0, 6000)); await finish(1); }
  else { console.log('PASS property owned excludes rentals', {title: owned.title, empty: owned.empty, living: living.hasBargara, bank: bank.hasRentals, menu: menu.items}); await finish(0); }
} catch (error) {
  console.error(error);
  await finish(1);
}
