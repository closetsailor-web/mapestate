// Bottom-bar menus use the shared white card, stay above the tapped tab, and keep the pointer.
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'preview-406b69525cf5');
const css = fs.readFileSync(path.join(root, 'map-preview.js'), 'utf8');
assert.equal(css.includes('filter:drop-shadow'), false);
assert.equal(css.includes('box-shadow:none'), false);
assert.equal(css.includes('#yp-property-menu .card,#yp-section-menu .card{position:absolute'), true);
const shared = css.match(/#yp-where \.card[\s\S]*?\{background:#fff;border-radius:24px;[^}]+\}/);
assert.ok(shared && shared[0].includes('#yp-property-menu .card') && shared[0].includes('#yp-section-menu .card') && shared[0].includes('#yp-away .card'));

const outDir = process.env.YP_SHOT_DIR || '/opt/cursor/artifacts';
const port = 8836;
const debugPort = 9303;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: root, stdio: 'ignore'});
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', `--remote-debugging-port=${debugPort}`, '--user-data-dir=/tmp/chrome-yp-menu', 'about:blank'], {stdio: 'ignore'});
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
const ws = new WebSocket(await browserWs());
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
const cdp = new CDP(ws);
const {targetId} = await cdp.send('Target.createTarget', {url: 'about:blank'});
const {sessionId} = await cdp.send('Target.attachToTarget', {targetId, flatten: true});
await cdp.send('Page.enable', {}, sessionId);
await cdp.send('Runtime.enable', {}, sessionId);
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
await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof ypOpenPropertyOptions==='function'&&typeof ypShowAwayCard==='function')r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,80)};tick()})`);
await evalJson(`document.getElementById('flow')?.remove();window.advance=()=>0;1`);
const ref = await evalJson(`(()=>{ypShowAwayCard(2,0);const card=document.querySelector('#yp-away .card');const s=getComputedStyle(card);const out={background:s.backgroundColor,radius:s.borderRadius,shadow:s.boxShadow,padding:s.padding};document.getElementById('yp-away-x').click();return out;})()`);
const menus = [
  ['Property', 'Property Owned'],
  ['Finances', 'Income & Expenses'],
  ['Listings', 'For Sale'],
  ['Leaderboard', 'Global Rankings'],
  ['Settings', 'Profile']
];
const checks = [];
for (const [label, first] of menus) {
  const row = await evalJson(`(()=>{
    const btn=[...document.querySelectorAll('nav button')].find(b=>b.getAttribute('aria-label')==='${label}');
    btn.click();
    const panel=document.getElementById('yp-property-menu')||document.getElementById('yp-section-menu');
    const card=panel.querySelector('.card');
    const s=getComputedStyle(card);
    const head=card.querySelector('.yp-card-head');
    const title=head.querySelector('h2');
    const x=head.querySelector('.yp-x');
    const notch=card.querySelector('.yp-notch');
    const item=card.querySelector('.yp-menu-item');
    const next=card.querySelector('.yp-menu-item + .yp-menu-item');
    const cr=card.getBoundingClientRect();
    const nr=notch.getBoundingClientRect();
    const br=btn.getBoundingClientRect();
    const nav=document.querySelector('nav').getBoundingClientRect();
    const hit=document.elementFromPoint(item.getBoundingClientRect().left+12, item.getBoundingClientRect().top+8);
    return {
      label:panel.dataset.section,
      title:title.textContent,
      titleFits:title.scrollWidth<=title.clientWidth+1,
      close:x&&x.getAttribute('aria-label'),
      first:item.textContent,
      items:[...card.querySelectorAll('.yp-menu-item')].map(b=>b.textContent),
      background:s.backgroundColor,
      radius:s.borderRadius,
      shadow:s.boxShadow,
      padding:s.padding,
      filter:s.filter,
      itemBg:getComputedStyle(item).backgroundColor,
      divider:next?getComputedStyle(next).borderTopColor:'',
      dialogs:ypOpenDialogs(),
      above:cr.bottom<=nav.top+1,
      pointer:Math.abs((nr.left+nr.width/2)-(br.left+br.width/2))<=8,
      notchBelow:nr.top>=cr.bottom-1 && nr.bottom<=nav.top+2,
      onCard:hit===item || card.contains(hit),
      one:ypOpenDialogs().length===1
    };
  })()`);
  checks.push(row);
  await evalJson(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
  if (label === 'Property') await shot('property-menu-390x844.png');
  if (label === 'Listings') await shot('listings-menu-390x844.png');
  await evalJson(`document.querySelector('#yp-property-menu .yp-x,#yp-section-menu .yp-x').click();1`);
}
const problems = [];
if (!(ref.background === 'rgb(255, 255, 255)' && ref.radius === '24px' && ref.shadow.includes('20px 50px'))) problems.push('reference '+JSON.stringify(ref));
for (const row of checks) {
  const dividerOk = row.items.length < 2 || row.divider === 'rgba(20, 33, 61, 0.08)';
  const ok = row.background === ref.background && row.radius === ref.radius && row.shadow === ref.shadow && row.padding === ref.padding && row.filter === 'none' && row.itemBg === 'rgb(255, 255, 255)' && dividerOk && row.title === row.label && row.titleFits && row.close === 'Close' && row.above && row.pointer && row.notchBelow && row.onCard && row.one && row.dialogs[0] && row.dialogs[0].includes('menu');
  if (!ok) problems.push(JSON.stringify(row));
}
const expected = {
  Property: ['Property Owned', 'Living Arrangement', 'Pending Offers', 'Property History'],
  Finances: ['Income & Expenses', 'Borrowing Power'],
  Listings: ['For Sale', 'For Rent', 'Room Share', 'Family', 'Auctions'],
  Leaderboard: ['Global Rankings'],
  Settings: ['Profile', 'Income', 'Expenses', 'Budget', 'Start fresh']
};
for (const row of checks) {
  if (row.items.join('|') !== expected[row.label].join('|')) problems.push('items '+row.label+' '+row.items.join('|'));
  if (row.first !== expected[row.label][0]) problems.push('first '+row.label);
}
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
else console.log('PASS five menus share the white card', checks.map(row => ({label: row.label, shadow: row.shadow === ref.shadow, pointer: row.pointer})));
server.kill('SIGTERM');
chrome.kill('SIGTERM');
setTimeout(() => process.exit(process.exitCode || 0), 200);
