import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const OUT = '/opt/cursor/artifacts/map-preview';
mkdirSync(OUT, {recursive: true});
const server = spawn('python3', ['preview/localhost-server.py', '--port', '8766'], {cwd: '/workspace', stdio: 'ignore'});
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=9235', '--user-data-dir=/tmp/chrome-yp-visual', 'about:blank',
], {stdio: 'ignore'});
async function browserWs() {
  for (let i = 0; i < 40; i++) {
    try {
      const info = await (await fetch('http://127.0.0.1:9235/json/version')).json();
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
await size(390, 844);
await cdp.send('Page.navigate', {url: 'http://127.0.0.1:8766/'}, sessionId);
const ready = await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{const f=document.getElementById('flowframe');if(f&&f.contentWindow&&f.contentWindow.go)r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,100)};tick()})`);
if (!ready) throw new Error('Signup flow did not load');
const income = await evalJson(`(()=>{const w=document.getElementById('flowframe').contentWindow;w.go('income');const d=w.document,sel=d.getElementById('band'),btn=d.getElementById('band-btn'),list=d.getElementById('band-list');const labels=[...sel.options].filter(o=>o.value!=='').map(o=>o.textContent);btn.click();const open=list.getAttribute('aria-expanded')||btn.getAttribute('aria-expanded');const opts=[...list.querySelectorAll('[role=option]')].map(el=>el.textContent);const key=()=>{const opt=list.querySelector('.on');opt.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));opt.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));};return {placeholder:btn.textContent,disabled:d.getElementById('inc-go').disabled,count:labels.length,labels,opts,expanded:btn.getAttribute('aria-expanded'),nativeHidden:getComputedStyle(sel).pointerEvents};})()`);
await shot('income-picker-open-mobile.png');
await size(1280, 800);
await delay(150);
await shot('income-picker-open-desktop.png');
const interact = await evalJson(`(()=>{const w=document.getElementById('flowframe').contentWindow,d=w.document,sel=d.getElementById('band'),btn=d.getElementById('band-btn'),list=d.getElementById('band-list');function press(el,key){el.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}));}press(list.querySelector('.on'),'ArrowDown');press(d.activeElement,'Enter');const picked={value:sel.value,button:btn.textContent,closed:list.hidden,goDisabled:d.getElementById('inc-go').disabled};btn.click();press(list.querySelector('.on'),'Escape');const escaped=list.hidden&&d.activeElement===btn;btn.click();d.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));const outside=list.hidden;return {picked,escaped,outside};})()`);
await size(390, 844);
await evalJson(`document.getElementById('flow').style.display='none';hwShow(3);1`);
await delay(200);
const popup = await evalJson(`(()=>{const o=document.getElementById('hwov'),ps=[...o.querySelectorAll('p')],p=ps[0],cs=getComputedStyle(p),btn=o.querySelector('#hw_next'),back=o.querySelector('#hw_back');const card=o.querySelector('.hwc'),cardBox=card.getBoundingClientRect();return {text:p.textContent,paragraphs:ps.length,heading:o.querySelector('h3').textContent,buttons:[...o.querySelectorAll('button')].map(b=>b.textContent),rows:o.querySelectorAll('.hwr').length,font:cs.fontFamily,size:cs.fontSize,weight:cs.fontWeight,color:cs.color,align:cs.textAlign,gotMargin:getComputedStyle(btn).marginTop,backMargin:back?getComputedStyle(back).marginTop:'',overflow:card.scrollHeight-card.clientHeight,cardBottom:Math.round(cardBox.bottom),view:window.innerHeight};})()`);
await shot('save-up-popup-mobile.png');
await size(1280, 800);
await delay(150);
await shot('save-up-popup-desktop.png');
const popupDesktop = await evalJson(`(()=>{const o=document.getElementById('hwov'),card=o.querySelector('.hwc'),box=card.getBoundingClientRect();return {gotMargin:getComputedStyle(o.querySelector('#hw_next')).marginTop,backMargin:getComputedStyle(o.querySelector('#hw_back')).marginTop,overflow:card.scrollHeight-card.clientHeight,cardBottom:Math.round(box.bottom),view:window.innerHeight};})()`);
const report = {label: 'visual checks, no map key and no live tiles', income, interact, popup, popupDesktop};
writeFileSync(`${OUT}/visual-fixes.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
server.kill('SIGTERM');
chrome.kill('SIGTERM');
const expected = ['$0 – $10,000','$10,000 – $20,000','$20,000 – $30,000','$30,000 – $40,000','$40,000 – $50,000','$50,000 – $60,000','$60,000 – $70,000','$70,000 – $80,000','$80,000 – $90,000','$90,000 – $100,000','$100,000 – $110,000','$110,000 – $120,000','$120,000 – $130,000','$130,000 – $140,000','$140,000 – $150,000','$150,000 – $160,000','$160,000 – $170,000','$170,000 – $180,000','$180,000 – $190,000','$190,000 – $200,000'];
let fail = 0;
if (income.count !== 20 || JSON.stringify(income.labels) !== JSON.stringify(expected) || JSON.stringify(income.opts) !== JSON.stringify(expected)) fail = 1;
if (income.placeholder !== 'Select your income' || income.disabled !== true || income.expanded !== 'true' || income.nativeHidden !== 'none') fail = 1;
if (interact.picked.value !== '1' || interact.picked.button !== '$10,000 – $20,000' || interact.picked.goDisabled !== false || !interact.picked.closed || !interact.escaped || !interact.outside) fail = 1;
const body = 'Looks like you may have to start saving towards your first home deposit. Room share or boarding is usually the best way to save if other players have something available. You can live with family or friends for free also.';
if (popup.text !== body || popup.paragraphs !== 1 || popup.heading !== 'Save up first?' || popup.rows !== 0 || popup.align !== 'center' || popup.color !== 'rgb(90, 103, 128)' || popup.gotMargin !== '24px' || popup.backMargin !== '2px' || popup.overflow > 1 || popup.cardBottom > popup.view) fail = 1;
if (!popupDesktop || popupDesktop.gotMargin !== '24px' || popupDesktop.backMargin !== '2px' || popupDesktop.overflow > 1 || popupDesktop.cardBottom > popupDesktop.view) fail = 1;
process.exit(fail);
