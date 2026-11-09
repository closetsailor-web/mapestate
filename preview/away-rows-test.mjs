// Away card rows: income from the catch-up ledger, borrowing power, and each living status.
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'preview-406b69525cf5');
const outDir = process.env.YP_SHOT_DIR || '/opt/cursor/artifacts';
const port = 8837;
const debugPort = 9304;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: root, stdio: 'ignore'});
const chrome = spawn('google-chrome', ['--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage', `--remote-debugging-port=${debugPort}`, '--user-data-dir=/tmp/chrome-yp-away-rows', 'about:blank'], {stdio: 'ignore'});
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
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 1800));
  return result.result.value;
}
async function shot(name){
  const image = await cdp.send('Page.captureScreenshot', {format: 'png'}, sessionId);
  writeFileSync(path.join(outDir, name), Buffer.from(image.data, 'base64'));
}
await cdp.send('Emulation.setDeviceMetricsOverride', {width: 390, height: 844, deviceScaleFactor: 1, mobile: true}, sessionId);
await cdp.send('Page.navigate', {url: `http://127.0.0.1:${port}/?fresh=1`}, sessionId);
await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof ypAwayRows==='function'&&typeof weekTick==='function')r(1);else if(Date.now()-t>25000)r(0);else setTimeout(tick,80)};tick()})`);
await evalJson(`document.getElementById('flow')?.remove();document.getElementById('status')?.remove();window.advance=()=>0;1`);

const result = await evalJson(`(()=>{
  const problems=[];
  const one=(setup)=>{setup();const rows=ypAwayRows(4,0,{income:1,expense:0});const find=name=>rows.find(item=>item.label===name)||null;return {rows,find};};
  const clearOwn=()=>{for(const c of Object.values(CS))for(const id of Object.keys(c.props))if(c.props[id]&&c.props[id].__ypTest)delete c.props[id];};
  const base=()=>{clearOwn();G.started=1;G.homeChosen=0;G.clockOn=0;G.housing='rent';G.statusPick=null;G.week=8;delete G.famHome;delete G.lease;G.board=0;};
  let gotRows=one(()=>{base();G.homeChosen=1;G.lease={id:'lease',rent:300,months:12,start:0,end:G.week+11,m2m:0,broken:0,addr:'Lot 4'};});
  if(!gotRows.find('Living status')||gotRows.find('Living status').value!=='Renting'||!gotRows.find('Time left')||gotRows.find('Time left').value!=='11 weeks')problems.push('renting with lease '+JSON.stringify(gotRows.rows));
  gotRows=one(()=>{G.lease.m2m=1;});
  if(!gotRows.find('Living status')||gotRows.find('Living status').value!=='Renting'||gotRows.find('Time left'))problems.push('renting month to month still has time');
  gotRows=one(()=>{delete G.lease;});
  if(!gotRows.find('Living status')||gotRows.find('Living status').value!=='Renting'||gotRows.find('Time left'))problems.push('renting without a lease invented time');
  gotRows=one(()=>{G.homeChosen=0;G.clockOn=0;G.statusPick='rent';delete G.lease;});
  if(!gotRows.find('Living status')||gotRows.find('Living status').value!=='Renting'||gotRows.find('Time left'))problems.push('chosen rent before a house');
  gotRows=one(()=>{base();G.clockOn=1;});
  if(!gotRows.find('Living status')||gotRows.find('Living status').value!=='Boarding'||gotRows.find('Time left'))problems.push('no-home board');
  gotRows=one(()=>{base();G.homeChosen=1;G.housing='family';G.board=120;G.famHome={id:'h',addr:'Shared',start:G.week,months:6};});
  if(!gotRows.find('Living status')||gotRows.find('Living status').value!=='Boarding'||gotRows.find('Time left'))problems.push('paid family board with stored months but no end');
  gotRows=one(()=>{G.board=0;G.famHome={id:'h',addr:'Shared',start:G.week,months:12};});
  if(!gotRows.find('Living status')||gotRows.find('Living status').value!=='Living with family or friends'||gotRows.find('Time left'))problems.push('free family stay');
  gotRows=one(()=>{G.famHome={id:'h',addr:'Room',start:G.week,months:0,room:'r1'};G.board=90;});
  if(!gotRows.find('Living status')||gotRows.find('Living status').value!=='Room Sharing'||gotRows.find('Time left'))problems.push('room share');
  gotRows=one(()=>{base();G.statusPick='room';});
  if(gotRows.find('Living status'))problems.push('room intention shown before a room exists');
  gotRows=one(()=>{base();G.statusPick='buy';});
  if(gotRows.find('Living status'))problems.push('buy intention shown as a living status');
  const lot=(GEN[G.cur].lots||[]).find(l=>l.type==='house'||l.type==='unit');
  gotRows=one(()=>{base();CS[G.cur].props[lot.id]={status:'leased',occ:1,loan:0,__ypTest:1};G.homeChosen=1;G.lease={end:G.week+20,m2m:0,rent:200,months:6};});
  if(housing()!=='home'||!gotRows.find('Living status')||gotRows.find('Living status').value!=='Property owner'||gotRows.find('Time left'))problems.push('owner still shows lease time');
  clearOwn();
  base();G.started=1;G.homeChosen=1;G.clockOn=1;G.housing='rent';
  G.lease={id:'lease',rent:250,months:12,start:G.week,end:G.week+40,m2m:0,broken:0,addr:'Lot 9'};
  const sample=weekMoney();
  window.__ypCatch={income:0,expense:0};
  const c0=G.cash;
  for(let i=0;i<4;i++)weekTick();
  const got=window.__ypCatch;
  const cash=G.cash-c0;
  if(Math.round(got.income)!==Math.round(sample.take*4))problems.push('income '+got.income+' vs take '+sample.take*4);
  if(Math.round(got.expense)!==Math.round((sample.rent+sample.liv+sample.debt)*4))problems.push('expense '+JSON.stringify(got));
  if(Math.round(got.income)===Math.round(cash))problems.push('income collapsed to net cash '+cash);
  const shown=ypAwayRows(4,cash,got);
  const incomeRow=shown.find(item=>item.label==='Income received');
  const cashRow=shown.find(item=>item.label==='Savings');
  const savedNeg=ypAwayRows(2,-350,{income:1,expense:1}).find(item=>item.label==='Savings');
  const savedPos=ypAwayRows(2,350,{income:1,expense:1}).find(item=>item.label==='Savings');
  if(!savedNeg||savedNeg.value!=='-$350'||!savedPos||savedPos.value!=='$350'||savedPos.value.includes('+'))problems.push('savings format '+JSON.stringify({savedNeg,savedPos}));
  const power=shown.find(item=>item.label==='Borrowing power');
  if(!incomeRow||incomeRow.value!==fmt(got.income))problems.push('income row '+JSON.stringify(incomeRow));
  if(!cashRow||cashRow.value!==fmt(cash))problems.push('cash row '+JSON.stringify(cashRow));
  if(!power||power.value!==fmt(bank().power))problems.push('power '+JSON.stringify(power)+' '+fmt(bank().power));
  if(shown[0].label!=='Game weeks passed'||shown.map(item=>item.label).indexOf('Income received')>shown.map(item=>item.label).indexOf('Borrowing power'))problems.push('order '+shown.map(item=>item.label).join(','));
  G.week=8;G.lease.end=G.week+9;
  ypShowAwayCard(4,cash,got);
  return {problems,income:fmt(got.income),cash:fmt(cash),power:fmt(bank().power)};
})()`);

await evalJson(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
await shot('away-renting-390x844.png');
const rentShot = await evalJson(`(()=>{const rows=[...document.querySelectorAll('#yp-away .yp-flow [data-label]')].map(row=>({label:row.dataset.label,value:row.querySelector('dd').textContent}));return {rows,close:!!document.getElementById('yp-away-close'),x:!!document.getElementById('yp-away-x')};})()`);
await evalJson(`(()=>{document.getElementById('yp-away')?.remove();for(const c of Object.values(CS))for(const p of Object.values(c.props))p.occ=0;const lot=(GEN[G.cur].lots||[]).find(l=>l.type==='house'||l.type==='unit');CS[G.cur].props[lot.id]={status:'leased',occ:1,loan:0};G.housing='rent';G.homeChosen=1;delete G.lease;delete G.famHome;ypShowAwayCard(6,400,{income:900,expense:500});return housing();})()`);
await evalJson(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);
await shot('away-owner-390x844.png');
const ownerShot = await evalJson(`(()=>{const rows=[...document.querySelectorAll('#yp-away .yp-flow [data-label]')].map(row=>row.dataset.label+':'+row.querySelector('dd').textContent);const one=ypOpenDialogs();UI.port();return {rows,closed:!document.getElementById('yp-away')&&ypOpenDialogs().length===1&&ypOpenDialogs()[0]==='sheet',before:one};})()`);

const problems = result.problems.slice();
const rentLabels = rentShot.rows.map(row => row.label + ':' + row.value);
if (!rentShot.rows.some(row => row.label === 'Living status' && row.value === 'Renting')) problems.push('shot rent ' + JSON.stringify(rentShot));
if (!rentShot.rows.some(row => row.label === 'Time left' && row.value === '9 weeks')) problems.push('shot time ' + JSON.stringify(rentShot));
if (!rentShot.close || !rentShot.x) problems.push('controls missing');
if (!ownerShot.rows.some(row => row === 'Living status:Property owner')) problems.push('shot owner ' + JSON.stringify(ownerShot));
if (ownerShot.rows.some(row => row.startsWith('Time left:'))) problems.push('owner time ' + JSON.stringify(ownerShot));
if (!ownerShot.closed) problems.push('exclusive ' + JSON.stringify(ownerShot));
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
else console.log('PASS away rows', { income: result.income, cash: result.cash, power: result.power, rent: rentLabels });
server.kill('SIGTERM');
chrome.kill('SIGTERM');
setTimeout(() => process.exit(process.exitCode || 0), 200);
