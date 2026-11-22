/* Your Plot bills, due dates and notifications (dates125).
   Budget items are copied onto the real-life Bills list and stay in sync with what
   the player entered. Custom bills can be added too. Game costs are not shown in Bills.
   Real-life reminders follow a next due date and how often it repeats. */

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
  week:{label:'Weekly',every:'Every Week',weeks:1,unit:'a week'},
  fortnight:{label:'Fortnightly',every:'Every Fortnight',weeks:2,unit:'a fortnight'},
  month:{label:'Monthly',every:'Every Month',weeks:4,unit:'a month'},
  sixmonths:{label:'Every 6 Months',every:'Every 6 Months',weeks:26,unit:'every 6 months'},
  quarter:{label:'Quarterly',every:'Every Quarter',weeks:13,unit:'a quarter'},
  year:{label:'Yearly',every:'Every Year',weeks:52,unit:'a year'}
};
const YP_BILL_FREQ_CHOICES=['week','fortnight','month','sixmonths','year'];
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
function ypBillsIsGame(it){
  return !!(it&&(it.source==='game'||String(it.id||'').indexOf('game:')===0));
}
function ypBillParseDate(iso){
  const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m)return null;
  const d=new Date(+m[1],+m[2]-1,+m[3],12,0,0,0);
  if(d.getFullYear()!==+m[1]||d.getMonth()!==(+m[2]-1)||d.getDate()!==+m[3])return null;
  return d;
}
function ypBillFormatDate(d){
  if(!d||!Number.isFinite(+d))return '';
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function ypBillDateLabel(iso){
  const d=ypBillParseDate(iso);
  if(!d)return '';
  if(typeof ypRealDateLabel==='function')return ypRealDateLabel(+d);
  return d.toLocaleDateString('en-AU',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
}
function ypBillLastDay(year,month){
  return new Date(+year, +month+1, 0).getDate();
}
function ypBillDueDay(iso,dueDay){
  const d=ypBillParseDate(iso);
  const n=+dueDay;
  if(n>=1&&n<=31)return n|0;
  return d?d.getDate():0;
}
function ypBillAddPeriod(iso,freq,dueDay){return ypBillShiftPeriod(iso,freq,dueDay,1);}
function ypBrisbaneYmd(ms){
  try{
    const s=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Number.isFinite(+ms)?+ms:Date.now()));
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  }catch(e){}
  return ypBillFormatDate(new Date(Number.isFinite(+ms)?+ms:Date.now()));
}
function ypBrisbaneWeekBounds(ms){
  const today=ypBrisbaneYmd(ms);
  const noon=Date.parse(today+'T12:00:00+10:00');
  const wd=Number.isFinite(noon)?new Date(noon).getUTCDay():new Date().getDay();
  const back=wd===0?6:wd-1;
  const mon=noon-back*86400000;
  const sun=mon+6*86400000;
  return {today,start:ypBrisbaneYmd(mon),end:ypBrisbaneYmd(sun)};
}
function ypBillShiftPeriod(iso,freq,dueDay,steps){
  steps=(steps==null?1:steps)|0;
  const d=ypBillParseDate(iso);
  if(!d||!steps)return d?ypBillFormatDate(d):'';
  const day=ypBillDueDay(iso,dueDay);
  if(freq==='week'){d.setDate(d.getDate()+7*steps);return ypBillFormatDate(d);}
  if(freq==='fortnight'){d.setDate(d.getDate()+14*steps);return ypBillFormatDate(d);}
  let months=0;
  if(freq==='month')months=1;
  else if(freq==='sixmonths')months=6;
  else if(freq==='quarter')months=3;
  else if(freq==='year')months=12;
  else {d.setDate(d.getDate()+7*steps);return ypBillFormatDate(d);}
  const total=d.getFullYear()*12+d.getMonth()+months*steps;
  const year=Math.floor(total/12);
  const month=((total%12)+12)%12;
  const dim=ypBillLastDay(year,month);
  const use=day>0?Math.min(day,dim):Math.min(d.getDate(),dim);
  return ypBillFormatDate(new Date(year,month,use,12,0,0,0));
}
function ypBillDueWall(iso){
  const d=ypBillParseDate(iso);
  return d?+d:NaN;
}
function ypBillsStore(){
  if(typeof G==='undefined'||!G)return null;
  if(!G.bills||typeof G.bills!=='object')G.bills={v:3,items:{},seq:0};
  if(!G.bills.items||typeof G.bills.items!=='object')G.bills.items={};
  if((G.bills.v|0)<3){
    if(ypBillsMigrate(G.bills))G.bills.v=3;
  }
  return G.bills;
}
function ypBillsDefaultFreq(it){
  if(it&&YP_BILL_FREQ[it.freq])return it.freq;
  if(it&&it.source==='expense'){
    const k=String(it.id||'').replace(/^exp:/,'');
    const ex=(typeof G!=='undefined'&&G&&G.income&&G.income.ex)||null;
    if(ex&&ex.yearly&&ex.yearly[k])return 'year';
    const f=ex&&ex.freq;
    if(f==='week'||f==='weekly')return 'week';
    if(f==='fortnight'||f==='fortnightly')return 'fortnight';
    if(f==='month'||f==='monthly')return 'month';
    if(f==='year'||f==='yearly'||f==='annual')return 'year';
    return 'month';
  }
  if(ypBillsIsGame(it))return 'year';
  return 'month';
}
function ypBillsMigrate(store){
  if(!store||!store.items)return true;
  let ready=true;
  const v=store.v|0;
  Object.values(store.items).forEach(it=>{
    if(!it)return;
    if(v<2&&!ypBillsIsGame(it)&&!ypBillParseDate(it.dueDate)&&it.dueWeek!=null&&Number.isFinite(+it.dueWeek)){
      const iso=ypBillDateFromWeek(+it.dueWeek);
      if(iso)it.dueDate=iso;
      else ready=false;
    }
    it.freq=ypBillsDefaultFreq(it);
    const d=ypBillParseDate(it.dueDate);
    const n=+it.dueDay;
    if(d&&!(n>=1&&n<=31))it.dueDay=d.getDate();
  });
  return ready;
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
  if('dueDate' in item&&!(opts&&opts.keepDate))next.dueDate=ypBillParseDate(item.dueDate)?item.dueDate:null;
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
  cats.forEach(row=>{
    const k=row[0];
    const amt=Math.max(0,Math.round(+items[k]||0));
    const id='exp:'+k;
    const prev=store.items[id];
    const freq=ypBillsFreqOfExpense(k,ex);
    const name=YP_BILL_EXP_NAMES[k]||row[2]||k;
    ypBillsUpsert({id,source:'expense',kind:'bill',name,amount:amt,freq,notifyType:'billDue'},{keepFreq:true,keepAmount:!!(prev&&prev.amountUser)});
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
    },{keepFreq:!!(existing&&(existing.freq||existing.dueWeek!=null||existing.dueDate||existing.freqUser))});
    live.add(regoId);
    if(insWk>0){
      const prev=store.items[insId];
      ypBillsUpsert({
        id:insId,source:'game',kind:'insurance',name:'Car Insurance · '+title,
        amount:Math.round(insWk*52),freq:'year',carId:car.id,notifyType:'billDue',
        autoDue:true,dueWeek:prev&&prev.dueWeek!=null?prev.dueWeek:(week+52)
      },{keepFreq:!!(prev&&(prev.freq||prev.dueWeek!=null||prev.dueDate||prev.freqUser))});
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
function ypBillsClearGameReminders(){
  const store=ypBillsStore();if(!store||!store.items)return;
  let changed=false;
  Object.values(store.items).forEach(it=>{
    if(!ypBillsIsGame(it))return;
    const type=it.notifyType&&YP_NOTIFY_TYPES[it.notifyType]?it.notifyType:(it.kind==='rego'?'regoDue':'billDue');
    try{ypNotifyCancel(type,it.id);}catch(e){}
    if(it.remind||it.choice==='yes'||!it.asked){
      it.remind=false;
      it.asked=true;
      if(it.choice==='yes'||it.choice==null)it.choice='no';
      changed=true;
    }
  });
  if(changed&&typeof save==='function')save();
}
function ypBillsEnsure(){
  if(!ypBillsStore())return [];
  ypNotifyState();
  ypBillsSyncFromExpenses();
  ypBillsSyncFromCars();
  ypBillsClearGameReminders();
  ypBillsRollDues();
  return ypBillsList();
}
function ypBillsRollDues(){
  const store=ypBillsStore();if(!store)return;
  const week=(typeof G!=='undefined'&&G)?(G.week|0):0;
  const today=typeof ypBrisbaneYmd==='function'?ypBrisbaneYmd(Date.now()):ypBillFormatDate(new Date());
  let changed=false;
  Object.values(store.items).forEach(it=>{
    if(!it)return;
    if(ypBillsIsGame(it)&&it.dueWeek!=null&&Number.isFinite(+it.dueWeek)){
      const step=(YP_BILL_FREQ[it.freq]||YP_BILL_FREQ.year).weeks;
      let w=+it.dueWeek|0;
      if(step>0){
        while(w<week){w+=step;changed=true;}
        if(w!==(+it.dueWeek|0))it.dueWeek=w;
      }
    }
    if(!ypBillParseDate(it.dueDate))return;
    let iso=it.dueDate,guard=0;
    const freq=YP_BILL_FREQ[it.freq]?it.freq:'month';
    const dueDay=ypBillDueDay(iso,it.dueDay);
    if(dueDay&&!(+it.dueDay>=1&&+it.dueDay<=31))it.dueDay=dueDay;
    let last=ypBillParseDate(it.lastDueDate)?it.lastDueDate:'';
    while(iso<today&&guard++<240){
      if(it.remind)ypBillsFireOccurrence(it,iso,true);
      const next=ypBillAddPeriod(iso,freq,dueDay||it.dueDay);
      if(!next||next<=iso)break;
      last=iso;
      iso=next;changed=true;
    }
    if(last&&last!==it.lastDueDate){it.lastDueDate=last;changed=true;}
    if(iso!==it.dueDate)it.dueDate=iso;
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
    const row=Object.assign({},it);
    if(ypBillsIsGame(it))row.nextWeek=ypBillsNextWeek(it,week);
    else row.nextWeek=NaN;
    return row;
  });
  list.sort((a,b)=>{
    const ag=ypBillsIsGame(a),bg=ypBillsIsGame(b);
    if(ag!==bg)return ag?1:-1;
    const an=Number.isFinite(a.nextWeek),bn=Number.isFinite(b.nextWeek);
    if(an&&bn&&a.nextWeek!==b.nextWeek)return a.nextWeek-b.nextWeek;
    if(an&&!bn)return -1;
    if(!an&&bn)return 1;
    const ad=a.dueDate||'',bd=b.dueDate||'';
    if(ad&&bd&&ad!==bd)return ad<bd?-1:1;
    if(ad&&!bd)return -1;
    if(!ad&&bd)return 1;
    return String(a.name||'').localeCompare(String(b.name||''));
  });
  return list;
}
function ypBillsRealList(){
  const cats=(typeof EXP13!=='undefined'&&Array.isArray(EXP13))?EXP13.map(r=>r[0]):Object.keys(YP_BILL_EXP_NAMES);
  const order=new Map(cats.map((k,i)=>['exp:'+k,i]));
  const real=ypBillsList().filter(it=>!ypBillsIsGame(it));
  real.sort((a,b)=>{
    const ae=a.source==='expense',be=b.source==='expense';
    if(ae&&be){
      const ia=order.has(a.id)?order.get(a.id):999,ib=order.has(b.id)?order.get(b.id):999;
      if(ia!==ib)return ia-ib;
    }
    if(ae!==be)return ae?-1:1;
    const ad=a.dueDate||'',bd=b.dueDate||'';
    if(ad&&bd&&ad!==bd)return ad<bd?-1:1;
    return String(a.name||'').localeCompare(String(b.name||''));
  });
  return real;
}
function ypBillsGameList(){return ypBillsList().filter(ypBillsIsGame);}
function ypBillsGet(id){const s=ypBillsStore();return s&&s.items[id]||null;}
function ypBillsSave(){if(typeof save==='function')save();ypBillsRefreshOpen();ypNotifySync();if(typeof ypSyncFeed==='function')ypSyncFeed();if(typeof hud==='function')hud();}

function ypBillsDueLabel(it){
  if(ypBillParseDate(it&&it.dueDate))return 'Next Due Date: '+(ypBillDateLabel(it.dueDate)||it.dueDate);
  if(ypBillsIsGame(it)){
    const w=ypBillsNextWeek(it);
    if(!Number.isFinite(w))return 'Next Due Date: Not Set';
    const weekLab=typeof ypGameWeekLabel==='function'?ypGameWeekLabel(w):('Week '+w);
    let real='';
    try{
      if(typeof ypWallAt==='function'&&typeof CFG!=='undefined'&&CFG){
        const wall=ypWallAt(w*CFG.weekMs);
        if(typeof ypRealDateLabel==='function')real=ypRealDateLabel(wall);
      }
    }catch(e){}
    return real?('Next Due Date: '+weekLab+' · '+real):('Next Due Date: '+weekLab);
  }
  return 'Next Due Date: Not Set';
}
function ypBillsAmountFreq(it){
  if(ypBillsIsGame(it))return 'year';
  return (it&&YP_BILL_FREQ[it.freq])?it.freq:'month';
}
function ypBillsAmountText(it){
  const freq=YP_BILL_FREQ[ypBillsAmountFreq(it)]||YP_BILL_FREQ.month;
  return ypNotifyMoney(it&&it.amount)+' '+freq.unit;
}
function ypBillsWeekLabel(){
  ypBillsEnsure();
  const dated=ypBillsRealList().filter(it=>ypBillParseDate(it.dueDate));
  if(!dated.length)return 'Set Up Bills';
  dated.sort((a,b)=>String(a.dueDate).localeCompare(String(b.dueDate)));
  const next=dated[0];
  const when=ypBillDateLabel(next.dueDate)||next.dueDate;
  const name=String(next.name||'Bill').split(' · ')[0];
  return name+' · '+when;
}
function ypBillLastOccurrence(it,today){
  if(!it)return '';
  const freq=YP_BILL_FREQ[it.freq]?it.freq:'month';
  const next=ypBillParseDate(it.dueDate)?it.dueDate:'';
  if(ypBillParseDate(it.lastDueDate)&&(!next||it.lastDueDate<next))return it.lastDueDate;
  if(!next)return '';
  today=today||((typeof ypBrisbaneYmd==='function'?ypBrisbaneYmd(Date.now()):ypBillFormatDate(new Date())));
  if(next<today)return next;
  const prev=ypBillShiftPeriod(next,freq,it.dueDay,-1);
  return (prev&&prev<next)?prev:'';
}
function ypBillsDueThisWeek(){
  ypBillsEnsure();
  const b=typeof ypBrisbaneWeekBounds==='function'?ypBrisbaneWeekBounds(Date.now()):null;
  const start=b&&b.start,end=b&&b.end,today=b&&b.today;
  const inWeek=iso=>!!(iso&&start&&end&&iso>=start&&iso<=end);
  const due=ypBillsRealList().map(it=>{
    const next=ypBillParseDate(it.dueDate)?it.dueDate:'';
    const storedLast=ypBillParseDate(it.lastDueDate)?it.lastDueDate:'';
    const dueThis=inWeek(next);
    const lastThis=inWeek(storedLast);
    const pastDue=!!(next&&today&&next<today);
    const overdue=!!((storedLast&&storedLast<today&&!dueThis)||pastDue);
    if(!dueThis&&!overdue&&!lastThis)return null;
    const show=dueThis?next:(storedLast||next);
    return Object.assign({},it,{showDate:show,overdue:overdue&&!dueThis,dueDate:it.dueDate,thisWeekDate:show});
  }).filter(Boolean);
  due.sort((a,b)=>{
    if(!!a.overdue!==!!b.overdue)return a.overdue?-1:1;
    return String(a.showDate||a.dueDate||'').localeCompare(String(b.showDate||b.dueDate||''));
  });
  return due;
}


/* ----- Bills card and editors ----- */
let ypBillsAddDraft={name:'',amount:'',freq:'month',dueDate:''};
let ypBillsEditId=null;
let ypBillsEditDraft=null;
let ypBillsDeleteId=null;
let ypBillsOpenId=null;
function ypBillsDomId(prefix,id){return prefix+'-'+String(id||'').replace(/[^A-Za-z0-9_-]+/g,'-');}
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
#yp-bills .yp-bills-sec{margin:18px 0 8px;font:800 16px/1.3 Inter,system-ui,sans-serif;color:#0b2545}
#yp-bills .yp-bills-note{margin:0 0 12px;font:500 14px/1.45 Inter,system-ui,sans-serif;color:#3d4a63}
.yp-bill-row{display:flex;flex-direction:column;gap:6px;margin:0 0 12px;padding:12px 12px 10px;border:1px solid rgba(20,33,61,.08);border-radius:16px;background:#f6f8fb;color:#14213d}
.yp-bill-toggle{appearance:none;-webkit-appearance:none;display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;min-height:44px;margin:0;padding:0;border:0;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}
.yp-bill-toggle:focus-visible{outline:3px solid #0a3a8c;outline-offset:2px;border-radius:8px}
.yp-bill-toggle .yp-bill-name{flex:1;min-width:0;margin:0;font:700 15px/1.25 Inter,system-ui,sans-serif;color:#14213d}
.yp-bill-right{display:flex;align-items:center;gap:6px;flex:none}
.yp-bill-val{font:600 15px/1.2 Inter,system-ui,sans-serif;color:#14213d;white-space:nowrap;text-align:right}
.yp-bill-val.yp-bill-val-empty{font-weight:500;color:#5a6780}
.yp-bill-chev{display:inline-flex;align-items:center;justify-content:center;width:20px;color:#6b7a90;font-size:15px;line-height:1}
.yp-bill-body{display:flex;flex-direction:column;gap:6px;padding-top:4px}.yp-bill-body[hidden],.yp-bill-row:not(.yp-open) .yp-bill-body{display:none}
.yp-bill-blank-hint{margin:0 0 4px;font:500 13px/1.4 Inter,system-ui,sans-serif;color:#b8410a;text-align:left}

.yp-bill-row.yp-bill-add{background:#fff;border:2px solid #0b2545}
.yp-bill-name{margin:0;font:700 15px/1.3 Inter,system-ui,sans-serif;color:#0b2545;text-align:left}
.yp-bill-amt{margin:0;font:600 14px/1.35 Inter,system-ui,sans-serif;color:#3d4a63;text-align:left}
.yp-bill-due{appearance:none;-webkit-appearance:none;margin:4px 0 0;padding:8px 0;border:0;background:transparent;color:#0a3a8c;font:700 14px/1.35 Inter,system-ui,sans-serif;text-align:left;cursor:pointer;min-height:44px}
.yp-bill-due:focus-visible{outline:3px solid #0a3a8c;outline-offset:2px;border-radius:6px}
.yp-bill-due-static{margin:4px 0 0;padding:8px 0;color:#3d4a63;font:700 14px/1.35 Inter,system-ui,sans-serif;text-align:left}
.yp-bill-remind{display:flex;align-items:center;gap:12px;min-height:44px}
.yp-bill-remind>span{flex:1;font:500 14px/1.3 Inter,system-ui,sans-serif;color:#14213d}
.yp-bill-leads{display:flex;flex-wrap:nowrap;align-items:stretch;gap:6px;margin:0 0 2px;width:100%}
.yp-bill-leads button{appearance:none;-webkit-appearance:none;flex:1 1 0;min-width:0;min-height:44px;padding:6px 4px;border:1px solid #e3e8f0;border-radius:999px;background:#fff;color:#14213d;font:500 13px/1.2 Inter,system-ui,sans-serif;cursor:pointer;touch-action:manipulation;white-space:normal;text-align:center}
.yp-bill-leads button[aria-pressed=true]{background:#b8410a;border-color:#b8410a;color:#fff}
.yp-bill-amt-row{display:flex;align-items:stretch;gap:8px;width:100%;margin:0 0 2px}
.yp-bill-amt-field{position:relative;flex:0 1 38%;min-width:96px}
.yp-bill-amt-prefix{position:absolute;left:10px;top:50%;transform:translateY(-50%);font:500 15px Inter,system-ui,sans-serif;color:#5d6b82;pointer-events:none}
.yp-bill-amt-static{flex:0 1 38%;min-width:96px;display:flex;align-items:center;margin:0;padding:0 2px;font:700 14px/1.3 Inter,system-ui,sans-serif;color:#3d4a63}
.yp-bill-freq-select{appearance:none;-webkit-appearance:none;flex:1 1 62%;min-width:0;min-height:44px;box-sizing:border-box;padding:8px 28px 8px 10px;border:1px solid #e3e8f0;border-radius:12px;background-color:#fff;background-image:linear-gradient(45deg,transparent 50%,#5d6b82 50%),linear-gradient(135deg,#5d6b82 50%,transparent 50%);background-position:calc(100% - 18px) 50%,calc(100% - 12px) 50%;background-size:6px 6px,6px 6px;background-repeat:no-repeat;color:#14213d;font:400 16px/1.2 Inter,system-ui,sans-serif;cursor:pointer}
.yp-bill-date-wrap{position:relative;width:100%}
.yp-bill-date-ph{display:none;position:absolute;left:12px;top:50%;transform:translateY(-50%);font:400 16px Inter,system-ui,sans-serif;color:#5a6780;pointer-events:none;z-index:1}
.yp-bill-date-wrap.yp-bill-date-empty .yp-bill-date-ph{display:block}
.yp-bill-date-wrap.yp-bill-date-empty input[type=date]{color:transparent;-webkit-text-fill-color:transparent}
.yp-bill-date-wrap.yp-bill-date-empty input[type=date]::-webkit-datetime-edit,
.yp-bill-date-wrap.yp-bill-date-empty input[type=date]::-webkit-datetime-edit-fields-wrapper,
.yp-bill-date-wrap.yp-bill-date-empty input[type=date]::-webkit-datetime-edit-text,
.yp-bill-date-wrap.yp-bill-date-empty input[type=date]::-webkit-datetime-edit-month-field,
.yp-bill-date-wrap.yp-bill-date-empty input[type=date]::-webkit-datetime-edit-day-field,
.yp-bill-date-wrap.yp-bill-date-empty input[type=date]::-webkit-datetime-edit-year-field{color:transparent;-webkit-text-fill-color:transparent}
#yp-bills label.yp-bill-date-lab,#yp-bill-due label.yp-bill-date-lab{display:block;margin:8px 0 6px;font:500 14px Inter,system-ui,sans-serif;color:#0b2545}
#yp-bills input[type=date],#yp-bills input[type=text],#yp-bills input[type=number],#yp-bill-due input[type=date]{box-sizing:border-box;width:100%;min-height:44px;padding:8px 10px;border:1px solid #e3e8f0;border-radius:12px;font:400 16px Inter,system-ui,sans-serif;color:#14213d;background:#fff}
#yp-bills .yp-bill-amt-field input{width:100%;padding-left:28px}
#yp-bill-due .yp-bill-week-hint{margin:8px 0 16px;font:600 13px/1.4 Inter,system-ui,sans-serif;color:#3d4a63}
#yp-notify-ask .yp-approval{margin:0 0 16px;font:800 17px/1.3 Inter,system-ui,sans-serif;color:#0b2545;text-align:left}
#yp-notify-ask .yp-step-foot,#yp-bill-due .yp-step-foot{display:flex;flex-direction:column;gap:12px;margin-top:8px}
#yp-bills .yp-week-pending-btn{color:#0a3a8c}
#yp-bills .switch{position:relative;width:50px;height:30px;border-radius:15px;background:#d5dbe6;border:0;cursor:pointer;flex:none}
#yp-bills .switch::after{content:"";position:absolute;top:3px;left:3px;width:24px;height:24px;border-radius:50%;background:#fff;box-shadow:0 1px 3px #0004}
#yp-bills .switch.on{background:#0a3a8c}
#yp-bills .switch.on::after{left:23px}
.yp-bill-actions{display:flex;gap:8px;margin:4px 0 2px}
.yp-bill-actions button{appearance:none;-webkit-appearance:none;flex:1;min-height:44px;padding:0 12px;border:2px solid #0a3a8c;border-radius:999px;background:#fff;color:#0a3a8c;font:700 14px Inter,system-ui,sans-serif;cursor:pointer;touch-action:manipulation}
.yp-bill-actions button.yp-bill-del{border-color:#b8410a;color:#b8410a}
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
  lead.textContent='Set the next due date and how often it repeats for each Budget item, or add a bill the game does not list.';
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
  ypBillsEnsure();
  const real=ypBillsRealList();
  list.innerHTML='';
  const realWrap=document.createElement('div');
  realWrap.id='yp-bills-real';
  if(!real.length){
    const empty=document.createElement('p');
    empty.className='yp-bills-empty';
    empty.id='yp-bills-empty';
    empty.textContent='Your Budget items will show up here once you have entered them.';
    realWrap.appendChild(empty);
  }
  real.forEach(it=>realWrap.appendChild(ypBillsRow(it)));
  realWrap.appendChild(ypBillsAddRow());
  list.appendChild(realWrap);
}
function ypBillsFreqSelect(draft,onPick,id){
  const sel=document.createElement('select');
  sel.className='yp-bill-freq-select';
  if(id)sel.id=id;
  sel.setAttribute('aria-label','How Often');
  const keys=YP_BILL_FREQ_CHOICES.slice();
  if(draft&&draft.freq==='quarter'&&keys.indexOf('quarter')<0)keys.push('quarter');
  keys.forEach(k=>{
    const o=document.createElement('option');
    o.value=k;
    o.textContent=(YP_BILL_FREQ[k]&&YP_BILL_FREQ[k].every)||YP_BILL_FREQ[k].label;
    sel.appendChild(o);
  });
  sel.value=YP_BILL_FREQ[draft&&draft.freq]?draft.freq:'month';
  sel.addEventListener('change',()=>{
    const k=sel.value;
    if(!YP_BILL_FREQ[k])return;
    if(draft)draft.freq=k;
    if(onPick)onPick(k);
  });
  return sel;
}
function ypBillsAmtPeriodRow(opts){
  opts=opts||{};
  const wrap=document.createElement('div');
  wrap.className='yp-bill-amt-row';
  if(opts.editable){
    const field=document.createElement('div');
    field.className='yp-bill-amt-field';
    const prefix=document.createElement('span');
    prefix.className='yp-bill-amt-prefix';
    prefix.textContent='$';
    const input=document.createElement('input');
    input.type='text';
    input.inputMode='decimal';
    input.autocomplete='off';
    input.placeholder='0';
    input.value=opts.amount==null||opts.amount===''?'':String(opts.amount);
    input.setAttribute('aria-label','Amount');
    if(opts.amountId)input.id=opts.amountId;
    const commit=()=>{if(opts.onAmount)opts.onAmount(input.value);};
    input.addEventListener('change',commit);
    input.addEventListener('blur',commit);
    field.append(prefix,input);
    wrap.appendChild(field);
  }else{
    const stat=document.createElement('div');
    stat.className='yp-bill-amt yp-bill-amt-static';
    stat.textContent=opts.amountText||'';
    wrap.appendChild(stat);
  }
  wrap.appendChild(ypBillsFreqSelect({freq:opts.freq},opts.onFreq,opts.freqId));
  return wrap;
}
function ypBillsDateField(labText,value,id,onChange){
  const lab=document.createElement('label');
  lab.className='yp-bill-date-lab';
  lab.textContent=labText;
  const wrap=document.createElement('div');
  wrap.className='yp-bill-date-wrap';
  const ph=document.createElement('span');
  ph.className='yp-bill-date-ph';
  ph.textContent='Not Set';
  const date=document.createElement('input');
  date.type='date';
  date.value=ypBillParseDate(value)?value:'';
  if(id){lab.setAttribute('for',id);date.id=id;}
  date.setAttribute('aria-label',labText);
  const sync=()=>wrap.classList.toggle('yp-bill-date-empty',!ypBillParseDate(date.value));
  sync();
  date.addEventListener('input',sync);
  date.addEventListener('change',()=>{sync();if(onChange)onChange(date.value);});
  wrap.append(ph,date);
  return [lab,wrap,date];
}
function ypBillsField(labText,input,id){
  const lab=document.createElement('label');
  lab.className='yp-bill-date-lab';
  lab.textContent=labText;
  if(id){lab.setAttribute('for',id);input.id=id;}
  return [lab,input];
}
function ypBillsAddRow(){
  const row=document.createElement('div');
  row.className='yp-bill-row yp-bill-add';
  row.id='yp-bill-add';
  const title=document.createElement('div');
  title.className='yp-bill-name';
  title.id='yp-bill-add-title';
  title.textContent='Add Your Own Bill';
  const name=document.createElement('input');
  name.type='text';
  name.autocomplete='off';
  name.maxLength=80;
  name.placeholder='Item Name';
  name.value=ypBillsAddDraft.name||'';
  name.addEventListener('input',()=>{ypBillsAddDraft.name=name.value;});
  if(!YP_BILL_FREQ[ypBillsAddDraft.freq])ypBillsAddDraft.freq='month';
  const dateParts=ypBillsDateField('Next Due Date',ypBillsAddDraft.dueDate,'yp-bill-new-date',v=>{ypBillsAddDraft.dueDate=v;});
  const date=dateParts[2];
  const saveBtn=document.createElement('button');
  saveBtn.type='button';
  saveBtn.className='hwb';
  saveBtn.id='yp-bill-new-save';
  saveBtn.textContent='Save';
  saveBtn.addEventListener('click',()=>{
    ypBillsAddDraft.name=name.value;
    const liveAmt=document.getElementById('yp-bill-new-amount');
    if(liveAmt)ypBillsAddDraft.amount=liveAmt.value;
    ypBillsAddDraft.dueDate=date.value;
    const rec=ypBillsAddCustom(ypBillsAddDraft);
    if(!rec){
      name.focus();
      return;
    }
    ypBillsAddDraft={name:'',amount:'',freq:'month',dueDate:''};
    ypBillsSave();
  });
  const alab=document.createElement('label');
  alab.className='yp-bill-date-lab';
  alab.textContent='Amount';
  const amtRow=ypBillsAmtPeriodRow({
    editable:true,
    amount:ypBillsAddDraft.amount,
    freq:ypBillsAddDraft.freq,
    amountId:'yp-bill-new-amount',
    freqId:'yp-bill-new-freq',
    onAmount:v=>{ypBillsAddDraft.amount=v;},
    onFreq:k=>{ypBillsAddDraft.freq=k;}
  });
  row.append(title,...ypBillsField('Item Name',name,'yp-bill-new-name'),alab,amtRow,dateParts[0],dateParts[1],saveBtn);
  return row;
}
function ypBillsEditRow(it){
  const draft=ypBillsEditDraft||{name:it.name||'',amount:String(it.amount??''),freq:YP_BILL_FREQ[it.freq]?it.freq:'month',dueDate:it.dueDate||''};
  ypBillsEditDraft=draft;
  const row=document.createElement('div');
  row.className='yp-bill-row yp-bill-add';
  row.dataset.id=it.id;
  row.id=ypBillsDomId('yp-bill-edit',it.id);
  const title=document.createElement('div');
  title.className='yp-bill-name';
  title.textContent='Edit Bill';
  const name=document.createElement('input');
  name.type='text';
  name.autocomplete='off';
  name.maxLength=80;
  name.placeholder='Item Name';
  name.value=draft.name;
  name.addEventListener('input',()=>{draft.name=name.value;});
  const dateParts=ypBillsDateField('Next Due Date',draft.dueDate,ypBillsDomId('yp-bill-edit-date',it.id),v=>{draft.dueDate=v;});
  const date=dateParts[2];
  const saveBtn=document.createElement('button');
  saveBtn.type='button';
  saveBtn.className='hwb';
  saveBtn.textContent='Save';
  saveBtn.id=ypBillsDomId('yp-bill-edit-save',it.id);
  saveBtn.addEventListener('click',()=>{
    draft.name=name.value;
    const liveAmt=document.getElementById(ypBillsDomId('yp-bill-edit-amount',it.id));
    if(liveAmt)draft.amount=liveAmt.value;
    draft.dueDate=date.value;
    if(!ypBillsUpdateCustom(it.id,draft)){name.focus();return;}
    ypBillsEditId=null;ypBillsEditDraft=null;
    ypBillsSave();
  });
  const cancel=document.createElement('button');
  cancel.type='button';
  cancel.className='hwx';
  cancel.textContent='Cancel';
  cancel.addEventListener('click',()=>{ypBillsEditId=null;ypBillsEditDraft=null;ypBillsPaintList();});
  const alab=document.createElement('label');
  alab.className='yp-bill-date-lab';
  alab.textContent='Amount';
  const amtRow=ypBillsAmtPeriodRow({
    editable:true,
    amount:draft.amount,
    freq:draft.freq,
    amountId:ypBillsDomId('yp-bill-edit-amount',it.id),
    freqId:ypBillsDomId('yp-bill-edit-freq',it.id),
    onAmount:v=>{draft.amount=v;},
    onFreq:k=>{draft.freq=k;}
  });
  row.append(title,...ypBillsField('Item Name',name,ypBillsDomId('yp-bill-edit-name',it.id)),alab,amtRow,dateParts[0],dateParts[1],saveBtn,cancel);
  return row;
}
function ypBillsGameRow(it){
  const row=document.createElement('div');
  row.className='yp-bill-row';
  row.dataset.id=it.id;
  row.dataset.source=it.source||'';
  const name=document.createElement('div');
  name.className='yp-bill-name';
  name.textContent=it.name||'Bill';
  const amt=document.createElement('div');
  amt.className='yp-bill-amt yp-bill-amt-static';
  amt.textContent=ypBillsAmountText(it);
  row.append(name,amt);
  return row;
}
function ypBillsRow(it){
  if(ypBillsIsGame(it))return ypBillsGameRow(it);
  if(it.source==='custom'&&ypBillsEditId===it.id)return ypBillsEditRow(it);
  const row=document.createElement('div');
  row.className='yp-bill-row'+(ypBillsOpenId===it.id?' yp-open':'');
  row.dataset.id=it.id;
  row.dataset.source=it.source||'';
  const open=ypBillsOpenId===it.id;
  const btn=document.createElement('button');
  btn.type='button';
  btn.className='yp-bill-toggle';
  btn.setAttribute('aria-expanded',open?'true':'false');
  const name=document.createElement('span');
  name.className='yp-bill-name';
  name.textContent=it.name||'Bill';
  const right=document.createElement('span');
  right.className='yp-bill-right';
  const val=document.createElement('span');
  const hasAmt=it.amount!=null&&it.amount!==''&&+it.amount>0;
  val.className='yp-bill-val'+(hasAmt?'':' yp-bill-val-empty');
  val.textContent=hasAmt?ypNotifyMoney(it.amount):'Not Set';
  const chev=document.createElement('span');
  chev.className='yp-bill-chev';
  chev.setAttribute('aria-hidden','true');
  chev.textContent=open?'\u25B4':'\u25BE';
  right.append(val,chev);
  btn.append(name,right);
  btn.setAttribute('aria-label',(it.name||'Bill')+(hasAmt?(' '+ypNotifyMoney(it.amount)):'')+', '+(open?'hide':'show')+' details');
  const body=document.createElement('div');
  body.className='yp-bill-body';
  body.hidden=!open;
  const dateParts=ypBillsDateField('Next Due Date',it.dueDate,ypBillsDomId('yp-bill-date',it.id),v=>ypBillsSetDate(it.id,v));
  const editable=!ypBillsIsGame(it);
  if(!ypBillParseDate(it.dueDate)){
    const hint=document.createElement('p');
    hint.className='yp-bill-blank-hint';
    hint.textContent='Set the next due date.';
    body.appendChild(hint);
  }
  if(editable){
    const alab=document.createElement('label');
    alab.className='yp-bill-date-lab';
    alab.textContent='Amount';
    body.appendChild(alab);
  }
  body.appendChild(ypBillsAmtPeriodRow({
    editable:editable,
    amount:it.amount,
    amountText:ypBillsAmountText(it),
    freq:YP_BILL_FREQ[it.freq]?it.freq:(editable?'month':'year'),
    amountId:editable?ypBillsDomId('yp-bill-amount',it.id):null,
    freqId:ypBillsDomId('yp-bill-freq',it.id),
    onAmount:editable?(v=>ypBillsSetAmount(it.id,v)):null,
    onFreq:k=>ypBillsSetFreq(it.id,k)
  }));
  body.append(dateParts[0],dateParts[1]);
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
  body.appendChild(remind);
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
    body.appendChild(leads);
  }
  if(!ypBillsIsGame(it)&&it.source==='custom'){
    const actions=document.createElement('div');
    actions.className='yp-bill-actions';
    if(ypBillsDeleteId===it.id){
      const yes=document.createElement('button');
      yes.type='button';
      yes.className='yp-bill-del';
      yes.textContent='Delete This Bill';
      yes.addEventListener('click',()=>{ypBillsDeleteId=null;ypBillsDeleteCustom(it.id);});
      const no=document.createElement('button');
      no.type='button';
      no.textContent='Keep';
      no.addEventListener('click',()=>{ypBillsDeleteId=null;ypBillsPaintList();});
      actions.append(yes,no);
    }else{
      const edit=document.createElement('button');
      edit.type='button';
      edit.textContent='Edit';
      edit.addEventListener('click',()=>{ypBillsEditId=it.id;ypBillsEditDraft=null;ypBillsDeleteId=null;ypBillsPaintList();});
      const del=document.createElement('button');
      del.type='button';
      del.className='yp-bill-del';
      del.textContent='Delete';
      del.addEventListener('click',()=>{ypBillsDeleteId=it.id;ypBillsPaintList();});
      actions.append(edit,del);
    }
    body.appendChild(actions);
  }
  btn.addEventListener('click',()=>{
    ypBillsOpenId=open?null:it.id;
    ypBillsPaintList();
  });
  row.append(btn,body);
  return row;
}
function ypBillsRefreshOpen(){if(document.getElementById('yp-bills-list'))ypBillsPaintList();}
function ypBillsToggleRemind(id,on){
  const it=ypBillsGet(id);if(!it||ypBillsIsGame(it))return;
  it.remind=!!on;
  it.asked=true;
  it.choice=on?'yes':'no';
  if(!YP_NOTIFY_LEADS[it.lead])it.lead='week';
  ypBillsSave();
  if(on)ypNotifyOnFirstYes();
}
function ypBillsSetLead(id,lead){
  const it=ypBillsGet(id);if(!it||ypBillsIsGame(it)||!YP_NOTIFY_LEADS[lead])return;
  it.lead=lead;
  ypBillsSave();
}
function ypBillsPersist(){
  if(typeof save==='function')save();
  ypNotifySync();
  if(typeof ypSyncFeed==='function')ypSyncFeed();
  if(typeof hud==='function')hud();
}
function ypBillsSetAmount(id,raw){
  const it=ypBillsGet(id);if(!it||ypBillsIsGame(it))return;
  const amount=ypBillsReadAmount(raw);
  if(it.amount===amount)return;
  it.amount=amount;
  it.amountUser=1;
  ypBillsPersist();
}
function ypBillsSetFreq(id,freq){
  const it=ypBillsGet(id);if(!it||ypBillsIsGame(it)||!YP_BILL_FREQ[freq])return;
  if(it.freq===freq){it.freqUser=1;return;}
  it.freq=freq;
  it.freqUser=1;
  /* Persist without rebuilding the list so an iPhone select stays open on first tap. */
  ypBillsPersist();
}
function ypBillsSetDate(id,iso){
  const it=ypBillsGet(id);if(!it||ypBillsIsGame(it))return;
  const d=ypBillParseDate(iso);
  const next=d?iso:null;
  const day=d?d.getDate():null;
  const prev=ypBillParseDate(it.dueDate)?it.dueDate:null;
  if(prev===next){
    if(next&&day&&it.dueDay!==day)it.dueDay=day;
    return;
  }
  it.dueDate=next;
  it.dueDay=day;
  /* Persist without rebuilding the Bills list. iOS Safari often fires change
     when an empty date input is first opened; a repaint would replace the
     field and close the native picker. */
  ypBillsPersist();
}
function ypBillsNewCustomId(){
  const store=ypBillsStore();if(!store)return 'custom:1';
  store.seq=(store.seq|0)+1;
  return 'custom:'+store.seq;
}
function ypBillsReadAmount(raw){
  const n=parseFloat(String(raw==null?'':raw).replace(/[^0-9.]/g,''));
  return Number.isFinite(n)?Math.max(0,Math.round(n)):0;
}
function ypBillsAddCustom(fields){
  const name=String(fields&&fields.name||'').trim();
  if(!name)return null;
  const amount=ypBillsReadAmount(fields&&fields.amount);
  const freq=YP_BILL_FREQ[fields&&fields.freq]?fields.freq:'month';
  const dueDate=ypBillParseDate(fields&&fields.dueDate)?fields.dueDate:null;
  const dueDay=dueDate?ypBillParseDate(dueDate).getDate():null;
  const id=ypBillsNewCustomId();
  const rec=ypBillsUpsert({
    id,source:'custom',kind:'bill',name,amount,freq,dueDate,notifyType:'billDue'
  });
  if(rec){rec.freqUser=1;rec.amountUser=1;if(dueDay)rec.dueDay=dueDay;}
  if(rec){
    if(dueDate&&typeof rec.remind!=='boolean')rec.remind=true;
    if(dueDate&&!rec.remind&&rec.choice==null)rec.remind=true;
    if(rec.remind&&!YP_NOTIFY_LEADS[rec.lead])rec.lead='week';
  }
  return rec;
}
function ypBillsUpdateCustom(id,fields){
  const it=ypBillsGet(id);if(!it||it.source!=='custom')return null;
  const name=String(fields&&fields.name||'').trim();
  if(!name)return null;
  it.name=name;
  it.amount=ypBillsReadAmount(fields&&fields.amount);
  if(YP_BILL_FREQ[fields&&fields.freq]){it.freq=fields.freq;it.freqUser=1;}it.amountUser=1;
  const d=ypBillParseDate(fields&&fields.dueDate);
  it.dueDate=d?fields.dueDate:null;
  it.dueDay=d?d.getDate():null;
  return it;
}
function ypBillsDeleteCustom(id){
  const store=ypBillsStore();
  const it=store&&store.items[id];
  if(!it||it.source!=='custom')return;
  const type=it.notifyType&&YP_NOTIFY_TYPES[it.notifyType]?it.notifyType:'billDue';
  ypNotifyCancel(type,id);
  delete store.items[id];
  if(ypBillsEditId===id){ypBillsEditId=null;ypBillsEditDraft=null;}
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
  /* Real-life dates are edited on the Bills row. Game costs keep their game-week due date. */
  const it=ypBillsGet(id);if(!it||ypBillsIsGame(it))return;
  const safe=(typeof CSS!=='undefined'&&CSS.escape)?CSS.escape(id):String(id).replace(/"/g,'');
  const row=document.querySelector('#yp-bills [data-id="'+safe+'"] input[type=date]');
  if(row){try{row.focus();if(typeof row.showPicker==='function')row.showPicker();}catch(e){}}
}

/* ----- One-question reminder prompt ----- */
function ypBillsAskReminder(idOrItem){
  ypBillsInjectCss();
  const id=typeof idOrItem==='string'?idOrItem:(idOrItem&&idOrItem.id);
  ypBillsEnsure();
  const it=ypBillsGet(id);if(!it||ypBillsIsGame(it))return false;
  if(it.asked)return false;
  if(document.getElementById('yp-notify-ask'))return false;
  const due=ypBillsDueLabel(it).replace(/^(Next Due Date|Due Date|Reminder Date): /,'');
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
  /* Game-cost car items no longer use reminders, and this prompt was only used for them. */
}

/* ----- Schedule sync and game-event watch ----- */
function ypBillsScheduleAll(){
  ypBillsList().forEach(it=>{
    const type=it.notifyType&&YP_NOTIFY_TYPES[it.notifyType]?it.notifyType:(it.kind==='rego'?'regoDue':'billDue');
    const key=it.id;
    ypNotifyCancel(type,key);
    if(ypBillsIsGame(it)||!it.remind||!ypNotifyTypeOn(type))return;
    try{
      const occ=ypBillsOccurrence(it);
      if(!occ)return;
      const dueWall=occ.dueWall,label=occ.label;
      const lead=(YP_NOTIFY_LEADS[it.lead]||YP_NOTIFY_LEADS.week).ms;
      const at=dueWall-lead;
      const when=at>Date.now()+1000?at:(dueWall>Date.now()+1000?dueWall:NaN);
      if(!Number.isFinite(when))return;
      const msg=it.name+' is due '+label+'.';
      ypNotifySchedule(type,key,when,YP_NOTIFY_TYPES[type].label,msg,it.id);
    }catch(e){}
  });
}
function ypBillsOccurrence(it,iso){
  if(!it)return null;
  const type=it.notifyType&&YP_NOTIFY_TYPES[it.notifyType]?it.notifyType:(it.kind==='rego'?'regoDue':'billDue');
  const dateIso=ypBillParseDate(iso)?iso:(ypBillParseDate(it.dueDate)?it.dueDate:'');
  if(dateIso){
    const dueWall=ypBillDueWall(dateIso);
    if(!Number.isFinite(dueWall))return null;
    return {type,dueWall,label:ypBillDateLabel(dateIso)||dateIso,occ:dateIso};
  }
  if(ypBillsIsGame(it)){
    const w=Number.isFinite(+iso)?+iso:(Number.isFinite(it.nextWeek)?it.nextWeek:ypBillsNextWeek(it));
    if(!Number.isFinite(w))return null;
    let dueWall=NaN;
    try{if(typeof ypWallAt==='function'&&typeof CFG!=='undefined')dueWall=ypWallAt(w*CFG.weekMs);}catch(e){}
    if(!Number.isFinite(dueWall))return null;
    const label=typeof ypGameWeekLabel==='function'?ypGameWeekLabel(w):('Week '+w);
    return {type,dueWall,label,occ:'w'+w};
  }
  return null;
}
function ypBillsFireOccurrence(it,iso,past){
  if(!it||ypBillsIsGame(it)||!it.remind)return false;
  const rec=ypBillsOccurrence(it,iso);
  if(!rec)return false;
  if(!ypNotifyTypeOn(rec.type))return false;
  const lead=(YP_NOTIFY_LEADS[it.lead]||YP_NOTIFY_LEADS.week).ms;
  if(!past&&Date.now()<rec.dueWall-lead)return false;
  const firedKey=rec.type+':'+it.id+':'+rec.occ;
  return ypNotifyEvent(rec.type,it.name+' is due '+rec.label+'.',it.id,{key:firedKey});
}
function ypBillsFireDue(){
  ypBillsList().forEach(it=>ypBillsFireOccurrence(it));
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
  ypBillsFireDue();
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
    ypBillsFireDue();
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
    /* bills due this week still feed the Real Week card via ypBillsDueThisWeek / ypBillsFeedKey */
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
