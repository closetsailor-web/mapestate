/* Your Plot bills, due dates and notifications (dates107).
   Expense entry at the start is unchanged. Due dates and reminders live on the Bills card,
   with a one-question prompt when a game bill such as car rego comes up. */

const YP_NOTIFY_TYPES={
  billDue:{label:'Bill Due',icon:'bell',col:'#b8410a'},
  regoDue:{label:'Rego Due',icon:'car',col:'#b8410a'},
  houseSettling:{label:'House Settling',icon:'key',col:'#0b2545'},
  houseSettled:{label:'House Settled',icon:'key',col:'#f47b20'},
  rentalApproved:{label:'Rental Approved',icon:'dollar',col:'#164ea3'},
  financeApproved:{label:'Finance Approved',icon:'bank',col:'#0b2545'}
};
const YP_NOTIFY_LEADS={
  day:{label:'The Day Before',ms:86400000},
  '3days':{label:'3 Days Before',ms:3*86400000},
  week:{label:'A Week Before',ms:7*86400000}
};
const YP_BILL_FREQ={
  week:{label:'Weekly',weeks:1,unit:'a week'},
  fortnight:{label:'Fortnightly',weeks:2,unit:'a fortnight'},
  month:{label:'Monthly',weeks:4,unit:'a month'},
  quarter:{label:'Quarterly',weeks:13,unit:'a quarter'},
  year:{label:'Yearly',weeks:52,unit:'a year'}
};
const YP_BILL_EXP_NAMES={
  transport:'Transport and Fuel',rego:'Car Registration (Rego)',carins:'Car Insurance',
  phone:'Phone',internet:'Internet',power:'Electricity',gaswater:'Gas and Water',
  food:'Groceries and Food',fun:'Eating Out and Fun',health:'Health and Medical',
  clothes:'Clothes and Personal',childsupport:'Child Support',
  subs:'Subscriptions',other:'Other'
};

function ypNotifyMoney(n){
  if(typeof ypMoneyText==='function')return ypMoneyText(Math.round(+n||0));
  if(typeof fmt==='function')return fmt(Math.round(+n||0));
  return '$'+Math.round(+n||0).toLocaleString();
}
function ypNotifyEsc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function ypNotifyState(){
  if(typeof G==='undefined'||!G)return null;
  if(!G.notify||typeof G.notify!=='object')G.notify={};
  const n=G.notify;
  if(!n.prefs||typeof n.prefs!=='object')n.prefs={};
  Object.keys(YP_NOTIFY_TYPES).forEach(k=>{if(typeof n.prefs[k]!=='boolean')n.prefs[k]=true;});
  if(!n.fired||typeof n.fired!=='object')n.fired={};
  if(!n.schedules||typeof n.schedules!=='object')n.schedules={};
  return n;
}
function ypNotifyPrefs(){const n=ypNotifyState();return n?Object.assign({},n.prefs):Object.fromEntries(Object.keys(YP_NOTIFY_TYPES).map(k=>[k,true]));}
function ypNotifyPrefOn(type){const p=ypNotifyPrefs();return p[type]!==false;}
function ypNotifySetPref(type,on){
  const n=ypNotifyState();if(!n||!YP_NOTIFY_TYPES[type])return;
  n.prefs[type]=!!on;
  if(typeof save==='function')save();
  ypNotifySync();
}
function ypNotifyTypeOn(type){return ypNotifyPrefOn(type);}

function ypNotifyPermission(){
  try{
    if(ypNotifyAdapter.kind()==='capacitor')return (ypNotifyState()||{}).native||'default';
    if(typeof Notification==='undefined')return 'unsupported';
    return Notification.permission;
  }catch(e){return 'unsupported';}
}
function ypNotifyWanted(){const n=ypNotifyState();return !!(n&&n.wanted);}
function ypNotifyCanPush(){const p=ypNotifyPermission();return p==='granted'&&ypNotifyWanted();}

/* ----- adapter: web Notification + service worker, or Capacitor when present ----- */
const ypNotifyTimers={};
const ypNotifyAdapter={
  kind(){
    try{
      const C=window.Capacitor;
      if(C&&C.Plugins&&(C.Plugins.LocalNotifications||C.Plugins.PushNotifications))return 'capacitor';
    }catch(e){}
    return 'web';
  },
  async requestPermission(){
    if(this.kind()==='capacitor'){
      const C=window.Capacitor.Plugins;
      const Local=C.LocalNotifications,Push=C.PushNotifications;
      let ok=false;
      try{if(Local&&Local.requestPermissions){const r=await Local.requestPermissions();ok=ok||(r&&(r.display==='granted'||r.receive==='granted'));}}catch(e){}
      try{if(Push&&Push.requestPermissions){const r=await Push.requestPermissions();ok=ok||(r&&r.receive==='granted');}}catch(e){}
      const n=ypNotifyState();if(n)n.native=ok?'granted':'denied';
      return ok?'granted':'denied';
    }
    if(typeof Notification==='undefined')return 'unsupported';
    try{return await Notification.requestPermission();}catch(e){return 'denied';}
  },
  async schedule(id,at,title,body,data){
    const when=+at;
    if(!id||!Number.isFinite(when))return;
    this.cancel(id);
    if(this.kind()==='capacitor'){
      const Local=window.Capacitor.Plugins.LocalNotifications;
      if(!Local||!Local.schedule)return;
      const nid=ypNotifyNativeId(id);
      const atDate=new Date(Math.max(Date.now()+500,when));
      try{
        await Local.schedule({notifications:[{id:nid,title:title||'Your Plot',body:body||'',schedule:{at:atDate,allowWhileIdle:true},extra:Object.assign({ypId:id},data||{})}]});
      }catch(e){}
      return;
    }
    const delay=when-Date.now();
    const fire=()=>ypNotifyShowWeb(title,body,id,data);
    if(delay<=0){fire();return;}
    ypNotifyTimers[id]=setTimeout(fire,Math.min(delay,2147483646));
  },
  cancel(id){
    if(!id)return;
    if(ypNotifyTimers[id]){clearTimeout(ypNotifyTimers[id]);delete ypNotifyTimers[id];}
    if(this.kind()==='capacitor'){
      const Local=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.LocalNotifications;
      if(Local&&Local.cancel){try{Local.cancel({notifications:[{id:ypNotifyNativeId(id)}]});}catch(e){}}
    }
  }
};
function ypNotifyNativeId(id){
  let h=2166136261;
  const s=String(id);
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0)%2147483646+1;
}
async function ypNotifyShowWeb(title,body,tag,data){
  if(!ypNotifyCanPush())return;
  const opts={body:body||'',tag:String(tag||'yp'),data:data||{},icon:undefined};
  try{
    const reg=navigator.serviceWorker&&await navigator.serviceWorker.ready;
    if(reg&&reg.showNotification){await reg.showNotification(title||'Your Plot',opts);return;}
  }catch(e){}
  try{new Notification(title||'Your Plot',opts);}catch(e){}
}
function ypNotifyRegisterWorker(){
  try{
    if(!('serviceWorker' in navigator))return;
    const src=(document.currentScript&&document.currentScript.src)||'';
    const url=src?new URL('yp-sw.js',src).href:'yp-sw.js';
    navigator.serviceWorker.register(url,{scope:new URL('.',url).href}).catch(()=>{});
  }catch(e){}
}

function ypNotifyInApp(type,msg,id,quiet){
  if(!YP_NOTIFY_TYPES[type])type='info';
  if(typeof notify==='function'){
    if(typeof NOTIF_TYPES==='object'&&NOTIF_TYPES&&!NOTIF_TYPES[type]&&YP_NOTIFY_TYPES[type]){
      NOTIF_TYPES[type]={icon:YP_NOTIFY_TYPES[type].icon,col:YP_NOTIFY_TYPES[type].col,label:YP_NOTIFY_TYPES[type].label};
    }
    notify(type,msg,id,quiet);
    return;
  }
  if(typeof toast==='function'&&!quiet)toast(msg);
}
function ypNotifyEvent(type,msg,id,opts){
  opts=opts||{};
  const n=ypNotifyState();
  const key=opts.key||(type+':'+String(id||msg||''));
  if(n&&n.fired[key]&&!opts.repeat)return false;
  if(!ypNotifyTypeOn(type)){if(n&&!opts.repeat)n.fired[key]=1;return false;}
  if(n&&!opts.repeat)n.fired[key]=1;
  ypNotifyInApp(type,msg,id,opts.quiet);
  if(opts.scheduleAt&&ypNotifyCanPush()&&ypNotifyTypeOn(type)){
    ypNotifyAdapter.schedule(type+':'+key,opts.scheduleAt,YP_NOTIFY_TYPES[type].label,msg,{type,id});
  }
  if(typeof save==='function')save();
  return true;
}
function ypNotifySchedule(type,key,at,title,body,id){
  if(!ypNotifyTypeOn(type)||!ypNotifyCanPush())return;
  const when=+at;
  if(!Number.isFinite(when)||when<Date.now()-60000)return;
  const n=ypNotifyState();
  if(n)n.schedules[type+':'+key]={type,key,at:when,title,body,id:id||null};
  ypNotifyAdapter.schedule(type+':'+key,when,title||YP_NOTIFY_TYPES[type].label,body,{type,id});
}
function ypNotifyCancel(type,key){
  const id=type+':'+key;
  ypNotifyAdapter.cancel(id);
  const n=ypNotifyState();
  if(n&&n.schedules)delete n.schedules[id];
}

/* ----- Bills data ----- */
function ypBillsStore(){
  if(typeof G==='undefined'||!G)return null;
  if(!G.bills||typeof G.bills!=='object')G.bills={v:1,items:{}};
  if(!G.bills.items||typeof G.bills.items!=='object')G.bills.items={};
  G.bills.v=1;
  return G.bills;
}
function ypBillsFreqOfExpense(k,ex){
  if(ex&&ex.yearly&&ex.yearly[k])return 'year';
  const f=ex&&ex.freq;
  if(f==='week'||f==='weekly')return 'week';
  if(f==='fortnight'||f==='fortnightly')return 'fortnight';
  if(f==='month'||f==='monthly')return 'month';
  if(f==='year'||f==='yearly'||f==='annual')return 'year';
  return 'week';
}
function ypBillsExpenseAmount(k,ex,freq){
  if(!ex||!ex.items||ex.items[k]==null)return 0;
  const raw=+ex.items[k]||0;
  const from=ex.yearly&&ex.yearly[k]?'year':ypBillsFreqOfExpense(k,Object.assign({},ex,{yearly:{}}));
  const a=raw,src=YP_BILL_FREQ[from]?from:'week',dst=YP_BILL_FREQ[freq]?freq:src;
  if(src===dst)return Math.round(a);
  const perYear=a*(YP_BILL_FREQ[src].perYear||(52/YP_BILL_FREQ[src].weeks));
  // use weeks ratio
  return Math.round(a*YP_BILL_FREQ[src].weeks/YP_BILL_FREQ[dst].weeks);
}
function ypBillsUpsert(item,opts){
  const store=ypBillsStore();if(!store||!item||!item.id)return null;
  const prev=store.items[item.id]||{};
  const next=Object.assign({},prev);
  next.id=item.id;
  if(item.source)next.source=item.source;
  if(item.kind)next.kind=item.kind;
  if(item.name)next.name=item.name;
  if(item.amount!=null&&!(opts&&opts.keepAmount))next.amount=Math.max(0,Math.round(+item.amount||0));
  if(item.freq&&YP_BILL_FREQ[item.freq]&&!(opts&&opts.keepFreq&&prev.freq))next.freq=item.freq;
  if(!YP_BILL_FREQ[next.freq])next.freq=item.freq&&YP_BILL_FREQ[item.freq]?item.freq:'month';
  if(item.carId)next.carId=item.carId;
  if(item.notifyType)next.notifyType=item.notifyType;
  if(item.autoDue&&next.dueWeek==null&&Number.isFinite(+item.dueWeek))next.dueWeek=+item.dueWeek|0;
  if(typeof next.remind!=='boolean')next.remind=!!prev.remind;
  if(!YP_NOTIFY_LEADS[next.lead])next.lead=prev.lead&&YP_NOTIFY_LEADS[prev.lead]?prev.lead:'week';
  if(typeof next.asked!=='boolean')next.asked=!!prev.asked;
  if(next.choice!=='yes'&&next.choice!=='no')next.choice=prev.choice==='yes'||prev.choice==='no'?prev.choice:null;
  store.items[item.id]=next;
  return next;
}
function ypBillsSyncFromExpenses(){
  const store=ypBillsStore();if(!store)return;
  const ex=(typeof G!=='undefined'&&G&&G.income&&G.income.ex)||null;
  const items=ex&&ex.items||{};
  const cats=(typeof EXP13!=='undefined'&&Array.isArray(EXP13))?EXP13:Object.keys(YP_BILL_EXP_NAMES).map(k=>[k]);
  const seen=new Set();
  cats.forEach(row=>{
    const k=row[0];
    const amt=+items[k]||0;
    if(!(amt>0)){
      const id='exp:'+k;
      if(store.items[id]&&store.items[id].source==='expense'&&store.items[id].dueWeek==null&&!store.items[id].remind)delete store.items[id];
      return;
    }
    const freq=ypBillsFreqOfExpense(k,ex);
    const name=YP_BILL_EXP_NAMES[k]||row[2]||k;
    const amount=Math.round(amt);
    const prev=store.items['exp:'+k];
    ypBillsUpsert({id:'exp:'+k,source:'expense',kind:'bill',name,amount,freq,notifyType:'billDue'},{keepFreq:!!(prev&&prev.dueWeek!=null),keepAmount:false});
    seen.add('exp:'+k);
  });
}
function ypBillsSyncFromCars(){
  const store=ypBillsStore();if(!store)return;
  const cars=(typeof ypCarOwned==='function'?ypCarOwned():((typeof G!=='undefined'&&G&&G.vehicles)||[])).filter(v=>v&&(typeof ypCarIsHandedOver!=='function'||ypCarIsHandedOver(v)||v.handedOver||v.status==='owned'));
  const live=new Set();
  cars.forEach(car=>{
    if(!car||!car.id)return;
    let costs=null;
    try{costs=typeof ypCarRunningCosts==='function'?ypCarRunningCosts(car):null;}catch(e){}
    const title=(typeof ypCarTitle==='function'?ypCarTitle(car):'')||'Your Car';
    const week=Number.isFinite(+car.handedWeek)?+car.handedWeek:(Number.isFinite(+car.boughtWeek)?+car.boughtWeek:(typeof G!=='undefined'&&G?G.week|0:0));
    const regoWk=costs?+costs.rego||0:(typeof YP_CAR_REGO_WK==='number'?YP_CAR_REGO_WK:17);
    const insWk=costs?+costs.insurance||0:0;
    const regoId='game:rego:'+car.id;
    const insId='game:ins:'+car.id;
    const existing=store.items[regoId];
    ypBillsUpsert({
      id:regoId,source:'game',kind:'rego',name:'Car Rego · '+title,
      amount:Math.round(regoWk*52),freq:'year',carId:car.id,notifyType:'regoDue',
      autoDue:true,dueWeek:existing&&existing.dueWeek!=null?existing.dueWeek:(week+52)
    },{keepFreq:!!(existing&&existing.dueWeek!=null)});
    live.add(regoId);
    if(insWk>0){
      const prev=store.items[insId];
      ypBillsUpsert({
        id:insId,source:'game',kind:'insurance',name:'Car Insurance · '+title,
        amount:Math.round(insWk*52),freq:'year',carId:car.id,notifyType:'billDue',
        autoDue:true,dueWeek:prev&&prev.dueWeek!=null?prev.dueWeek:(week+52)
      },{keepFreq:!!(prev&&prev.dueWeek!=null)});
      live.add(insId);
    }
  });
  Object.keys(store.items).forEach(id=>{
    if(id.indexOf('game:rego:')===0||id.indexOf('game:ins:')===0){
      if(!live.has(id)&&store.items[id].source==='game'&&!store.items[id].remind&&store.items[id].choice!=='yes'){
        /* keep if they already set a date or reminder; drop leftover of a sold/missing car with no setup */
        if(store.items[id].dueWeek==null)delete store.items[id];
      }
    }
  });
}
function ypBillsEnsure(){
  if(!ypBillsStore())return [];
  ypNotifyState();
  ypBillsSyncFromExpenses();
  ypBillsSyncFromCars();
  ypBillsRollDues();
  return ypBillsList();
}
function ypBillsRollDues(){
  const store=ypBillsStore();if(!store)return;
  const week=(typeof G!=='undefined'&&G)?(G.week|0):0;
  let changed=false;
  Object.values(store.items).forEach(it=>{
    if(!it||it.dueWeek==null||!Number.isFinite(+it.dueWeek))return;
    const step=(YP_BILL_FREQ[it.freq]||YP_BILL_FREQ.year).weeks;
    let w=+it.dueWeek|0;
    if(!(step>0))return;
    while(w<week){w+=step;changed=true;}
    if(w!==(+it.dueWeek|0))it.dueWeek=w;
  });
  if(changed&&typeof save==='function')save();
}
function ypBillsNextWeek(it,week){
  if(!it||it.dueWeek==null||!Number.isFinite(+it.dueWeek))return NaN;
  const now=Number.isFinite(+week)?+week:(typeof G!=='undefined'&&G?G.week|0:0);
  const step=(YP_BILL_FREQ[it.freq]||YP_BILL_FREQ.year).weeks;
  let w=+it.dueWeek|0;
  if(step>0){while(w<now)w+=step;}
  return w;
}
function ypBillsList(){
  const store=ypBillsStore();if(!store)return [];
  const week=(typeof G!=='undefined'&&G)?(G.week|0):0;
  const list=Object.values(store.items).filter(Boolean).map(it=>{
    const next=ypBillsNextWeek(it,week);
    return Object.assign({},it,{nextWeek:next});
  });
  list.sort((a,b)=>{
    const an=Number.isFinite(a.nextWeek),bn=Number.isFinite(b.nextWeek);
    if(an&&bn&&a.nextWeek!==b.nextWeek)return a.nextWeek-b.nextWeek;
    if(an&&!bn)return -1;
    if(!an&&bn)return 1;
    return String(a.name||'').localeCompare(String(b.name||''));
  });
  return list;
}
function ypBillsGet(id){const s=ypBillsStore();return s&&s.items[id]||null;}
function ypBillsSave(){if(typeof save==='function')save();ypBillsRefreshOpen();ypNotifySync();if(typeof ypSyncFeed==='function')ypSyncFeed();if(typeof hud==='function')hud();}

function ypBillsDueLabel(it){
  const w=ypBillsNextWeek(it);
  if(!Number.isFinite(w))return 'Due Date: Not Set';
  const weekLab=typeof ypGameWeekLabel==='function'?ypGameWeekLabel(w):('Week '+w);
  let real='';
  try{
    if(typeof ypWallAt==='function'&&typeof CFG!=='undefined'&&CFG){
      const wall=ypWallAt(w*CFG.weekMs);
      if(typeof ypRealDateLabel==='function')real=ypRealDateLabel(wall);
    }
  }catch(e){}
  return real?('Due Date: '+weekLab+' · '+real):('Due Date: '+weekLab);
}
function ypBillsAmountText(it){
  const freq=YP_BILL_FREQ[it&&it.freq]||YP_BILL_FREQ.month;
  return ypNotifyMoney(it&&it.amount)+' '+freq.unit;
}
function ypBillsWeekLabel(){
  ypBillsEnsure();
  const week=(typeof G!=='undefined'&&G)?(G.week|0):0;
  const next=ypBillsList().find(it=>Number.isFinite(it.nextWeek)&&it.nextWeek>=week);
  if(!next)return 'Set Up Bills';
  const when=next.nextWeek===week?'This Week':(typeof ypGameWeekLabel==='function'?ypGameWeekLabel(next.nextWeek):('Week '+next.nextWeek));
  const name=String(next.name||'Bill').split(' · ')[0];
  return name+' · '+when;
}

/* ----- Bills card and editors ----- */
function ypBillsInjectCss(){
  if(document.getElementById('yp-bills-css'))return;
  const s=document.createElement('style');
  s.id='yp-bills-css';
  s.textContent=`
#yp-bills,#yp-bill-due,#yp-notify-ask{position:fixed;top:0;left:0;right:0;width:100%;height:100dvh;max-height:100dvh;z-index:48;display:flex;align-items:center;justify-content:center;overflow:hidden;overscroll-behavior:none;touch-action:pan-y;padding:148px 16px 148px;box-sizing:border-box;background:rgba(11,37,69,.28)}
#yp-bill-due,#yp-notify-ask{z-index:54;padding:148px 16px 148px}
html.yp-home #yp-bills,html.yp-home #yp-bill-due,html.yp-home #yp-notify-ask{background:rgba(11,37,69,.28)}
#yp-bills .card,#yp-bill-due .card,#yp-notify-ask .card{background:#fff;border-radius:24px;width:min(440px,100%);max-width:440px;padding:0 22px 20px;text-align:left;box-shadow:0 20px 50px rgba(0,0,0,.35);color:#14213d}
#yp-bills .yp-listing,#yp-bill-due .yp-listing,#yp-notify-ask .yp-listing{text-align:left;max-height:calc(100dvh - 256px);overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y}
#yp-bills .hwb,#yp-bill-due .hwb,#yp-notify-ask .hwb{appearance:none;-webkit-appearance:none;display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;border:0;border-radius:999px;background:#b8410a;color:#fff;font:700 16px Inter,system-ui,sans-serif;cursor:pointer;touch-action:manipulation}
#yp-bills .hwx,#yp-bill-due .hwx,#yp-notify-ask .hwx{appearance:none;-webkit-appearance:none;display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;margin-top:8px;border:2px solid #0a3a8c;border-radius:999px;background:#fff;color:#0a3a8c;font:700 16px Inter,system-ui,sans-serif;cursor:pointer;touch-action:manipulation}
#yp-bills .yp-close,#yp-bill-due .yp-close,#yp-notify-ask .yp-close{appearance:none;-webkit-appearance:none;display:flex;align-items:center;justify-content:center;width:100%;min-height:44px;margin-top:8px;border:0;background:none;color:#5a6780;font:600 15px Inter,system-ui,sans-serif;cursor:pointer}
#yp-bills .yp-bills-lead,#yp-bill-due .yp-bills-lead,#yp-notify-ask .yp-bills-lead{margin:0 0 14px;font:500 14px/1.45 Inter,system-ui,sans-serif;color:#3d4a63}
#yp-bills .yp-bills-empty{margin:8px 0 16px;font:500 15px/1.45 Inter,system-ui,sans-serif;color:#5a6780}
.yp-bill-row{display:flex;flex-direction:column;gap:6px;margin:0 0 12px;padding:12px 12px 10px;border:1px solid rgba(20,33,61,.08);border-radius:16px;background:#f6f8fb;color:#14213d}
.yp-bill-name{margin:0;font:800 16px/1.3 Inter,system-ui,sans-serif;color:#0b2545;text-align:left}
.yp-bill-amt{margin:0;font:600 14px/1.35 Inter,system-ui,sans-serif;color:#3d4a63;text-align:left}
.yp-bill-due{appearance:none;-webkit-appearance:none;margin:4px 0 0;padding:8px 0;border:0;background:transparent;color:#0a3a8c;font:700 14px/1.35 Inter,system-ui,sans-serif;text-align:left;cursor:pointer;min-height:44px}
.yp-bill-due:focus-visible{outline:3px solid #0a3a8c;outline-offset:2px;border-radius:6px}
.yp-bill-remind{display:flex;align-items:center;gap:12px;min-height:44px}
.yp-bill-remind>span{flex:1;font:700 14px/1.3 Inter,system-ui,sans-serif;color:#14213d}
.yp-bill-leads{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 2px}
.yp-bill-leads button{appearance:none;-webkit-appearance:none;min-height:44px;padding:0 12px;border:2px solid #0b2545;border-radius:999px;background:#fff;color:#0b2545;font:700 13px Inter,system-ui,sans-serif;cursor:pointer;touch-action:manipulation}
.yp-bill-leads button[aria-pressed=true]{background:#b8410a;border-color:#b8410a;color:#fff}
#yp-bill-due .yp-bill-freq{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 16px}
#yp-bill-due .yp-bill-freq button{appearance:none;-webkit-appearance:none;min-height:44px;padding:0 12px;border:2px solid #0b2545;border-radius:999px;background:#fff;color:#0b2545;font:700 13px Inter,system-ui,sans-serif;cursor:pointer}
#yp-bill-due .yp-bill-freq button[aria-pressed=true]{background:#b8410a;border-color:#b8410a;color:#fff}
#yp-bill-due label.yp-bill-date-lab{display:block;margin:8px 0 6px;font:700 14px Inter,system-ui,sans-serif;color:#0b2545}
#yp-bill-due input[type=date]{box-sizing:border-box;width:100%;min-height:44px;padding:8px 10px;border:2px solid #0b2545;border-radius:12px;font:600 16px Inter,system-ui,sans-serif;color:#14213d;background:#fff}
#yp-bill-due .yp-bill-week-hint{margin:8px 0 16px;font:600 13px/1.4 Inter,system-ui,sans-serif;color:#3d4a63}
#yp-notify-ask .yp-approval{margin:0 0 16px;font:800 17px/1.3 Inter,system-ui,sans-serif;color:#0b2545;text-align:left}
#yp-notify-ask .yp-step-foot,#yp-bill-due .yp-step-foot{display:flex;flex-direction:column;gap:12px;margin-top:8px}
#yp-bills .yp-week-pending-btn{color:#0a3a8c}
`;
  document.head.appendChild(s);
}
function ypOpenBills(){
  ypBillsInjectCss();
  ypBillsEnsure();
  if(typeof ypExclusive==='function')ypExclusive('yp-bills');
  if(typeof ypUseHome==='function')ypUseHome();
  document.getElementById('yp-bills')?.remove();
  const panel=document.createElement('div');
  panel.id='yp-bills';
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-labelledby','yp-bills-title');
  const card=document.createElement('div');
  card.className='card yp-listing';
  const shut=()=>{panel.remove();if(typeof ypUseHome==='function')ypUseHome();};
  if(typeof ypCardHeader==='function')card.appendChild(ypCardHeader({title:'Bills',titleId:'yp-bills-title',id:'yp-bills-x',onClose:shut}));
  else{const h=document.createElement('h2');h.id='yp-bills-title';h.textContent='Bills';card.appendChild(h);}
  const lead=document.createElement('p');
  lead.className='yp-bills-lead';
  lead.id='yp-bills-lead';
  lead.textContent='These are the living costs you entered, plus game bills like car rego and insurance. Due dates are optional. Turn on Remind Me if you want a reminder.';
  card.appendChild(lead);
  const list=document.createElement('div');
  list.className='yp-bills-list';
  list.id='yp-bills-list';
  card.appendChild(list);
  const close=document.createElement('button');
  close.type='button';
  close.className='yp-close';
  close.id='yp-bills-close';
  close.textContent='Close';
  close.addEventListener('click',shut);
  card.appendChild(close);
  panel.appendChild(card);
  document.body.appendChild(panel);
  ypBillsPaintList();
  return panel;
}
function ypBillsPaintList(){
  const list=document.getElementById('yp-bills-list');
  if(!list)return;
  const items=ypBillsEnsure();
  list.innerHTML='';
  if(!items.length){
    const empty=document.createElement('p');
    empty.className='yp-bills-empty';
    empty.id='yp-bills-empty';
    empty.textContent='When you add living costs or get a car, they will show up here.';
    list.appendChild(empty);
    return;
  }
  items.forEach(it=>list.appendChild(ypBillsRow(it)));
}
function ypBillsRow(it){
  const row=document.createElement('div');
  row.className='yp-bill-row';
  row.dataset.id=it.id;
  const name=document.createElement('div');
  name.className='yp-bill-name';
  name.textContent=it.name||'Bill';
  const amt=document.createElement('div');
  amt.className='yp-bill-amt';
  amt.textContent=ypBillsAmountText(it)+' · '+(YP_BILL_FREQ[it.freq]||YP_BILL_FREQ.month).label;
  const due=document.createElement('button');
  due.type='button';
  due.className='yp-bill-due';
  due.textContent=ypBillsDueLabel(it);
  due.addEventListener('click',()=>ypOpenBillDue(it.id));
  const remind=document.createElement('div');
  remind.className='yp-bill-remind';
  const lab=document.createElement('span');
  lab.textContent='Remind Me';
  const sw=document.createElement('button');
  sw.type='button';
  sw.className='switch'+(it.remind?' on':'');
  sw.setAttribute('aria-label','Remind Me');
  sw.setAttribute('aria-pressed',it.remind?'true':'false');
  sw.addEventListener('click',()=>ypBillsToggleRemind(it.id,!it.remind));
  remind.append(lab,sw);
  row.append(name,amt,due,remind);
  if(it.remind){
    const leads=document.createElement('div');
    leads.className='yp-bill-leads';
    Object.keys(YP_NOTIFY_LEADS).forEach(k=>{
      const b=document.createElement('button');
      b.type='button';
      b.textContent=YP_NOTIFY_LEADS[k].label;
      b.setAttribute('aria-pressed',(it.lead||'week')===k?'true':'false');
      b.addEventListener('click',()=>ypBillsSetLead(it.id,k));
      leads.appendChild(b);
    });
    row.appendChild(leads);
  }
  return row;
}
function ypBillsRefreshOpen(){if(document.getElementById('yp-bills-list'))ypBillsPaintList();}
function ypBillsToggleRemind(id,on){
  const it=ypBillsGet(id);if(!it)return;
  it.remind=!!on;
  it.asked=true;
  it.choice=on?'yes':'no';
  if(!YP_NOTIFY_LEADS[it.lead])it.lead='week';
  ypBillsSave();
  if(on)ypNotifyOnFirstYes();
}
function ypBillsSetLead(id,lead){
  const it=ypBillsGet(id);if(!it||!YP_NOTIFY_LEADS[lead])return;
  it.lead=lead;
  ypBillsSave();
}
function ypBillWeekFromDate(iso){
  if(!iso||typeof ypWallAt!=='function'||typeof CFG==='undefined')return NaN;
  const at=new Date(iso+'T12:00:00');
  if(!Number.isFinite(+at))return NaN;
  const nowGame=(typeof G!=='undefined'&&G)?((G.week|0)*CFG.weekMs+Math.max(0,+G.acc||0)):0;
  const gameMs=nowGame+(+at-Date.now());
  if(typeof ypWeekFromGameMs==='function')return ypWeekFromGameMs(gameMs);
  return Math.floor(gameMs/(CFG.weekMs||1));
}
function ypBillDateFromWeek(week){
  try{
    if(!Number.isFinite(+week)||typeof ypWallAt!=='function'||typeof CFG==='undefined')return '';
    const wall=ypWallAt((+week|0)*CFG.weekMs);
    const d=new Date(wall);
    if(!Number.isFinite(+d))return '';
    const m=String(d.getMonth()+1).padStart(2,'0');
    const day=String(d.getDate()).padStart(2,'0');
    return d.getFullYear()+'-'+m+'-'+day;
  }catch(e){return '';}
}
function ypOpenBillDue(id){
  ypBillsInjectCss();
  const it=ypBillsGet(id);if(!it)return;
  document.getElementById('yp-bill-due')?.remove();
  const week=(typeof G!=='undefined'&&G)?(G.week|0):0;
  let draftWeek=Number.isFinite(ypBillsNextWeek(it,week))?ypBillsNextWeek(it,week):(week+4);
  let draftFreq=YP_BILL_FREQ[it.freq]?it.freq:'month';
  const panel=document.createElement('div');
  panel.id='yp-bill-due';
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-labelledby','yp-bill-due-title');
  const card=document.createElement('div');
  card.className='card yp-listing';
  const shut=()=>panel.remove();
  if(typeof ypCardHeader==='function')card.appendChild(ypCardHeader({title:'Set Due Date',titleId:'yp-bill-due-title',id:'yp-bill-due-x',onClose:shut}));
  const lead=document.createElement('p');
  lead.className='yp-bills-lead';
  lead.textContent=it.name||'Bill';
  card.appendChild(lead);
  const lab=document.createElement('label');
  lab.className='yp-bill-date-lab';
  lab.setAttribute('for','yp-bill-date');
  lab.textContent='Due Date';
  const input=document.createElement('input');
  input.type='date';
  input.id='yp-bill-date';
  input.value=ypBillDateFromWeek(draftWeek);
  const hint=document.createElement('p');
  hint.className='yp-bill-week-hint';
  hint.id='yp-bill-week-hint';
  const paintHint=()=>{
    const w=ypBillWeekFromDate(input.value);
    if(Number.isFinite(w)&&w>=0){draftWeek=w|0;hint.textContent='That is '+(typeof ypGameWeekLabel==='function'?ypGameWeekLabel(draftWeek):('Week '+draftWeek))+' in the game.';}
    else hint.textContent='Pick a date to set the game week.';
  };
  input.addEventListener('input',paintHint);
  paintHint();
  const flab=document.createElement('label');
  flab.className='yp-bill-date-lab';
  flab.textContent='Repeats';
  const freqs=document.createElement('div');
  freqs.className='yp-bill-freq';
  Object.keys(YP_BILL_FREQ).forEach(k=>{
    const b=document.createElement('button');
    b.type='button';
    b.textContent=YP_BILL_FREQ[k].label;
    b.setAttribute('aria-pressed',draftFreq===k?'true':'false');
    b.addEventListener('click',()=>{draftFreq=k;[...freqs.querySelectorAll('button')].forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));});
    freqs.appendChild(b);
  });
  const foot=document.createElement('div');
  foot.className='yp-step-foot';
  const saveBtn=document.createElement('button');
  saveBtn.type='button';
  saveBtn.className='hwb';
  saveBtn.id='yp-bill-due-save';
  saveBtn.textContent='Save';
  saveBtn.addEventListener('click',()=>{
    const w=ypBillWeekFromDate(input.value);
    const rec=ypBillsGet(id);if(!rec)return shut();
    if(YP_BILL_FREQ[draftFreq]&&YP_BILL_FREQ[rec.freq]&&draftFreq!==rec.freq){
      rec.amount=Math.max(0,Math.round((+rec.amount||0)*YP_BILL_FREQ[draftFreq].weeks/YP_BILL_FREQ[rec.freq].weeks));
    }
    rec.freq=draftFreq;
    rec.dueWeek=Number.isFinite(w)&&w>=0?(w|0):null;
    ypBillsSave();
    shut();
  });
  const cancel=document.createElement('button');
  cancel.type='button';
  cancel.className='hwx';
  cancel.id='yp-bill-due-cancel';
  cancel.textContent='Cancel';
  cancel.addEventListener('click',shut);
  const clear=document.createElement('button');
  clear.type='button';
  clear.className='yp-close';
  clear.id='yp-bill-due-clear';
  clear.textContent='Clear Due Date';
  clear.addEventListener('click',()=>{const rec=ypBillsGet(id);if(rec){rec.dueWeek=null;ypBillsSave();}shut();});
  foot.append(saveBtn,cancel,clear);
  card.append(lab,input,hint,flab,freqs,foot);
  panel.appendChild(card);
  document.body.appendChild(panel);
}

/* ----- One-question reminder prompt ----- */
function ypBillsAskReminder(idOrItem){
  ypBillsInjectCss();
  const id=typeof idOrItem==='string'?idOrItem:(idOrItem&&idOrItem.id);
  ypBillsEnsure();
  const it=ypBillsGet(id);if(!it)return false;
  if(it.asked)return false;
  if(document.getElementById('yp-notify-ask'))return false;
  const due=ypBillsDueLabel(it).replace(/^Due Date: /,'');
  const panel=document.createElement('div');
  panel.id='yp-notify-ask';
  panel.dataset.kind='reminder';
  panel.dataset.id=it.id;
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-labelledby','yp-notify-ask-title');
  const card=document.createElement('div');
  card.className='card yp-listing';
  const finish=(yes)=>{
    const rec=ypBillsGet(it.id);
    if(rec){rec.asked=true;rec.choice=yes?'yes':'no';rec.remind=!!yes;if(yes&&!YP_NOTIFY_LEADS[rec.lead])rec.lead='week';}
    panel.remove();
    ypBillsSave();
    if(yes)ypNotifyOnFirstYes();
  };
  if(typeof ypCardHeader==='function')card.appendChild(ypCardHeader({title:'Want a Reminder for This?',titleId:'yp-notify-ask-title',id:'yp-notify-ask-x',onClose:()=>finish(false)}));
  const copy=document.createElement('p');
  copy.className='yp-approval';
  copy.id='yp-notify-ask-copy';
  const dueBit=due&&due!=='Not Set'?(' It is due '+due+'.'):'';
  copy.textContent=dueBit?(it.name||'This bill')+' is due '+due+'. Want a reminder for this?':('Want a reminder for '+(it.name||'this bill')+'?');
  const lead=document.createElement('p');
  lead.className='yp-bills-lead';
  lead.textContent='You can change this later in Bills.';
  const foot=document.createElement('div');
  foot.className='yp-step-foot';
  const yes=document.createElement('button');
  yes.type='button';yes.className='hwb';yes.id='yp-notify-ask-yes';yes.textContent='Yes';
  yes.addEventListener('click',()=>finish(true));
  const no=document.createElement('button');
  no.type='button';no.className='hwx';no.id='yp-notify-ask-no';no.textContent='No Thanks';
  no.addEventListener('click',()=>finish(false));
  foot.append(yes,no);
  card.append(copy,lead,foot);
  panel.appendChild(card);
  document.body.appendChild(panel);
  return true;
}
function ypNotifyOpenPermission(){
  ypBillsInjectCss();
  if(document.getElementById('yp-notify-ask'))return;
  const panel=document.createElement('div');
  panel.id='yp-notify-ask';
  panel.dataset.kind='permission';
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-labelledby','yp-notify-ask-title');
  const card=document.createElement('div');
  card.className='card yp-listing';
  const shut=()=>panel.remove();
  if(typeof ypCardHeader==='function')card.appendChild(ypCardHeader({title:'Allow Notifications?',titleId:'yp-notify-ask-title',id:'yp-notify-perm-x',onClose:shut}));
  const copy=document.createElement('p');
  copy.className='yp-approval';
  copy.id='yp-notify-perm-copy';
  copy.textContent='Your Plot can remind you about bills, registration and events like a house settling, even when you are in another tab.';
  const lead=document.createElement('p');
  lead.className='yp-bills-lead';
  lead.textContent='On the App Store app, reminders can also arrive when the app is closed. This website can do that only while Your Plot is open or running in the background.';
  const foot=document.createElement('div');
  foot.className='yp-step-foot';
  const allow=document.createElement('button');
  allow.type='button';allow.className='hwb';allow.id='yp-notify-perm-allow';allow.textContent='Allow';
  allow.addEventListener('click',async()=>{
    const n=ypNotifyState();
    if(n)n.wanted=true;
    shut();
    const perm=await ypNotifyAdapter.requestPermission();
    if(n)n.permission=perm;
    if(typeof save==='function')save();
    ypNotifySync();
  });
  const later=document.createElement('button');
  later.type='button';later.className='hwx';later.id='yp-notify-perm-later';later.textContent='Not Now';
  later.addEventListener('click',()=>{const n=ypNotifyState();if(n)n.wanted=true;if(typeof save==='function')save();shut();});
  foot.append(allow,later);
  card.append(copy,lead,foot);
  panel.appendChild(card);
  document.body.appendChild(panel);
}
function ypNotifyOnFirstYes(){
  const n=ypNotifyState();if(!n)return;
  n.wanted=true;
  if(typeof save==='function')save();
  const perm=ypNotifyPermission();
  if(perm==='granted'){ypNotifySync();return;}
  if(perm==='denied'||perm==='unsupported')return;
  if(n.permPrompted)return;
  n.permPrompted=1;
  if(typeof save==='function')save();
  ypNotifyOpenPermission();
}

function ypBillsOnCarOwned(car){
  if(!car||!car.id)return;
  ypBillsEnsure();
  const id='game:rego:'+car.id;
  const it=ypBillsGet(id);
  if(it)it._justAppeared=1;
}
function ypBillsMaybePrompt(){
  if(document.getElementById('yp-notify-ask'))return;
  if(document.getElementById('yp-apply-review'))return;
  if(document.getElementById('flow'))return;
  if(typeof ypOpenDialogs==='function'){
    const open=ypOpenDialogs().filter(id=>id&&id!=='yp-bills'&&id!=='sheet'&&id!=='drawer');
    if(open.length)return;
  }
  ypBillsEnsure();
  const week=(typeof G!=='undefined'&&G)?(G.week|0):0;
  const items=ypBillsList();
  const fresh=items.find(it=>it.source==='game'&&it.kind==='rego'&&!it.asked&&it._justAppeared);
  if(fresh){ypBillsAskReminder(fresh.id);return;}
  const coming=items.find(it=>it.source==='game'&&!it.asked&&Number.isFinite(it.nextWeek)&&it.nextWeek-week<=4&&it.nextWeek>=week);
  if(coming)ypBillsAskReminder(coming.id);
}

/* ----- Schedule sync and game-event watch ----- */
function ypBillsScheduleAll(){
  const week=(typeof G!=='undefined'&&G)?(G.week|0):0;
  ypBillsList().forEach(it=>{
    const type=it.notifyType&&YP_NOTIFY_TYPES[it.notifyType]?it.notifyType:(it.kind==='rego'?'regoDue':'billDue');
    const key=it.id;
    ypNotifyCancel(type,key);
    if(!it.remind||!Number.isFinite(it.nextWeek)||!ypNotifyTypeOn(type))return;
    try{
      if(typeof ypWallAt!=='function'||typeof CFG==='undefined')return;
      const dueWall=ypWallAt(it.nextWeek*CFG.weekMs);
      const lead=(YP_NOTIFY_LEADS[it.lead]||YP_NOTIFY_LEADS.week).ms;
      const at=dueWall-lead;
      const when=at>Date.now()+1000?at:(dueWall>Date.now()+1000?dueWall:NaN);
      if(!Number.isFinite(when))return;
      const msg=it.name+' is due '+(typeof ypGameWeekLabel==='function'?ypGameWeekLabel(it.nextWeek):('Week '+it.nextWeek))+'.';
      ypNotifySchedule(type,key,when,YP_NOTIFY_TYPES[type].label,msg,it.id);
    }catch(e){}
  });
}
function ypNotifyWatchSettlements(){
  const week=(typeof G!=='undefined'&&G)?(G.week|0):0;
  const seen=new Map();
  const add=(id,settleWeek,settleGameMs,status)=>{
    if(!id)return;
    const w=Number.isFinite(+settleWeek)?+settleWeek|0:(typeof ypWeekFromGameMs==='function'&&Number.isFinite(+settleGameMs)?ypWeekFromGameMs(settleGameMs):NaN);
    seen.set(String(id),{id,week:w,gameMs:+settleGameMs,status});
  };
  try{
    if(typeof ypBuySettling==='function')ypBuySettling().forEach(b=>{if(b)add(b.id,b.settleWeek,b.settleGameMs,b.status||'contract');});
  }catch(e){}
  try{
    if(typeof ypBuyHeld==='function')ypBuyHeld().forEach(b=>{
      if(!b)return;
      if(b.status==='contract'||b.status==='settling')add(b.id,b.settleWeek,b.settleGameMs,b.status);
    });
  }catch(e){}
  try{
    if(typeof allProps==='function')allProps().forEach(([id,p])=>{if(p&&p.status==='settling')add(id,p.settleWk,null,'settling');});
  }catch(e){}
  const n=ypNotifyState();
  seen.forEach(row=>{
    const settleKey='houseSettled:'+row.id;
    const settlingKey='houseSettling:'+row.id;
    if(Number.isFinite(row.week)&&row.week<=week){
      ypNotifyCancel('houseSettling',row.id);
      if(n&&!n.fired[settleKey]){
        if(n._seenSettling&&n._seenSettling[row.id]){
          ypNotifyEvent('houseSettled','Your house has settled.',row.id,{key:settleKey});
        }else{
          n.fired[settleKey]=1;
        }
      }
      return;
    }
    if(!n._seenSettling)n._seenSettling={};
    n._seenSettling[row.id]=1;
    let wall=NaN;
    try{
      if(Number.isFinite(row.gameMs)&&typeof ypWallAt==='function')wall=ypWallAt(row.gameMs);
      else if(Number.isFinite(row.week)&&typeof ypWallAt==='function'&&typeof CFG!=='undefined')wall=ypWallAt(row.week*CFG.weekMs);
    }catch(e){}
    if(Number.isFinite(wall)&&wall>Date.now()){
      const ahead=wall-86400000;
      const when=ahead>Date.now()+1000?ahead:wall;
      const weekLab=Number.isFinite(row.week)&&(typeof ypGameWeekLabel==='function'?ypGameWeekLabel(row.week):('Week '+row.week));
      ypNotifySchedule('houseSettling',row.id,when,'House Settling','A house settlement is coming up'+(weekLab?(' in '+weekLab):'')+'.',row.id);
    }
  });
}
function ypNotifyWatchRentals(){
  try{
    const store=typeof ypReadStock==='function'?ypReadStock():null;
    (store&&store.rentals||[]).forEach(r=>{
      if(!r||(r.status!=='approved'&&r.status!=='active'))return;
      if(r.owner==='player'&&r.status==='active')return;
      if(r.status==='approved'||(r.notified==='approved')){
        ypNotifyEvent('rentalApproved','Your rental has been approved.',r.id||r.footprintId,{key:'rentalApproved:'+(r.id||'')});
      }
    });
  }catch(e){}
}
function ypNotifySync(){
  if(typeof G==='undefined'||!G)return;
  ypNotifyState();
  ypBillsEnsure();
  ypBillsScheduleAll();
  ypNotifyWatchSettlements();
  /* restore any saved web timers after reload */
  const n=ypNotifyState();
  if(n&&n.schedules&&ypNotifyCanPush()){
    Object.keys(n.schedules).forEach(id=>{
      const s=n.schedules[id];
      if(!s||!ypNotifyTypeOn(s.type))return;
      if(!(+s.at>Date.now()-1000))return;
      ypNotifyAdapter.schedule(id,s.at,s.title,s.body,{type:s.type,id:s.id});
    });
  }
}
let ypNotifyTickBusy=0;
function ypNotifyTick(){
  if(ypNotifyTickBusy)return;
  ypNotifyTickBusy=1;
  try{
    ypBillsEnsure();
    ypNotifyWatchSettlements();
    ypNotifyWatchRentals();
    ypBillsMaybePrompt();
  }catch(e){}
  ypNotifyTickBusy=0;
}

/* ----- Settings block ----- */
function ypNotifySettingsHtml(){
  const prefs=ypNotifyPrefs();
  const rows=Object.keys(YP_NOTIFY_TYPES).map(type=>{
    const T=YP_NOTIFY_TYPES[type];
    const on=prefs[type]!==false?' on':'';
    return `<div class="fin" style="display:flex;align-items:center;gap:12px"><span style="flex:1"><b>${ypNotifyEsc(T.label)}</b></span><button class="switch${on}" id="yp-pref-${type}" onclick="ypNotifySetPref('${type}',!ypNotifyPrefOn('${type}'));UI.settings()" aria-label="${ypNotifyEsc(T.label)}"></button></div>`;
  }).join('');
  const perm=ypNotifyPermission();
  const note=perm==='granted'?'Reminders can appear on this device when Your Plot is open or in the background.'
    :(perm==='denied'?'Notifications are turned off in the browser. You can still use in-app reminders from the bell.'
    :'Turn on Remind Me for a bill to be asked about notifications on this device.');
  return `<div class="pcard" id="yp-notify-settings"><div class="ctitle">Notifications</div>${rows}<div class="sub">${note}</div></div>`;
}

function ypBillsFeedKey(){
  try{return ypBillsWeekLabel();}catch(e){return '';}
}

/* ----- hooks into existing game functions (expense entry itself is not changed) ----- */
function ypNotifyHook(){
  if(typeof clockStep==='function'&&!clockStep.__ypNotify){
    const orig=clockStep;
    clockStep=function(){const r=orig.apply(this,arguments);try{ypNotifyTick();}catch(e){}return r;};
    clockStep.__ypNotify=1;
  }
  if(typeof expSave==='function'&&!expSave.__ypNotify){
    const orig=expSave;
    expSave=function(){const r=orig.apply(this,arguments);try{if(r!==false){ypBillsSyncFromExpenses();ypBillsSave();}}catch(e){}return r;};
    expSave.__ypNotify=1;
  }
  if(typeof ypFinishCarHandover==='function'&&!ypFinishCarHandover.__ypNotify){
    const orig=ypFinishCarHandover;
    ypFinishCarHandover=function(rec){
      const before=rec&&(rec.handedOver||rec.status==='owned');
      const out=orig.apply(this,arguments);
      try{
        if(out&&!before&&(out.handedOver||out.status==='owned')){
          ypBillsOnCarOwned(out);
          if(out.pay==='finance')ypNotifyEvent('financeApproved','Your car finance is approved and the car has been handed over.',out.id,{key:'financeApproved:'+out.id});
        }
      }catch(e){}
      return out;
    };
    ypFinishCarHandover.__ypNotify=1;
  }
  if(typeof ypOpenCarCongrats==='function'&&!ypOpenCarCongrats.__ypNotify){
    const orig=ypOpenCarCongrats;
    ypOpenCarCongrats=function(car){
      const r=orig.apply(this,arguments);
      try{
        ypBillsOnCarOwned(car);
        const btn=document.getElementById('yp-car-congrats-done');
        if(btn&&!btn.__ypNotify){
          btn.__ypNotify=1;
          btn.addEventListener('click',()=>{setTimeout(()=>{try{ypBillsMaybePrompt();}catch(e){}},400);},{once:true});
        }
      }catch(e){}
      return r;
    };
    ypOpenCarCongrats.__ypNotify=1;
  }
  if(typeof ypWeekCard==='function'&&!ypWeekCard.__ypNotify){
    /* source also patches the Bills Due row; this keeps the label fresh if an older copy loads */
    ypWeekCard.__ypNotify=1;
  }
  if(typeof ypFeedStateKey==='function'&&!ypFeedStateKey.__ypNotify){
    const orig=ypFeedStateKey;
    ypFeedStateKey=function(){const k=orig.apply(this,arguments);try{return k+'|'+ypBillsFeedKey();}catch(e){return k;}};
    ypFeedStateKey.__ypNotify=1;
  }
  if(typeof UI==='object'&&UI){
    if(typeof UI.settings==='function'&&!UI.settings.__ypNotify){
      const orig=UI.settings.bind(UI);
      UI.settings=function(){
        const r=orig.apply(this,arguments);
        try{
          const sheet=UI.el||document.getElementById('sheet');
          if(sheet&&!sheet.querySelector('#yp-notify-settings')){
            const box=document.createElement('div');
            box.innerHTML=ypNotifySettingsHtml();
            const saves=sheet.querySelector('button.btn.sec');
            const node=box.firstElementChild;
            if(node&&saves)saves.parentNode.insertBefore(node,saves);
            else if(node)(sheet.querySelector('.pane')||sheet).appendChild(node);
          }
        }catch(e){}
        return r;
      };
      UI.settings.__ypNotify=1;
    }
    if(typeof UI.menu==='function'&&!UI.menu.__ypNotify){
      const orig=UI.menu.bind(UI);
      UI.menu=function(show){
        const r=orig.apply(this,arguments);
        try{
          if(show===false)return r;
          const pane=document.querySelector('#drawer .pane');
          if(pane&&!pane.querySelector('#yp-menu-bills')){
            const after=pane.querySelector('#yp-menu-car-yard')||pane.querySelector('.mi:nth-child(6)');
            const btn=document.createElement('button');
            btn.className='mi';
            btn.id='yp-menu-bills';
            btn.onclick=()=>{UI.menu(false);ypOpenBills();};
            const iconHtml=(typeof icon==='function'?`<span class="mic">${icon('bell')}</span>`:'');
            btn.innerHTML=iconHtml+'<span>Bills<small>Due dates and reminders</small></span>';
            if(after&&after.parentNode)after.parentNode.insertBefore(btn,after.nextSibling);
            else pane.appendChild(btn);
          }
        }catch(e){}
        return r;
      };
      UI.menu.__ypNotify=1;
    }
  }
  if(typeof ypOpenFinancesMenu==='function'&&!ypOpenFinancesMenu.__ypNotify){
    const orig=ypOpenFinancesMenu;
    ypOpenFinancesMenu=function(anchor){
      /* replaced in map-preview.js; keep a fallback insert */
      const r=orig.apply(this,arguments);
      try{
        const menu=document.getElementById('yp-section-menu');
        if(menu&&!menu.querySelector('[data-label="Bills"]')){
          const card=menu.querySelector('.card');
          const notch=card&&card.querySelector('.yp-notch');
          const btn=document.createElement('button');
          btn.type='button';btn.className='yp-menu-item';btn.dataset.label='Bills';btn.id='yp-menu-fin-bills';btn.textContent='Bills';
          btn.addEventListener('click',()=>{if(typeof ypHideDialog==='function')ypHideDialog(menu);else menu.remove();ypOpenBills();});
          if(card){if(notch)card.insertBefore(btn,notch);else card.appendChild(btn);}
        }
      }catch(e){}
      return r;
    };
    ypOpenFinancesMenu.__ypNotify=1;
  }
}

(function ypNotifyBoot(){
  ypNotifyRegisterWorker();
  const start=()=>{
    try{ypNotifyHook();ypNotifyState();if(typeof G!=='undefined'&&G){ypBillsEnsure();ypNotifySync();}}catch(e){}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,0));
  else setTimeout(start,0);
  let k=0;const t=setInterval(()=>{try{ypNotifyHook();}catch(e){} if(++k>40)clearInterval(t);},250);
})();
