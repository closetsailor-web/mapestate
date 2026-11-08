import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const OUT = '/opt/cursor/artifacts/map-preview';
mkdirSync(OUT, {recursive: true});
const server = spawn('python3', ['preview/localhost-server.py', '--port', '8766'], {cwd: '/workspace', stdio: 'ignore'});
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=9234', '--user-data-dir=/tmp/chrome-yp-handoff', 'about:blank',
], {stdio: 'ignore'});

async function browserWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const info = await (await fetch('http://127.0.0.1:9234/json/version')).json();
      if (info.webSocketDebuggerUrl) return info.webSocketDebuggerUrl;
    } catch {}
    await delay(250);
  }
  throw new Error('Chrome debugging port did not open');
}
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
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
const pageErrors = [];
ws.addEventListener('message', ev => {
  const msg = JSON.parse(ev.data);
  if (msg.method === 'Runtime.exceptionThrown' && msg.sessionId === sessionId) pageErrors.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
});
await cdp.send('Page.addScriptToEvaluateOnNewDocument', {source: `window.__geoReads=0;window.__geoWatch=0;window.__geoPerm=0;window.__locCalls=[];const g={getCurrentPosition(){window.__geoReads++;window.__locCalls.push('getCurrentPosition');},watchPosition(){window.__geoWatch++;window.__locCalls.push('watchPosition');return 1;},clearWatch(){window.__locCalls.push('clearWatch');}};try{Object.defineProperty(navigator,'geolocation',{configurable:true,get(){return g;}});}catch(e){}try{const perms=navigator.permissions;if(perms&&perms.query){const orig=perms.query.bind(perms);perms.query=function(desc){if(desc&&desc.name==='geolocation'){window.__geoPerm++;window.__locCalls.push('permissions:geolocation');return Promise.resolve({state:'prompt',addEventListener(){},removeEventListener(){}});}return orig(desc);};}}catch(e){}`}, sessionId);
await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);

async function evalJson(expression) {
  const result = await cdp.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 500));
  return result.result.value;
}
async function shot(name) {
  const image = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
  writeFileSync(`${OUT}/${name}`, Buffer.from(image.data, 'base64'));
}
async function openFresh() {
  await cdp.send('Page.navigate', {url: 'http://127.0.0.1:8766/?handoff=' + Date.now()}, sessionId);
  const ready = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof flowFinish==='function'&&typeof statusDone==='function')r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,100)};tick()})`);
  if (!ready) throw new Error('Game did not boot');
  const scripts = await evalJson(`({boot:!!window.__ypMapBoot,handoff:!!window.__ypHandoff,src:[...document.scripts].map(s=>s.src).filter(Boolean).slice(-3),errors:${JSON.stringify('x')}})`.replace('"x"', 'null'));
  console.log('BOOT', JSON.stringify(scripts), pageErrors.slice(0, 3));
}
async function setup(kind) {
  const opened = await evalJson(`(()=>{G.hwSeen=1;let err='';try{flowFinish({nick:'tester1',band:7,view:'week',exp:{freq:'week',items:{},yearly:{}},start:'Glimmerbrook'});}catch(e){err=String(e);}const ids=[...document.querySelectorAll('[id]')].map(el=>el.id).filter(id=>id.startsWith('st_')||id==='status'||id==='hwov'||id==='flow');return {err,ids};})()`);
  if (opened.err || !opened.ids.includes('st_' + (kind === 'buy' ? 'buy' : kind === 'room' ? 'room' : 'rent'))) return {kind, setupFailed: true, opened};
  if (kind === 'rent') await evalJson(`document.getElementById('st_rent').click();document.getElementById('st_go').click();document.getElementById('st_lease12').click();document.getElementById('st_go').click();1`);
  else if (kind === 'buy') await evalJson(`document.getElementById('st_buy').click();document.getElementById('st_go').click();1`);
  else await evalJson(`document.getElementById('st_room').click();document.getElementById('st_go').click();1`);
  await delay(600);
  return evalJson(`(()=>{const canvas=document.getElementById('w3dc');const style=canvas?getComputedStyle(canvas):null;const where=document.getElementById('yp-where');return {kind:${JSON.stringify(kind)},statusPick:G.statusPick,listings:!!document.getElementById('listings'),cards:document.querySelectorAll('.lcard').length,hw:document.getElementById('hwov')?.getAttribute('aria-label')||'',where:!!where,whereText:where?.innerText?.replace(/\\s+/g,' ').trim().slice(0,180)||'',basemap:!!document.getElementById('ypbasemap'),preview:document.documentElement.classList.contains('yp-preview'),canvasDisplay:style?style.display:'',canvasVisibility:style?style.visibility:'',geoReads:window.__geoReads||0,geoWatch:window.__geoWatch||0,geoPerm:window.__geoPerm||0,loc:(window.__locCalls||[]).join(','),mapKey:!!document.getElementById('yp-map-status')};})()`);
}

await openFresh();
const rent = await setup('rent');
console.log('RENT', JSON.stringify(rent));
if (rent.setupFailed || !rent.where) {
  server.kill('SIGTERM'); chrome.kill('SIGTERM');
  process.exit(1);
}
await shot('no-key-location-popup-mobile.png');
const mobileNote = await evalJson(`(()=>{const h=document.getElementById('yp-where-title'),i=document.getElementById('yp-where-town'),n=document.getElementById('yp-where-move'),card=document.querySelector('#yp-where .card');const gap=Math.round(n.getBoundingClientRect().top-i.getBoundingClientRect().bottom);const note=document.getElementById('yp-provider-note');return {title:h.textContent,placeholder:i.placeholder,note:n.textContent,gap,margin:getComputedStyle(n).marginTop,about:!!document.getElementById('yp-where-info'),choose:card.innerText.includes('Choose one suggestion'),close:!!document.getElementById('yp-where-close'),provider:note&&note.textContent,providerInside:!!document.querySelector('#yp-where #yp-provider-note')};})()`);
await cdp.send('Emulation.setDeviceMetricsOverride', {width: 1280, height: 800, deviceScaleFactor: 1, mobile: false}, sessionId);
await delay(150);
await shot('no-key-location-popup-desktop.png');
const desktopNote = await evalJson(`(()=>{const i=document.getElementById('yp-where-town'),n=document.getElementById('yp-where-move');return {note:n.textContent,gap:Math.round(n.getBoundingClientRect().top-i.getBoundingClientRect().bottom),about:!!document.getElementById('yp-where-info')};})()`);
await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
await evalJson(`(()=>{if(document.getElementById('yp-rent-list'))throw Error('list opened before Listings');document.getElementById('yp-where-close').click();document.querySelector('nav button[data-v="sale"]').click();return 1;})()`);
await delay(200);
const choice = await evalJson(`(()=>{const buttons=[...document.querySelectorAll('nav button')].map(b=>b.innerText.replace(/\\s+/g,' ').trim());const p=document.getElementById('yp-prop');const cats=p?[...p.querySelectorAll('button')].map(b=>b.textContent):[];return {label:document.querySelector('nav button[data-v="sale"]')?.innerText.replace(/\\s+/g,' ').trim()||'',count:buttons.length,buttons,cats,rentOpen:!!document.getElementById('yp-rent-list'),listings:!!document.getElementById('listings')};})()`);
await shot('no-key-listings-categories.png');
await evalJson(`document.getElementById('yp-cat-sale').click();1`);
const saleEmpty = await evalJson(`document.getElementById('yp-prop')?.innerText.replace(/\\s+/g,' ').trim()||''`);
await shot('no-key-listings-sale-empty.png');
await evalJson(`document.getElementById('yp-cat-back').click();document.getElementById('yp-cat-rent').click();1`);
await delay(100);
const rentList = await evalJson(`(()=>{const p=document.getElementById('yp-rent-list');return {text:p?.innerText?.replace(/\\s+/g,' ').trim()||'',cards:document.querySelectorAll('.lcard').length,listings:!!document.getElementById('listings'),myLocation:!!document.getElementById('yp-where-locate')||!!document.getElementById('yp-locate')};})()`);
await shot('no-key-empty-postcode-list.png');
await evalJson(`document.getElementById('yp-rent-list-back').click();document.querySelector('nav button[data-v="map"]').click();1`);
await delay(100);
const back = await evalJson(`(()=>{const canvas=document.getElementById('w3dc');return {prop:!!document.getElementById('yp-prop'),listings:!!document.getElementById('listings'),cards:document.querySelectorAll('.lcard').length,basemap:!!document.getElementById('ypbasemap'),canvasDisplay:canvas?getComputedStyle(canvas).display:''};})()`);
await openFresh();
const buy = await setup('buy');
await openFresh();
const room = await setup('room');
const report = {label: 'no API key; basemap container only, not live MapTiler tiles', rent, mobileNote, desktopNote, choice, saleEmpty, rentList, back, buy, room};
writeFileSync(`${OUT}/flow-handoff.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
server.kill('SIGTERM');
chrome.kill('SIGTERM');
const paths = [rent, buy, room];
const bad = paths.find(item => item.listings || item.cards || item.hw || !item.where || !item.basemap || item.canvasDisplay !== 'none' || item.geoReads || item.geoWatch || item.geoPerm || item.loc);
const catsOk = choice.label === 'Listings' && choice.count === 5 && choice.cats.join('|') === 'For Sale|For Rent|Room Share|Auctions|Back to map' && !choice.rentOpen;
const noteOk = mobileNote && mobileNote.title === 'Choose location' && mobileNote.placeholder === 'enter town or suburb' && mobileNote.note === 'You can also search on the map' && mobileNote.gap >= 12 && mobileNote.margin === '16px' && !mobileNote.about && !mobileNote.choose && mobileNote.close && mobileNote.provider.includes('Geoapify') && !mobileNote.providerInside && desktopNote.note === mobileNote.note && desktopNote.gap >= 12 && !desktopNote.about;
if (bad || !noteOk || !catsOk || choice.listings || !saleEmpty.includes('For Sale has no listings') || saleEmpty.includes('No postcode was guessed') || rentList.listings || rentList.cards || rentList.myLocation || !rentList.text.includes('Choose a town or suburb first') || rentList.text.includes('No postcode was guessed') || back.listings || back.canvasDisplay !== 'none' || !back.basemap || (rent.whereText||'').includes('My Location')) process.exit(1);
process.exit(0);
