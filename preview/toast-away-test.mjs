// Shared toast timing, and the away catch-up card.
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'preview-406b69525cf5');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.equal(html.includes('game weeks passed while'), false);
assert.ok(html.includes('if(n>1)window.__ypAway={n,cash:G.cash-c0}'));
assert.ok(html.includes('if(n>2&&G.started&&typeof ypShowAwayCard===\'function\')ypShowAwayCard(n,G.cash-c0)'));
assert.equal((html.match(/function toast\(/g)||[]).length, 1);
assert.equal(html.includes('big?4500:2800'), false);

const outDir = process.env.YP_SHOT_DIR || '/opt/cursor/artifacts';
const port = 8835;
const debugPort = 9302;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: root, stdio: 'ignore'});
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', `--remote-debugging-port=${debugPort}`, '--user-data-dir=/tmp/chrome-yp-toast', 'about:blank'], {stdio: 'ignore'});
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
await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof toast==='function'&&typeof ypShowAwayCard==='function')r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,80)};tick()})`);
await evalJson(`document.getElementById('flow')?.remove();window.advance=()=>0;1`);

const timing = await evalJson(`(()=>{
  const seen=[];
  const real=window.setTimeout;
  window.setTimeout=function(fn,ms){seen.push(ms);return real(fn,ms);};
  const expect=text=>{const extra=Math.max(0,text.length-40)*60;return Math.min(12000,6000+extra);};
  const short='Saved';
  const mid='x'.repeat(50);
  const long='y'.repeat(200);
  toast(short);
  toast(mid);
  const replaced=document.getElementById('toast').textContent===mid && document.getElementById('toast').classList.contains('show');
  toast(long);
  const ms=[+document.getElementById('toast').dataset.ms];
  document.getElementById('toast').click();
  const dismissed=!document.getElementById('toast').classList.contains('show');
  window.setTimeout=real;
  return {seen:seen.slice(-3), expect:[expect(short),expect(mid),expect(long)], ms:ms[0], replaced, dismissed, count:document.querySelectorAll('#toast').length};
})()`);

await evalJson(`ypShowAwayCard(26,-1250);1`);
await evalJson(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
await shot('away-card-390x844.png');
const away = await evalJson(`(()=>{
  const card=document.querySelector('#yp-away .card').getBoundingClientRect();
  const head=document.querySelector('#yp-away .yp-card-head').getBoundingClientRect();
  const x=document.getElementById('yp-away-x').getBoundingClientRect();
  return {
    title:document.getElementById('yp-away-title').textContent,
    weeks:document.getElementById('yp-away-weeks').textContent,
    cash:document.getElementById('yp-away-cash').textContent,
    close:document.getElementById('yp-away-close').textContent,
    dialogs:ypOpenDialogs(),
    home:document.documentElement.classList.contains('yp-home'),
    dx:Math.abs((head.left+head.width/2)-(x.left+x.width/2+ (head.width/2- (x.left+x.width/2-head.left)))),
    centred:Math.abs((card.left+card.right)/2 - 195)<8,
    onScreen:card.left>=0&&card.right<=390
  };
})()`);
const closedByOther = await evalJson(`(()=>{
  UI.port();
  return {away:!!document.getElementById('yp-away'), dialogs:ypOpenDialogs()};
})()`);
await evalJson(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
await shot('away-card-closed-by-bank-390x844.png');
await evalJson(`UI.close();ypShowAwayCard(3,40);1`);
const closedByButton = await evalJson(`(()=>{document.getElementById('yp-away-close').click();return {away:!!document.getElementById('yp-away'),home:document.documentElement.classList.contains('yp-home')};})()`);
await evalJson(`ypShowAwayCard(4,-10);1`);
const closedByX = await evalJson(`(()=>{document.getElementById('yp-away-x').click();return {away:!!document.getElementById('yp-away'),home:document.documentElement.classList.contains('yp-home')};})()`);

const problems=[];
if (timing.seen.join(',')!==timing.expect.join(',')) problems.push('timing '+JSON.stringify(timing));
if (!timing.replaced||!timing.dismissed||timing.count!==1||timing.ms!==12000) problems.push('toast behaviour '+JSON.stringify(timing));
if (!(away.title==='While you were away'&&away.weeks==='26 game weeks passed'&&away.cash==='Cash -$1,250'&&away.close==='Close'&&away.dialogs.length===1&&away.dialogs[0]==='yp-away'&&away.home&&away.centred&&away.onScreen)) problems.push('away '+JSON.stringify(away));
if (!(!closedByOther.away&&closedByOther.dialogs.length===1&&closedByOther.dialogs[0]==='sheet')) problems.push('replaced '+JSON.stringify(closedByOther));
if (!(!closedByButton.away&&closedByButton.home&&!closedByX.away&&closedByX.home)) problems.push('close '+JSON.stringify({closedByButton,closedByX}));
if (problems.length){console.error(problems.join('\n'));process.exitCode=1;}
else console.log('PASS toast and away card', {ms:timing.expect, cash:away.cash});
server.kill('SIGTERM');
chrome.kill('SIGTERM');
setTimeout(()=>process.exit(process.exitCode||0),200);
