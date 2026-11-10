// The bell card after an approved rental says "Your application has been approved." first, and history is not apply-only.
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'preview-406b69525cf5');
const outDir = process.env.YP_SHOT_DIR || '/workspace';
const port = 8897, debugPort = 9377;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], {cwd: root, stdio: 'ignore'});
const chrome = spawn('google-chrome', ['--headless=new','--disable-gpu','--no-sandbox','--disable-dev-shm-usage',`--remote-debugging-port=${debugPort}`,`--user-data-dir=/tmp/chrome-yp-approval-${Date.now()}`,'about:blank'], {stdio: 'ignore'});
const problems = [];
async function browserWs(){for(let i=0;i<40;i++){try{const info=await (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).json();if(info.webSocketDebuggerUrl)return info.webSocketDebuggerUrl;}catch{}await delay(250);}throw new Error('Chrome did not start');}
class CDP{constructor(ws){this.ws=ws;this.id=0;this.pending=new Map();ws.addEventListener('message',ev=>{const m=JSON.parse(ev.data);if(m.id&&this.pending.has(m.id)){const p=this.pending.get(m.id);this.pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}});}
send(method,params={},sessionId){const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});const payload={id,method,params};if(sessionId)payload.sessionId=sessionId;this.ws.send(JSON.stringify(payload));});}}
async function finish(code){server.kill('SIGTERM');chrome.kill('SIGTERM');setTimeout(()=>process.exit(code),200);}
try{
  const ws=new WebSocket(await browserWs());await new Promise((r,j)=>{ws.addEventListener('open',r);ws.addEventListener('error',j);});
  const cdp=new CDP(ws);const {targetId}=await cdp.send('Target.createTarget',{url:'about:blank'});const {sessionId}=await cdp.send('Target.attachToTarget',{targetId,flatten:true});
  await cdp.send('Page.enable',{},sessionId);await cdp.send('Runtime.enable',{},sessionId);
  const evalJson=async e=>{const r=await cdp.send('Runtime.evaluate',{expression:e,awaitPromise:true,returnByValue:true},sessionId);if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails).slice(0,1800));return r.result.value;};
  const shot=async n=>{await evalJson(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);const i=await cdp.send('Page.captureScreenshot',{format:'png'},sessionId);writeFileSync(path.join(outDir,n),Buffer.from(i.data,'base64'));};
  await cdp.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},sessionId);
  await cdp.send('Page.navigate',{url:`http://127.0.0.1:${port}/?v=${Date.now()}`},sessionId);
  await evalJson(`new Promise(r=>{const t=Date.now();const tick=()=>{if(typeof ypSyncSample==='function'&&typeof openNotif==='function'&&document.readyState==='complete')r(1);else if(Date.now()-t>30000)r(0);else setTimeout(tick,100)};tick()})`);
  await delay(300);
  const run = async (label, keepHistory) => evalJson(`(()=>{
    ['flow','status','hwov','yp-rent-detail'].forEach(id=>document.getElementById(id)?.remove());
    UI.close&&UI.close();
    G.started=1;G.homeChosen=0;G.clockOn=0;G.week=0;G.acc=0;G.cash=30000;G.statusPick='rent';G.statusLease=12;G.housing='rent';G.cur='c1';delete G.lease;G.notifs=[];
    localStorage.removeItem('yp.propertyHistory.v1');
    const id='preview:branyan queensland australia:4';
    const r={id,suburbKey:'branyan queensland australia',placeLabel:'Branyan, Queensland, Australia',locality:'Branyan',placement:'mapped-building',n:4,lon:152.4,lat:-24.9,weeklyRent:420,bond:2520,kind:'game-starter',status:'available',owner:'game'};
    ypWriteStock({version:1,rentals:[r]});
    const applied=ypApplySample(ypReadStock(),id,ypReadClock());ypWriteStock(applied.store);ypRecordHistory(applied.events);
    if(${keepHistory}){const s=ypReadStock();s.rentals[0].approveAt=Date.now()-1000;s.rentals[0].approveGameMs=0;ypWriteStock(s);ypSyncSample(ypReadClock());}
    else{const s=ypReadStock();Object.assign(s.rentals[0],{status:'active',bondCharged:true,bondPaid:2520,startWeek:0,lastChargedWeek:0,confirmedAt:Date.now()});ypWriteStock(s);G.cash=27480;G.notifs=[{type:'info',msg:'Your rental application was accepted.',w:0,t:Date.now(),read:false,ypRental:id,ypKind:'confirmed'}];}
    const idx=(G.notifs||[]).findIndex(n=>n.ypRental===id);
    openNotif(idx);
    const card=document.querySelector('#yp-rent-detail .yp-listing');
    const text=(card?.innerText||'');
    const approved=document.getElementById('yp-approved-status');
    const hist=[...document.querySelectorAll('#yp-property-history .yp-limit')].map(p=>p.textContent);
    const ia=text.indexOf('Your application has been approved.'), it=text.indexOf('Test tenancy started');
    return {label:${JSON.stringify(label)},idx,approved:approved?.textContent||'',size:approved?parseFloat(getComputedStyle(approved).fontSize):0,ia,it,hasRent:text.includes('$420'),hasPlace:text.includes('Branyan'),hasBond:text.includes('$2,520'),hasNote:text.includes('not ownership of the building'),hist,status:ypReadStock().rentals[0].status};
  })()`);
  const a = await run('auto-approved', true);
  await shot('approval-card-bell-390x844.png');
  await evalJson(`document.querySelector('#yp-rent-detail .yp-listing')?.scrollTo(0,99999);1`);
  await shot('approval-card-history-390x844.png');
  const b = await run('legacy-save-apply-only-history', false);
  for (const v of [a,b]) {
    if (v.idx < 0) problems.push(v.label+' no notification');
    if (v.approved !== 'Your application has been approved.') problems.push(v.label+' approval '+JSON.stringify(v));
    if (!(v.ia >= 0 && v.it > v.ia)) problems.push(v.label+' order '+JSON.stringify(v));
    if (!(v.size >= 16)) problems.push(v.label+' size '+v.size);
    if (!(v.hasRent && v.hasPlace && v.hasBond && v.hasNote)) problems.push(v.label+' details '+JSON.stringify(v));
    if (!v.hist.some(h=>/Tenancy confirmed|Accepted/.test(h))) problems.push(v.label+' history apply-only '+JSON.stringify(v.hist));
    if (!/Tenancy confirmed|Accepted/.test(v.hist[0]||'')) problems.push(v.label+' newest first '+JSON.stringify(v.hist));
  }
  if (problems.length){console.error(problems.join('\n'));console.error(JSON.stringify({a,b},null,2));await finish(1);}
  else {console.log('PASS approval card',{a:{status:a.status,hist:a.hist.map(h=>h.split('.').slice(0,3).join('.'))},b:{hist:b.hist.length}});await finish(0);}
}catch(e){console.error(e);await finish(1);}
