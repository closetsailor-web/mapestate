import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const OUT = '/opt/cursor/artifacts/map-preview';
mkdirSync(OUT, {recursive: true});
const server = spawn('python3', ['preview/localhost-server.py', '--port', '8772'], {cwd: '/workspace', stdio: 'ignore'});
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=9245', '--user-data-dir=/tmp/chrome-yp-listing', 'about:blank',
], {stdio: 'ignore'});

async function browserWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const info = await (await fetch('http://127.0.0.1:9245/json/version')).json();
      if (info.webSocketDebuggerUrl) return info.webSocketDebuggerUrl;
    } catch {}
    await delay(250);
  }
  throw new Error('Chrome debugging port did not open');
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.errors = [];
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.method === 'Runtime.exceptionThrown') this.errors.push(msg.params?.exceptionDetails?.exception?.description || msg.params?.exceptionDetails?.text || 'exception');
      if (msg.id && this.pending.has(msg.id)) {
        const pending = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? pending.reject(new Error(JSON.stringify(msg.error))) : pending.resolve(msg.result);
      }
    });
  }
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
await new Promise((resolve, reject) => {ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
const cdp = new CDP(ws);
const {targetId} = await cdp.send('Target.createTarget', {url: 'about:blank'});
const {sessionId} = await cdp.send('Target.attachToTarget', {targetId, flatten: true});
await cdp.send('Page.enable', {}, sessionId);
await cdp.send('Runtime.enable', {}, sessionId);
async function evalJson(expression) {
  const result = await cdp.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 900));
  return result.result.value;
}
async function shot(name) {
  const image = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
  writeFileSync(`${OUT}/${name}`, Buffer.from(image.data, 'base64'));
}
const measure = `(()=>{
  const card=document.querySelector('#yp-rent-detail .yp-listing');
  if(!card)return null;
  const place=card.querySelector('.yp-place');
  const price=card.querySelector('.yp-price');
  const cs=place?getComputedStyle(place):null;
  return {
    text:card.innerText,
    title:card.querySelector('h2')?.textContent||'',
    kicker:card.querySelector('.yp-kicker')?.textContent||'',
    images:card.querySelectorAll('img').length,
    icons:card.querySelectorAll('.yp-facts svg[aria-hidden="true"]').length,
    hero:!!card.querySelector('[class*=hero],[class*=photo]'),
    align:cs?cs.textAlign:'',
    size:price?parseFloat(getComputedStyle(price.querySelector('.yp-amt')).fontSize):0,
    overflow:card.scrollWidth>card.clientWidth+2,
    scroll:card.scrollHeight>card.clientHeight,
    action:card.querySelector('#yp-rent-apply')?.textContent||'',
    disabled:!!card.querySelector('#yp-rent-apply')?.disabled,
    rows:[...card.querySelectorAll('.yp-flow div')].map(row=>({label:row.querySelector('dt').childNodes[0].textContent.trim(),amount:row.querySelector('dd').textContent,neg:row.querySelector('dd').classList.contains('yp-neg')}))
  };
})()`;

try {
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
  await cdp.send('Page.navigate', {url: 'http://127.0.0.1:8772/?fresh=1'}, sessionId);
  const ready = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof flowFinish==='function'&&typeof ypOpenRentalDetail==='function')r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,100)};tick()})`);
  if (!ready) throw new Error('page did not boot');
  await evalJson(`(()=>{G.hwSeen=1;flowFinish({nick:'list',band:7,view:'week',exp:{freq:'week',items:{},yearly:{}},start:'Glimmerbrook'});document.getElementById('st_rent').click();document.getElementById('st_go').click();document.getElementById('st_lease12').click();document.getElementById('st_go').click();return 1;})()`);
  const place = 'Searched area 152.5000, -24.8171, past the long coastal fallback name that has to wrap on a phone';
  await evalJson(`(()=>{
    const centre={label:${JSON.stringify(place)},lon:152.5,lat:-24.8171,stockKey:${JSON.stringify(place)}};
    window.__ypListCentre=centre;
    const store=ypEnsureSuburbStock(ypFreshStock(),centre,[{lon:152.501,lat:-24.816}]);
    store.rentals[0].weeklyRent=500;store.rentals[0].bond=500*6;
    ypWriteStock(store);
    ypRenderRentalList();
    document.querySelector('#yp-rent-list .yp-rent-row').click();
    return 1;
  })()`);
  const expected = await evalJson(`(()=>{const income=Math.round(salaryNetWk());const inc=INC();const expenses=Math.round(((+inc.exp||0)+(+inc.debt||0))*12/52);const rent=500;return {income,expenses,left:income-expenses-rent,bank:Math.round(G.cash),bond:3000,after:Math.round(G.cash)-3000,cash:G.cash};})()`);
  await evalJson(`(()=>{document.getElementById('toast')?.classList.remove('show');const node=document.getElementById('coach');if(node)node.style.display='none';return 1})()`);
  const phone = await evalJson(measure);
  await shot('rental-detail-no-history-phone.png');
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 800, deviceScaleFactor: 1, mobile: false}, sessionId);
  await evalJson(`document.getElementById('toast')?.classList.remove('show');1`);
  const desk = await evalJson(measure);
  await shot('rental-detail-no-history-desktop.png');
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
  const fromList = phone && phone.text;
  await evalJson(`document.querySelector('#yp-rent-detail .hwx').click();ypOpenRentalDetail(ypReadStock().rentals[0].id);1`);
  const fromMarker = await evalJson(measure);
  const before = await evalJson(`(()=>({cash:G.cash,status:ypReadStock().rentals[0].status,hist:ypReadHistory().events.length,notes:(G.notifs||[]).length}))()`);
  await evalJson(`document.getElementById('yp-rent-apply').click();1`);
  const review = await evalJson(`(()=>{const p=document.getElementById('yp-apply-review');const r=ypReadStock().rentals[0];return {text:p?p.innerText:'',location:document.getElementById('yp-review-location')?.textContent||'',confirm:p?.querySelector('#yp-review-confirm')?.textContent||'',cancel:!!p?.querySelector('#yp-review-cancel'),income:!!p?.querySelector('.yp-flow'),history:!!p?.querySelector('#yp-property-history'),status:r.status,placeLabel:r.placeLabel,hist:ypReadHistory().events.length,cash:G.cash,notes:(G.notifs||[]).length,charged:!!r.bondCharged};})()`);
  await evalJson(`document.getElementById('yp-review-cancel').click();1`);
  const cancelled = await evalJson(`(()=>({open:!!document.getElementById('yp-apply-review'),status:ypReadStock().rentals[0].status,hist:ypReadHistory().events.length,cash:G.cash,notes:(G.notifs||[]).length}))()`);
  const bargara = await evalJson(`(()=>{
    const saved=ypReadStock();
    window.__ypSavedStock=saved;
    window.__ypSavedCentre=window.__ypListCentre;
    const item={result_type:'suburb',name:'Bargara',suburb:'Bargara',state:'Queensland',country:'Australia',label:'Bargara, Queensland, Australia',lon:152.464,lat:-24.814};
    const store=ypEnsureSuburbStock(ypFreshStock(),item,[{lon:152.465,lat:-24.813}]);
    store.rentals[0].weeklyRent=500;store.rentals[0].bond=3000;
    ypWriteStock(store);
    window.__ypListCentre={label:item.label,lon:item.lon,lat:item.lat,stockKey:item.label,locality:'Bargara'};
    ypOpenApplyReview(store.rentals[0].id);
    document.getElementById('yp-where')?.remove();
    const coach=document.getElementById('coach');if(coach)coach.style.display='none';
    const p=document.getElementById('yp-apply-review');
    const rental=ypReadStock().rentals[0];
    return {text:p.innerText,location:document.getElementById('yp-review-location')?.textContent||'',placeLabel:rental.placeLabel,id:rental.id,header:document.getElementById('cityname')?.textContent||'',size:parseFloat(getComputedStyle(p.querySelector('.yp-amt')).fontSize)};
  })()`);
  await shot('apply-review-your-application-phone.png');
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 800, deviceScaleFactor: 1, mobile: false}, sessionId);
  await shot('apply-review-bargara-desktop.png');
  await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
  const failedSend = await evalJson(`(()=>{const store=ypReadStock();store.rentals[0].status='application-pending';ypWriteStock(store);document.getElementById('yp-review-confirm').click();const open=!!document.getElementById('yp-apply-review');const err=document.getElementById('yp-review-error')?.textContent||'';const detail=!!document.getElementById('yp-rent-detail');store.rentals[0].status='available';ypWriteStock(store);return {open,err,detail,hist:ypReadHistory().events.length};})()`);
  await evalJson(`document.getElementById('yp-review-confirm').click();1`);
  const landed = await evalJson(`(()=>{const r=ypReadStock().rentals[0];const nav=[...document.querySelectorAll('nav button')].map(b=>b.getAttribute('aria-label')||b.textContent.trim());return {review:!!document.getElementById('yp-apply-review'),detail:!!document.getElementById('yp-rent-detail'),history:document.getElementById('yp-history')?.innerText||'',tab:document.getElementById('minebtn')?.classList.contains('on')||false,status:r.status,charged:!!r.bondCharged,cash:G.cash,kinds:ypReadHistory().events.map(e=>e.text),nav};})()`);
  await shot('property-history-after-apply-phone.png');
  await evalJson(`document.getElementById('minebtn').click();1`);
  await shot('bottom-property-menu-phone.png');
  await evalJson(`[...document.querySelectorAll('nav button')].find(b=>b.getAttribute('aria-label')==='Finances').click();1`);
  await shot('bottom-finances-menu-phone.png');
  await evalJson(`[...document.querySelectorAll('nav button')].find(b=>b.getAttribute('aria-label')==='Listings').click();1`);
  await shot('bottom-listings-menu-phone.png');
  await evalJson(`document.getElementById('yp-section-menu')?.remove();1`);
  const afterClock = await evalJson(`(()=>{G.clockOn=1;advance(Math.ceil(CFG.weekMs/168)+5);ypSyncSample(ypReadClock());const r=ypReadStock().rentals[0];return {detail:!!document.getElementById('yp-rent-detail'),history:!!document.getElementById('yp-history'),status:r.status,charged:!!r.bondCharged,cash:G.cash,notes:(G.notifs||[]).filter(n=>n.ypRental).length,text:document.getElementById('yp-history')?.innerText||''};})()`);
  await evalJson(`ypWriteStock(window.__ypSavedStock);window.__ypListCentre=window.__ypSavedCentre;document.getElementById('yp-history')?.remove();document.getElementById('yp-rent-detail')?.remove();1`);
  const fixtures = await evalJson(`(()=>{
    document.getElementById('yp-rent-detail')?.remove();
    const board=document.createElement('div');board.id='yp-fixture-board';
    const banner=document.createElement('p');banner.textContent='Fixtures only. Not live records.';board.appendChild(banner);
    const specs=[
      {kind:'rent',n:9,place:'Fixture place',weeklyRent:640,bond:2560,fixture:true},
      {kind:'sale',n:1,place:'Fixture place',price:505000,fixture:true},
      {kind:'auction',n:2,place:'Fixture place',bid:12000,fixture:true},
      {kind:'roomshare',n:3,place:'Fixture place',share:180,fixture:true}
    ];
    const cards=specs.map(spec=>{const card=document.createElement('div');ypMountListing(card,ypListingModel(spec));board.appendChild(card);return card;});
    document.body.appendChild(board);
    return cards.map(card=>({title:card.querySelector('h2').textContent,text:card.innerText,images:card.querySelectorAll('img').length,icons:card.querySelectorAll('.yp-facts svg').length,actions:card.querySelectorAll('button').length,fixture:!!card.querySelector('.yp-fixture')}));
  })()`);
  await shot('listing-fixtures-not-live.png');
  await evalJson(`document.getElementById('yp-fixture-board')?.remove();ypOpenListingsChoice();1`);
  const empty = await evalJson(`(()=>{
    const read=id=>{ypOpenListingsChoice();document.getElementById(id).click();return document.getElementById('yp-prop-note').innerText;};
    return {sale:read('yp-cat-sale'),room:read('yp-cat-room'),auction:read('yp-cat-auction')};
  })()`);
  console.log(JSON.stringify({expected, phone, fromMarker, review, bargara, cancelled, failedSend, landed, afterClock, desk, fixtures, empty, errors: cdp.errors.slice(0, 4)}, null, 2));
  const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-AU');
  const row = (view, label) => view.rows.find(item => item.label === label);
  const clean = (view) => view && view.title.startsWith('Sample rental') && view.kicker === 'Game sample property' && view.text.includes('$500') && view.text.indexOf('$500') < view.text.indexOf(place) && view.text.includes(money(expected.bond)) && view.icons === 1 && row(view, 'Weekly income').amount === money(expected.income) && row(view, 'Weekly expenses').amount === money(expected.expenses) && row(view, 'Left after this rent').amount === money(expected.left) && row(view, 'In the bank').amount === money(expected.bank) && row(view, 'Bank if the bond were paid').amount === money(expected.after) && view.text.includes('Not a real vacancy') && view.text.includes('does not charge you') && !view.text.includes('2 km') && !/bedroom|bathroom|\bhouse\b|insurance|measured/i.test(view.text) && view.images === 0 && !view.hero && view.align === 'left' && view.size >= 28 && !view.overflow;
  const ok = clean(phone) && clean(fromMarker) && fromList === fromMarker.text
    && !phone.text.includes('No recorded events') && !phone.text.includes('Property History') && !desk.text.includes('No recorded events')
    && review.confirm === 'Confirm application' && review.cancel && !review.income && !review.history
    && review.location === 'Searched area' && !review.text.includes('152.5000') && review.placeLabel.includes('152.5000')
    && bargara.location === 'Bargara' && bargara.placeLabel === 'Bargara, Queensland, Australia' && bargara.id === 'preview:bargara queensland australia:1'
    && bargara.text.startsWith('Your Application') && bargara.location === 'Bargara' && bargara.size >= 28 && bargara.text.includes('Waiting Period') && bargara.text.includes('After confirming your application, you will be notified as soon as possible of the outcome. If approved, we will move you in for free. Best of luck!')
    && !bargara.text.includes('Queensland') && !bargara.text.includes('Australia') && !bargara.text.includes('152.464') && !bargara.text.includes('1 game hour')
    && failedSend.open && failedSend.err.includes('Nothing was charged') && failedSend.hist === 0
    && !landed.review && !landed.detail && landed.tab && landed.status === 'application-pending' && !landed.charged && landed.cash === before.cash && landed.kinds.join(',') === 'Applied for Rental' && landed.history.includes('Applied for Rental') && landed.history.includes('Bargara') && landed.nav.join('|') === 'Property|Finances|Listings|Leaderboard|Settings'
    && review.text.startsWith('Your Application') && review.text.includes('$500') && review.text.includes('$3,000') && review.text.includes('Waiting Period') && review.text.includes('After confirming your application, you will be notified as soon as possible of the outcome. If approved, we will move you in for free. Best of luck!') && !review.text.includes('1 game hour') && !review.text.includes('does not charge you')
    && !review.text.includes('Weekly income') && !review.text.includes('Property History') && !review.text.includes('In the bank')
    && review.status === 'available' && review.hist === 0 && review.cash === before.cash && review.notes === before.notes && !review.charged
    && !cancelled.open && cancelled.status === 'available' && cancelled.hist === 0 && cancelled.cash === before.cash && cancelled.notes === before.notes
    && afterClock.detail === false && afterClock.history === true && afterClock.status === 'approved' && !afterClock.charged && afterClock.cash === before.cash && afterClock.notes === 1 && afterClock.text.includes('Applied for Rental') && !afterClock.text.includes('Confirm and pay bond')
    && clean(desk)
    && fixtures.length === 4
    && fixtures[1].title === 'Sample for sale 1'
    && fixtures.every(card => card.images === 0 && card.actions === 0 && card.fixture && card.text.includes('Not a live record'))
    && !/home|house|bedroom/i.test(fixtures.map(card => card.title).join(' '))
    && empty.sale.includes('no listings') && empty.room.includes('no listings') && empty.auction.includes('no listings')
    && !empty.sale.includes('505,000') && !empty.auction.includes('12,000') && !empty.room.includes('$180')
    && cdp.errors.length === 0;
  if (!ok) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  chrome.kill('SIGTERM');
}
