import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const OUT = '/opt/cursor/artifacts/map-preview';
mkdirSync(OUT, {recursive: true});
const server = spawn('python3', ['preview/localhost-server.py', '--port', '8766'], {cwd: '/workspace', stdio: 'ignore'});
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=9237', '--user-data-dir=/tmp/chrome-yp-summary', 'about:blank',
], {stdio: 'ignore'});

async function browserWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const info = await (await fetch('http://127.0.0.1:9237/json/version')).json();
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
async function evalJson(expression) {
  const result = await cdp.send('Runtime.evaluate', {expression, awaitPromise: true, returnByValue: true}, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 800));
  return result.result.value;
}
async function shot(name) {
  const image = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
  writeFileSync(`${OUT}/${name}`, Buffer.from(image.data, 'base64'));
}
async function size(width, height) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: width < 700}, sessionId);
}

try {
  await size(390, 844);
  await cdp.send('Page.navigate', {url: 'http://127.0.0.1:8766/?summary=' + Date.now()}, sessionId);
  const ready = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{const f=document.getElementById('flowframe');if(f&&f.contentWindow&&f.contentWindow.go)r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,100)};tick()})`);
  if (!ready) throw new Error('Signup flow did not load');
  const summary = await evalJson(`(()=>{const w=document.getElementById('flowframe').contentWindow,d=w.document;w.go('income');const sel=d.getElementById('band');sel.value='7';sel.dispatchEvent(new Event('change',{bubbles:true}));w.go('summary');const rows=[...d.querySelectorAll('#sum > .sr2')].map(el=>el.querySelector('.k').textContent);const edits=[...d.querySelectorAll('#sum .link')].map(el=>el.getAttribute('aria-label'));const text=d.getElementById('sum').innerText.replace(/\\s+/g,' ').trim();return {heading:d.getElementById('h-sum').textContent,hero:d.querySelector('#s-summary h1').textContent,rows,edits,text,hasPlace:text.includes('Starting place')||text.includes('Glimmerbrook')};})()`);
  await shot('no-key-summary-no-starting-place-mobile.png');
  await size(1280, 800);
  await delay(150);
  await shot('no-key-summary-no-starting-place-desktop.png');
  await size(390, 844);
  await evalJson(`(()=>{const w=document.getElementById('flowframe').contentWindow,d=w.document;w.go('login');d.getElementById('li-id').value='troyboy';d.getElementById('li-pw').value='password1';d.getElementById('f-login').requestSubmit();return 1;})()`);
  const reachedIncome = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{const d=document.getElementById('flowframe').contentWindow.document;if(d.getElementById('s-income')?.classList.contains('on'))r(1);else if(Date.now()-t>4000)r(0);else setTimeout(tick,100)};tick()})`);
  await evalJson(`(()=>{const w=document.getElementById('flowframe').contentWindow,d=w.document;w.go('summary');d.getElementById('sum-go').click();return 1;})()`);
  const welcome = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{const d=document.getElementById('flowframe').contentWindow.document;const h=d.getElementById('done-h');const msg=d.getElementById('done-msg');if(h&&h.textContent.includes('Welcome back')&&msg&&msg.querySelectorAll('p').length===2){const ps=[...msg.querySelectorAll('p')];const card=msg.closest('.sheet');const box=card.getBoundingClientRect();const btn=d.getElementById('enter').getBoundingClientRect();r({heading:h.textContent,texts:ps.map(el=>el.textContent),paragraphs:ps.length,nameBold:ps[0].querySelector('b')?.textContent==='troyboy',button:d.getElementById('enter')?.textContent||'',overflow:card.scrollHeight-card.clientHeight,buttonBottom:Math.round(btn.bottom),view:window.innerHeight,reachedIncome:${reachedIncome}});}else if(Date.now()-t>4000)r(null);else setTimeout(tick,100)};tick()})`);
  await shot('no-key-welcome-back-mobile.png');
  await size(1280, 800);
  await delay(150);
  await shot('no-key-welcome-back-desktop.png');
  const welcomeDesktop = await evalJson(`(()=>{const d=document.getElementById('flowframe').contentWindow.document;const card=d.getElementById('done-msg').closest('.sheet');const box=card.getBoundingClientRect();const btn=d.getElementById('enter').getBoundingClientRect();return {overflow:card.scrollHeight-card.clientHeight,buttonBottom:Math.round(btn.bottom),view:window.innerHeight,texts:[...d.querySelectorAll('#done-msg p')].map(el=>el.textContent)};})()`);
  const report = {label: 'no API key; summary and welcome-back copy only', summary, welcome, welcomeDesktop};
  writeFileSync(`${OUT}/summary-welcome.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  const ok = summary && summary.heading === "Here's your starting picture" && summary.hero.includes('Almost') && !summary.hasPlace
    && summary.rows.join('|') === 'Take-home pay|Starting savings|Expenses|Left over (after tax)'
    && summary.edits.join('|') === 'Edit Take-home pay|Edit Expenses'
    && summary.text.includes('$30,000') && summary.text.includes('Take-home pay minus expenses')
    && welcome && welcome.heading === 'Welcome back!' && welcome.paragraphs === 2 && welcome.texts[0] === 'Good to see you troyboy, just remember the saying...' && welcome.texts[1] === 'Do not save what is left after spending, but spend what is left after saving.' && welcome.nameBold === true && welcome.button === 'Start playing' && welcome.overflow <= 1 && welcome.buttonBottom <= welcome.view
    && welcomeDesktop && welcomeDesktop.texts[0] === welcome.texts[0] && welcomeDesktop.texts[1] === welcome.texts[1] && welcomeDesktop.overflow <= 1 && welcomeDesktop.buttonBottom <= welcomeDesktop.view;
  if (!ok) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  chrome.kill('SIGTERM');
}
