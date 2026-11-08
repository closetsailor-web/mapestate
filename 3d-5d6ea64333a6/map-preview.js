// Your Plot map preview. Verbatim tested helpers from auction-v3-1, then a game-owned selection adapter.
// Not a live release. No auction, valuation, address lookup, or c1 lot binding.
const pilotSuggest=(()=>{
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const label=p=>[p.name||p.street||p.suburb||p.city||p.postcode,p.suburb,p.city,p.postcode,p.state,p.country].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');
function metres(a,b){
 if(![a.lon,a.lat,b.lon,b.lat].every(Number.isFinite))return Infinity;
 const R=6371000,p1=a.lat*Math.PI/180,p2=b.lat*Math.PI/180,dLat=(b.lat-a.lat)*Math.PI/180,dLon=(b.lon-a.lon)*Math.PI/180;
 const h=Math.sin(dLat/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dLon/2)**2;
 return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}
function samePlace(a,b){
 if(a.place_id&&a.place_id===b.place_id)return true;
 const name=p=>norm(p.name||p.suburb||p.district||p.city);
 if(name(a)!==name(b)||norm(a.country)!==norm(b.country)||norm(a.state)!==norm(b.state))return false;
 const cityA=norm(a.city),cityB=norm(b.city),locality=name(a);
 if(cityA&&cityB&&cityA!==cityB&&cityA!==locality&&cityB!==locality)return false;
 if(norm(a.county)&&norm(b.county)&&norm(a.county)!==norm(b.county))return false;
 return metres(a,b)<=8000;
}
function preferArea(a,b){const rank={suburb:4,district:3,city:2,postcode:1};return (rank[a.result_type]||0)>=(rank[b.result_type]||0)?a:b;}
function uniqueAreas(list){const out=[];for(const item of list){const i=out.findIndex(o=>samePlace(o,item));if(i<0)out.push(item);else out[i]=preferArea(out[i],item);}return out;}
function areas(data,country,postcode){return uniqueAreas((data.results||[]).filter(p=>['city','suburb','district','postcode'].includes(p.result_type)&&p.place_id&&!p.housenumber&&(!postcode||(p.postcode===postcode&&p.country_code==='au'))&&(!country||norm(p.country)===norm(country))).map(p=>({...p,label:label(p)})));}
function roads(data,area){return (data.results||[]).filter(p=>p.result_type==='street'&&p.street&&!p.housenumber&&Number.isFinite(p.lon)&&Number.isFinite(p.lat)&&norm(p.country)===norm(area.country)&&(!['suburb','district'].includes(area.result_type)||[p.suburb,p.district,p.city].some(v=>norm(v)===norm(area.name||area.suburb||area.city)))&&(area.result_type!=='postcode'||p.postcode===area.postcode)).map(p=>({...p,label:label({...p,name:p.street}),center:[p.lon,p.lat]}));}
function gate(){let version=0,controller;return {next(){version++;controller?.abort();controller=new AbortController();return {version,signal:controller.signal};},current(n){return n===version;}};}
return {areas,roads,gate};
})();
// END TESTABLE SUGGEST

const pilotStreetSearch=(()=>{
const ERROR='Street search unavailable. Check connection, search-key access or quota, then try again.';
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
function streetCore(s){return s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu,' ').split(/\s+/).filter(w=>w&&!['st','street','rd','road','ave','avenue','dr','drive','ct','court','ln','lane','cres','crescent','blvd','boulevard','way','tce','terrace','pde','parade'].includes(w)).join(' ');}
function query(street,town,country){street=street.trim();town=town.trim();country=country.trim();if(!street||!town)throw Error('Enter a street name and suburb/town.');if([street,town,country].some(s=>s.length>100)||/^\d+[A-Za-z]?(?:[ /-]|$)/.test(street))throw Error('Use a street name without a house number (maximum 100 characters per field).');return {street,city:town,country};}
function results(data,street,town,country){
return (Array.isArray(data?.results)?data.results:[]).filter(p=>{
if(p.result_type!=='street'||p.housenumber||!p.street||streetCore(p.street)!==streetCore(street))return false;
// City remains valid when the street is in a named suburb inside it.
const localities=[p.city,p.town,p.village,p.suburb,p.district];
if(!localities.some(s=>s&&norm(s)===norm(town)))return false;
if(country&&norm(p.country)!==norm(country))return false;
return Number.isFinite(p.lon)&&Number.isFinite(p.lat)&&Math.abs(p.lon)<=180&&Math.abs(p.lat)<=90;
}).map(p=>({label:[p.street,p.suburb,p.city||p.town||p.village,p.state,p.country].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).map(v=>String(v).slice(0,100)).join(', '),center:[p.lon,p.lat]})).slice(0,5);
}
async function search(fetcher,key,street,town,country){const input=query(street,town,country);if(!key)throw Error(ERROR);try{
const url=new URL('https://api.geoapify.com/v1/geocode/search');
const params={street:input.street,city:input.city,type:'street',bias:'countrycode:none',format:'json',limit:'5',apiKey:key};if(input.country)params.country=input.country;
url.search=new URLSearchParams(params);
const r=await fetcher(url.href,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();return results(await r.json(),input.street,input.city,input.country);
}catch{throw Error(ERROR);}}
function render(container,items,doc,choose){container.replaceChildren();for(const item of items){const b=doc.createElement('button');b.type='button';b.textContent=item.label;b.onclick=()=>choose(item);container.appendChild(b);}}
return {query,results,search,render,ERROR};
})();
// END TESTABLE STREET SEARCH

const pilotSelection = (() => {
// Exact polygon containment; boundary excluded so adjacent footprints are never joined.
function ringContains(p,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[j],b=ring[i],cross=(p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]);
  if(Math.abs(cross)<1e-14 && p[0]>=Math.min(a[0],b[0]) && p[0]<=Math.max(a[0],b[0]) && p[1]>=Math.min(a[1],b[1]) && p[1]<=Math.max(a[1],b[1]))return false;
  if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
function polygonContains(p,rings){return rings.length>0 && ringContains(p,rings[0]) && !rings.slice(1).some(r=>ringContains(p,r) || onBoundary(p,r));}
function onBoundary(p,r){for(let i=1;i<r.length;i++){const a=r[i-1],b=r[i];if(Math.abs((p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]))<1e-14 && p[0]>=Math.min(a[0],b[0]) && p[0]<=Math.max(a[0],b[0]) && p[1]>=Math.min(a[1],b[1]) && p[1]<=Math.max(a[1],b[1]))return true;}return false;}
function components(features,coordinate){
 const found=[],seen=new Set();
 for(const feature of features){
 const g=feature.geometry;if(!g)continue;
 const polygons=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
 for(const rings of polygons){if(!polygonContains(coordinate,rings))continue;
 const signature=JSON.stringify(rings);if(seen.has(signature))continue;seen.add(signature);
 found.push({...feature,geometry:{type:'Polygon',coordinates:rings}});
 }
 }
 return found;
}
return {components,polygonContains};
})();
// END TESTABLE SELECTION

function ypSelection(raw){
 if(!raw||typeof raw.gameId!=='string'||!/^yp-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw.gameId))return null;
 if(!Array.isArray(raw.coordinate)||raw.coordinate.length!==2||!raw.coordinate.every(Number.isFinite)||Math.abs(raw.coordinate[0])>180||Math.abs(raw.coordinate[1])>90)return null;
 return {gameId:raw.gameId,coordinate:[raw.coordinate[0],raw.coordinate[1]]};
}
function ypPersistable(raw){const s=ypSelection(raw);return s?{version:1,gameId:s.gameId,coordinate:[s.coordinate[0],s.coordinate[1]]}:null;}
function ypSameFootprint(savedHits,clickHits){return !!(savedHits&&clickHits&&savedHits.some(a=>clickHits.some(b=>a.geometry&&b.geometry&&JSON.stringify(a.geometry)===JSON.stringify(b.geometry))));}
function ypNextGameId(previousId,same){return same&&previousId?previousId:'yp-'+crypto.randomUUID();}
function autocompleteQuery(kind,text,area,country){
 text=String(text||'').trim();country=String(country||'').trim();
 if(kind==='street'){
  if(!area||!area.place_id)throw Error('Choose a town, suburb or postcode-area suggestion first.');
  if(text.length<3)throw Error('Type at least 3 street characters for suggestions.');
  if(/^\d+[A-Za-z]?(?:[ /-]|$)/.test(text))throw Error('Use a street name without a house number.');
  return {text,type:'street',filter:'place:'+area.place_id};
 }
 if(text.length<3)throw Error('Type at least 3 characters of a town, suburb or postcode.');
 if(/^\d+$/.test(text)&&text.length!==4)throw Error('Enter exactly 4 digits for an Australian postcode.');
 const postcode=/^\d{4}$/.test(text)?text:null;
 if(postcode&&country.toLowerCase()!=='australia')throw Error('Postcode lookup here supports Australia only. Choose Australia or search by town/suburb name.');
 const params={text,type:'locality'};
 if(postcode)params.limit='100';
 if(country.toLowerCase()==='australia')params.filter='countrycode:au';
 return params;
}
function geocodeUrl(params,key){
 if(!key)throw Error('Search key missing. No request was sent.');
 const url=new URL('https://api.geoapify.com/v1/geocode/autocomplete');
 url.search=new URLSearchParams({...params,bias:'countrycode:none',format:'json',limit:params.limit||'5',apiKey:key});
 return url;
}
const YP_MAP_REQUEST={cache:'no-store',credentials:'omit'};
// END TESTABLE IDENTITY

function ypShouldHideLabel(layer){
 if(!layer||layer.type!=='symbol')return false;
 const name=(String(layer.id||'')+' '+String(layer['source-layer']||layer.sourceLayer||'')).toLowerCase();
 if(/housenumber|house.?number|poi|point.?of.?interest|shop|business/.test(name))return true;
 if(/road[_ -]?label|road[_ -]?name|street[_ -]?(name|label)|transportation[_ -]?name/.test(name))return true;
 return false;
}
function ypSuburbKey(name){return String(name||'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function ypPreviewWeeklyRent(id){let h=2166136261;for(const c of String(id)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return 380+((h>>>0)%9)*20;}
function ypDestination(lon,lat,bearingDeg,distanceM){
 const R=6371000,delta=distanceM/R,theta=bearingDeg*Math.PI/180,phi1=lat*Math.PI/180,lambda1=lon*Math.PI/180;
 const phi2=Math.asin(Math.sin(phi1)*Math.cos(delta)+Math.cos(phi1)*Math.sin(delta)*Math.cos(theta));
 const lambda2=lambda1+Math.atan2(Math.sin(theta)*Math.sin(delta)*Math.cos(phi1),Math.cos(delta)-Math.sin(phi1)*Math.sin(phi2));
 let lon2=lambda2*180/Math.PI;lon2=((lon2+540)%360)-180;
 return {lon:+lon2.toFixed(6),lat:+(phi2*180/Math.PI).toFixed(6)};
}
function ypDistanceM(lon1,lat1,lon2,lat2){
 const R=6371000,phi1=lat1*Math.PI/180,phi2=lat2*Math.PI/180,dPhi=(lat2-lat1)*Math.PI/180,dLambda=(lon2-lon1)*Math.PI/180;
 const a=Math.sin(dPhi/2)*Math.sin(dPhi/2)+Math.cos(phi1)*Math.cos(phi2)*Math.sin(dLambda/2)*Math.sin(dLambda/2);
 return 2*R*Math.asin(Math.min(1,Math.sqrt(a)));
}
function ypRadiusPin(lon,lat,n){return ypDestination(lon,lat,(n-1)*36,400+(n-1)*160);}
function ypRadiusRing(lon,lat,distanceM){const ring=[];for(let i=0;i<=64;i++){const p=ypDestination(lon,lat,i/64*360,distanceM);ring.push([p.lon,p.lat]);}return ring;}
function ypStockId(suburbKey,n){return 'preview:'+suburbKey+':'+n;}
function ypFreshStock(){return {version:1,rentals:[]};}
function ypEnsureSuburbStock(store,place,buildings){
 const next={version:1,rentals:(store&&Array.isArray(store.rentals)?store.rentals:[]).map(r=>({...r}))};
 const key=ypSuburbKey(place&&(place.stockKey||place.label));
 if(!key||!place||!Number.isFinite(+place.lon)||!Number.isFinite(+place.lat))return next;
 if(!Array.isArray(buildings))return next;
 const seen=new Set(),picks=[];
 for(const b of buildings){
  const lon=Number(b&&b.lon),lat=Number(b&&b.lat);
  if(!Number.isFinite(lon)||!Number.isFinite(lat))continue;
  if(ypDistanceM(+place.lon,+place.lat,lon,lat)>2000)continue;
  const sig=lon.toFixed(5)+','+lat.toFixed(5);
  if(seen.has(sig))continue;
  seen.add(sig);
  picks.push({lon:+lon.toFixed(6),lat:+lat.toFixed(6)});
 }
 picks.sort((a,b)=>a.lon-b.lon||a.lat-b.lat);
 const chosen=picks.slice(0,10);
 const old=next.rentals.filter(r=>r.suburbKey===key);
 next.rentals=next.rentals.filter(r=>r.suburbKey!==key);
 chosen.forEach((pin,i)=>{
  const n=i+1,id=ypStockId(key,n),prev=old.find(r=>r.id===id),weekly=ypPreviewWeeklyRent(id);
  const keep=prev&&['application-pending','approved','active','expired','withdrawn','declined'].includes(prev.status)?prev.status:'available';
  const row={id,suburbKey:key,placeLabel:String(place.label),placement:'mapped-building',radiusM:2000,centreLon:+place.lon,centreLat:+place.lat,n,lon:pin.lon,lat:pin.lat,weeklyRent:weekly,bond:weekly*6,kind:'game-starter',status:keep};const locality=ypVerifiedLocality(place)||(prev&&ypVerifiedLocality({locality:prev.locality}));if(locality)row.locality=locality;
  if(keep!=='available'&&prev)Object.assign(row,{owner:prev.owner,appliedAt:prev.appliedAt,appliedGameMs:prev.appliedGameMs,approveGameMs:prev.approveGameMs,expiresAt:prev.expiresAt,bondCharged:prev.bondCharged,bondPaid:prev.bondPaid,startWeek:prev.startWeek,lastChargedWeek:prev.lastChargedWeek,confirmedAt:prev.confirmedAt,notified:prev.notified});
  next.rentals.push(row);
 });
 old.filter(r=>r.status&&r.status!=='available'&&!chosen.some((_,i)=>ypStockId(key,i+1)===r.id)).forEach(r=>next.rentals.push({...r}));
 next.rentals.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 return next;
}
function ypRadiusList(store,centre){
 if(!centre||!Number.isFinite(+centre.lon)||!Number.isFinite(+centre.lat))return {status:'none',items:[]};
 const key=ypSuburbKey(centre.stockKey||centre.label);
 const items=(store&&store.rentals||[]).filter(r=>r.suburbKey===key&&Number.isFinite(r.lon)&&Number.isFinite(r.lat)&&ypDistanceM(+centre.lon,+centre.lat,r.lon,r.lat)<=2000);
 items.sort((a,b)=>a.n-b.n);
 return {status:'ready',items};
}
function ypPage(items,page,size){size=size||20;const pages=Math.max(1,Math.ceil((items||[]).length/size));const p=Math.min(Math.max(1,page|0),pages);return {page:p,pages,items:(items||[]).slice((p-1)*size,p*size)};}
function ypInView(rental,bounds){if(!bounds)return true;return rental.lon>=bounds.west&&rental.lon<=bounds.east&&rental.lat>=bounds.south&&rental.lat<=bounds.north;}
function ypMoneyText(amount){const n=Math.round(Number(amount));if(!Number.isFinite(n))return '';const grouped=String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',');return (n<0?'-$':'$')+grouped;}
function ypRentPicture(weeklyRent,player){const num=v=>v==null||v===''?null:(Number.isFinite(+v)?+v:null);const rent=num(weeklyRent);const income=num(player&&player.incomeWk);const expenses=num(player&&player.expenseWk);const bank=num(player&&player.bank);const rentWk=rent==null?null:Math.round(rent);const incomeWk=income==null?null:Math.round(income);const expenseWk=expenses==null?null:Math.round(expenses);const bond=rentWk==null?null:rentWk*6;const left=incomeWk==null||expenseWk==null||rentWk==null?null:incomeWk-expenseWk-rentWk;const bankWk=bank==null?null:Math.round(bank);return {rent:rentWk,bond,income:incomeWk,expenses:expenseWk,left,bank:bankWk,afterBond:bankWk==null||bond==null?null:bankWk-bond};}
function ypListingModel(input){input=input||{};const kind=input.kind||'rent';const titles={rent:'Sample rental',sale:'Sample for sale',auction:'Sample auction',roomshare:'Sample room share'};const title=(titles[kind]||'Sample property')+(input.n?' '+input.n:'');const money=[];const add=(label,amount,primary)=>{const text=ypMoneyText(amount);if(text)money.push({label,amount:text,value:Math.round(Number(amount)),primary:!!primary});};const picture=kind==='rent'?ypRentPicture(input.weeklyRent,input.player):null;if(kind==='rent'){add('Weekly rent',input.weeklyRent,true);if(picture&&picture.bond!=null)add('Bond',picture.bond,false);}else if(kind==='sale')add('Asking price',input.price,true);else if(kind==='auction')add('Current bid',input.bid,true);else if(kind==='roomshare')add('Weekly room share',input.share,true);const flow=[];if(picture&&picture.income!=null){flow.push({label:'Weekly income',amount:picture.income,hint:'Take-home pay'});flow.push({label:'Weekly expenses',amount:picture.expenses,hint:'Living costs before this rent'});flow.push({label:'Left after this rent',amount:picture.left,hint:'Income minus expenses minus this rent'});}if(picture&&picture.bank!=null)flow.push({label:'In the bank',amount:picture.bank,hint:'Your balance now'});if(picture&&picture.afterBond!=null&&input.status!=='active')flow.push({label:'Bank if the bond were paid',amount:picture.afterBond,hint:'A projection. The bond is not taken.'});const st=input.appStatus||input.status||'available';const owner=input.owner==='player'?'player':'game';const limits={rent:'Game sample. Not a real vacancy. Apply does not charge you. You confirm before the six-week bond is paid.',sale:'Game sample. Not a real listing. Buying is not available, and nothing is charged.',auction:'Game sample. Not a real auction. Bidding is not available, and nothing is charged.',roomshare:'Game sample. Not a real room share. Sharing is not available, and nothing is charged.'};let action=kind==='rent'&&!input.fixture?{label:'Apply to rent',disabled:false,act:'apply'}:null;let statusText='';let limitation=limits[kind]||limits.rent;if(kind==='rent'&&!input.fixture&&st==='expired'){action=null;statusText='The test approval expired. Nothing was charged.';}else if(kind==='rent'&&!input.fixture&&st==='application-pending'){action={label:owner==='player'?'Waiting for the owner':'Test approval pending',disabled:true,act:'pending'};limitation=owner==='player'?'Waiting for the owner. This test does not decide for them. Nothing is charged.':'Test application pending. Nothing is charged. A game-provided rental is accepted after 1 game hour. The wait pauses when the game clock pauses.';if(owner!=='player'&&input.paused)statusText='Game clock paused. 1 game hour of game time still has to pass. Nothing is charged.';else if(owner!=='player'&&input.hoursLeft!=null)statusText=(input.hoursLeft>1?('About '+Math.ceil(input.hoursLeft)+' game hours left.'):'Less than 1 game hour left.')+' Nothing is charged.';}else if(kind==='rent'&&!input.fixture&&st==='approved'){action={label:'Confirm and pay bond',disabled:false,act:'confirm'};limitation='Approved for this test. Nothing has been charged. Confirm pays the six-week bond from your bank. The first week of rent is taken on the next game week.';if(input.secondsLeft!=null)statusText='Test approval lasts '+input.secondsLeft+'s. Nothing is charged until you confirm.';}else if(kind==='rent'&&!input.fixture&&st==='active'){action=null;statusText='Test tenancy started. The bond was paid once. Weekly rent is taken on each later game week, not before the next week.';limitation='This is a local test tenancy. It is not a real vacancy and it is not ownership of the building.';}if(kind==='rent'&&(st==='declined'||st==='withdrawn')){action=null;if(!statusText)statusText=st==='declined'?'This application was declined. Nothing was charged.':'This application was withdrawn. Nothing was charged.';}return {kind,title,place:input.place||'',money,flow,kicker:'Game sample property',status:statusText,limitation,action,fixture:!!input.fixture,fixtureNote:input.fixture?'Fixture only. Not a live record.':''};}
function ypReadPlayerMoney(){let incomeWk=null,expenseWk=null,bank=null;try{if(typeof salaryNetWk==='function')incomeWk=salaryNetWk();if(typeof INC==='function'){const inc=INC()||{};expenseWk=((+inc.exp||0)+(+inc.debt||0))*12/52;}if(typeof G!=='undefined'&&G&&Number.isFinite(+G.cash))bank=+G.cash;}catch(e){}return {incomeWk,expenseWk,bank};}
function ypRentalDetail(r,clock){const player=ypReadPlayerMoney();const wall=clock&&clock.wall!=null?clock.wall:null;const hour=clock?ypHourMs(clock):null;const hoursLeft=r&&r.status==='application-pending'&&r.approveGameMs!=null&&hour?Math.max(0,(r.approveGameMs-ypGameMs(clock))/hour):null;const secondsLeft=r&&r.status==='approved'&&r.expiresAt!=null&&wall!=null?Math.max(0,Math.ceil((r.expiresAt-wall)/1000)):null;const listing=ypListingModel({kind:'rent',n:r.n,place:r.placeLabel,weeklyRent:r.weeklyRent,status:r.status,owner:r.owner,hoursLeft,secondsLeft,paused:!!(clock&&clock.paused),player});return {id:r.id,title:listing.title,place:r.placeLabel,weeklyRent:r.weeklyRent,bond:r.weeklyRent*6,placement:r.placement||'mapped-building',pin:'Sample pin on a mapped building inside the 2 km search area around '+r.placeLabel+'. The circle stays on that centre when the map moves. It is not a real vacancy, occupant, or landlord.',ongoing:'Not calculated. This is not a measured building, so insurance and rates are not applied.',availability:listing.limitation,kind:r.kind,applyNote:'Apply records a preview application only. It does not charge your game balance and does not start a tenancy.',listing};}
function ypApplyPreview(store,id){return {version:1,rentals:(store&&store.rentals||[]).map(r=>r.id===id&&r.status==='available'?{...r,status:'application-pending'}:{...r})};}
const YP_TEST_CONFIRM_MS=60000;
const YP_GAME_HOURS_PER_WEEK=168;
function ypWeekMs(clock){const n=Number(clock&&clock.weekMs);return n>0?n:30000;}
function ypGameMs(clock){if(!clock||typeof clock==='number')return 0;return (clock.week|0)*ypWeekMs(clock)+Math.max(0,+clock.acc||0);}
function ypHourMs(clock){return ypWeekMs(clock)/YP_GAME_HOURS_PER_WEEK;}
function ypCloneStore(store){return {version:1,rentals:(store&&store.rentals||[]).map(r=>({...r}))};}
function ypGameClockLabel(gameMs){if(!Number.isFinite(+gameMs))return '';const weekMs=typeof CFG!=='undefined'&&CFG&&CFG.weekMs>0?CFG.weekMs:30000;const ms=+gameMs;const week=Math.floor(ms/weekMs);const hours=Math.round(((ms-week*weekMs)/(weekMs/168))*10)/10;return 'Week '+week+', '+(hours===1?'1 game hour':hours+' game hours');}
function ypHistoryEvent(id,kind,gameMs){if(!id||!Number.isFinite(+gameMs))return null;const text={applied:'Applied',accepted:'Accepted',declined:'Declined',withdrawn:'Withdrawn after another tenancy was confirmed',expired:'Expired',confirmed:'Tenancy confirmed'}[kind];if(!text)return null;return {key:id+'|'+kind+'|'+gameMs,propertyId:id,kind,gameMs:+gameMs,text};}
function ypMergeHistory(log,events){const eventsIn=Array.isArray(log&&log.events)?log.events.map(e=>({...e})):[];const seen=new Set(eventsIn.map(e=>e.key));(events||[]).forEach(e=>{if(!e||!e.key||seen.has(e.key)||!Number.isFinite(+e.gameMs))return;seen.add(e.key);eventsIn.push({key:e.key,propertyId:e.propertyId,kind:e.kind,gameMs:+e.gameMs,text:e.text});});eventsIn.sort((a,b)=>a.gameMs-b.gameMs||(a.key<b.key?-1:1));return {version:1,events:eventsIn};}
function ypHistoryFor(log,propertyId){return ypMergeHistory(log,[]).events.filter(e=>e.propertyId===propertyId);}
function ypApplySample(store,id,clock){const next=ypCloneStore(store);const r=next.rentals.find(x=>x.id===id);if(!r)return {store:next,ok:false,reason:'missing',events:[]};if(r.status==='application-pending'||r.status==='approved'||r.status==='active')return {store:next,ok:false,reason:'already',events:[]};const game=r.owner!=='player';const gameMs=ypGameMs(clock);r.status='application-pending';r.owner=game?'game':'player';r.appliedGameMs=gameMs;r.bondCharged=false;delete r.expiresAt;delete r.notified;if(game)r.approveGameMs=gameMs+ypHourMs(clock);else delete r.approveGameMs;const ev=ypHistoryEvent(r.id,'applied',gameMs);return {store:next,ok:true,reason:game?'pending-test':'pending-owner',events:ev?[ev]:[]};}
function ypRefreshSample(store,clock){const next=ypCloneStore(store);const gameNow=ypGameMs(clock);const wall=clock&&clock.wall!=null?clock.wall:0;const events=[];let changed=false;next.rentals.forEach(r=>{if(r.status==='active'||r.owner==='player')return;if(r.status==='application-pending'&&r.approveGameMs!=null&&gameNow>=r.approveGameMs){r.status='approved';if(r.expiresAt==null)r.expiresAt=wall+YP_TEST_CONFIRM_MS;changed=true;if(r.notified!=='approved'){r.notified='approved';const ev=ypHistoryEvent(r.id,'accepted',gameNow);if(ev)events.push(ev);}}else if(r.status==='approved'&&r.expiresAt!=null&&wall>=r.expiresAt){r.status='expired';changed=true;const ev=ypHistoryEvent(r.id,'expired',gameNow);if(ev)events.push(ev);}});return {store:next,changed,events};}
function ypDeclineSample(store,id,clock){const next=ypCloneStore(store);const r=next.rentals.find(x=>x.id===id);if(!r||r.status!=='application-pending'||r.bondCharged)return {store:next,ok:false,events:[]};r.status='declined';if(r.notified==='declined')return {store:next,ok:true,events:[]};r.notified='declined';const ev=ypHistoryEvent(r.id,'declined',ypGameMs(clock));return {store:next,ok:true,events:ev?[ev]:[]};}
function ypCancelSample(store,id){const next=ypCloneStore(store);const r=next.rentals.find(x=>x.id===id);if(!r||(r.status!=='application-pending'&&r.status!=='approved')||r.bondCharged)return {store:next,ok:false};r.status='available';delete r.appliedGameMs;delete r.approveGameMs;delete r.expiresAt;delete r.notified;return {store:next,ok:true};}
function ypConfirmSample(store,id,clock,player,cash,week){const base=ypCloneStore(store);const r=base.rentals.find(x=>x.id===id);const same={store,cash:+cash,ok:false,charged:0,events:[]};if(!r)return Object.assign(same,{reason:'missing'});if(r.status==='active'&&r.bondCharged)return Object.assign(same,{reason:'already-active'});if(r.status!=='approved')return Object.assign(same,{reason:r.status==='expired'?'expired':'not-approved'});if(base.rentals.some(x=>x.id!==id&&x.status==='active'))return Object.assign(same,{reason:'other-active'});const picture=ypRentPicture(r.weeklyRent,player);const bond=picture.bond;const problems=[];if(picture.left!=null&&picture.left<0)problems.push('left');if(!Number.isFinite(+cash)||+cash<bond)problems.push('bond');if(problems.length)return Object.assign(same,{reason:'short',short:problems,left:picture.left,bond,bank:+cash});const gameMs=ypGameMs(clock);r.status='active';r.bondCharged=true;r.bondPaid=bond;r.startWeek=week|0;r.lastChargedWeek=week|0;r.confirmedAt=clock&&clock.wall!=null?clock.wall:0;const events=[];const confirmed=ypHistoryEvent(r.id,'confirmed',gameMs);if(confirmed)events.push(confirmed);base.rentals.forEach(x=>{if(x.id!==id&&(x.status==='application-pending'||x.status==='approved')){x.status='withdrawn';const ev=ypHistoryEvent(x.id,'withdrawn',gameMs);if(ev)events.push(ev);}});return {store:base,cash:+cash-bond,ok:true,reason:'active',charged:bond,startWeek:r.startWeek,firstRentWeek:(week|0)+1,events};}
function ypChargeSampleWeek(store,week){const next=ypCloneStore(store);let charged=0;const now=week|0;next.rentals.forEach(r=>{if(r.status!=='active'||!r.bondCharged)return;const start=r.startWeek|0;const last=r.lastChargedWeek==null?start:r.lastChargedWeek|0;if(now<=last||now<=start)return;charged+=(now-last)*Math.round(+r.weeklyRent||0);r.lastChargedWeek=now;});return {store:next,charged};}
function ypOuterRings(geometry){if(!geometry||!geometry.coordinates)return [];if(geometry.type==='Polygon')return geometry.coordinates[0]?[geometry.coordinates[0]]:[];if(geometry.type==='MultiPolygon')return geometry.coordinates.map(p=>p&&p[0]).filter(Boolean);return [];}
function ypRingOpen(ring){if(!ring||ring.length<4)return [];const last=ring.length-1;if(ring[0][0]===ring[last][0]&&ring[0][1]===ring[last][1])return ring.slice(0,last);return ring.slice();}
function ypPointInRing(lon,lat,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi))inside=!inside;}return inside;}
function ypRingAreaM2(ring){const open=ypRingOpen(ring);if(open.length<3)return 0;const lat=open.reduce((s,p)=>s+p[1],0)/open.length;const mx=111320*Math.cos(lat*Math.PI/180),my=111320;let a=0;for(let i=0;i<open.length;i++){const p=open[i],q=open[(i+1)%open.length];a+=p[0]*mx*q[1]*my-q[0]*mx*p[1]*my;}return Math.abs(a)/2;}
function ypInteriorPoint(ring){const open=ypRingOpen(ring);if(open.length<3)return null;let lon=0,lat=0;open.forEach(p=>{lon+=p[0];lat+=p[1];});lon/=open.length;lat/=open.length;if(!ypPointInRing(lon,lat,ring))return null;return {lon,lat};}
function ypSpreadSites(points,limit){limit=limit||10;const seen=new Set(),uniq=[];for(const p of points||[]){const lon=+Number(p&&p.lon).toFixed(6),lat=+Number(p&&p.lat).toFixed(6);if(!Number.isFinite(lon)||!Number.isFinite(lat))continue;const sig=lon.toFixed(5)+','+lat.toFixed(5);if(seen.has(sig))continue;seen.add(sig);uniq.push({lon,lat,d:Number.isFinite(+p.d)?+p.d:0});}if(uniq.length<=limit){uniq.sort((a,b)=>a.lon-b.lon||a.lat-b.lat);return uniq.map(({lon,lat})=>({lon,lat}));}const left=uniq.slice().sort((a,b)=>b.d-a.d||a.lon-b.lon||a.lat-b.lat);const chosen=[left.shift()];while(chosen.length<limit&&left.length){let best=0,bestScore=-1;for(let i=0;i<left.length;i++){let minD=Infinity;for(const c of chosen){const dist=ypDistanceM(left[i].lon,left[i].lat,c.lon,c.lat);if(dist<minD)minD=dist;}const closer=minD>bestScore+0.05,tie=Math.abs(minD-bestScore)<=0.05&&(left[i].lon<left[best].lon||(left[i].lon===left[best].lon&&left[i].lat<left[best].lat));if(closer||tie){best=i;bestScore=minD;}}chosen.push(left.splice(best,1)[0]);}return chosen.map(({lon,lat})=>({lon:+lon.toFixed(6),lat:+lat.toFixed(6)}));}
function ypAreaStockReady(previousSig,points,tilesLoaded){const sig=(points||[]).map(p=>(+p.lon).toFixed(5)+','+(+p.lat).toFixed(5)).sort().join('|');if(!sig)return {ready:false,sig};return {ready:sig===previousSig&&(points.length>=10||!!tilesLoaded),sig};}
function ypCommitAreaStock(store,place,buildings,hold){hold=hold||{key:'',sig:'',tilesLoaded:false};const key=ypSuburbKey(place&&(place.stockKey||place.label));const base=store&&Array.isArray(store.rentals)?store:ypFreshStock();if(!key||!place||!Number.isFinite(+place.lon)||!Number.isFinite(+place.lat))return {store:base,hold,committed:false,placed:0,changed:false};const current=base.rentals.filter(r=>r.suburbKey===key&&Number.isFinite(r.lon)&&Number.isFinite(r.lat)&&ypDistanceM(+place.lon,+place.lat,r.lon,r.lat)<=2000);if(current.length)return {store:base,hold:{key,sig:hold.sig||'',tilesLoaded:!!hold.tilesLoaded},committed:true,placed:current.length,changed:false};const decision=ypAreaStockReady(hold.key===key?hold.sig:'',buildings||[],!!hold.tilesLoaded);const nextHold={key,sig:decision.sig,tilesLoaded:!!hold.tilesLoaded};if(!decision.ready)return {store:base,hold:nextHold,committed:false,placed:0,changed:false};const next=ypEnsureSuburbStock(base,place,buildings);return {store:next,hold:nextHold,committed:true,placed:next.rentals.filter(r=>r.suburbKey===key).length,changed:true};}
function ypBuildingSites(records,place){const out=[],seen=new Set();if(!place||!Number.isFinite(+place.lon)||!Number.isFinite(+place.lat))return [];for(const rec of records||[]){if(String(rec&&rec.sourceLayer||'').toLowerCase()!=='building')continue;for(const ring of ypOuterRings(rec.geometry)){const area=ypRingAreaM2(ring);if(!(area>=40&&area<=12000))continue;const point=ypInteriorPoint(ring);if(!point)continue;const d=ypDistanceM(+place.lon,+place.lat,point.lon,point.lat);if(d>2000)continue;const sig=point.lon.toFixed(5)+','+point.lat.toFixed(5);if(seen.has(sig))continue;seen.add(sig);out.push({lon:+point.lon.toFixed(6),lat:+point.lat.toFixed(6),d});}}return ypSpreadSites(out,10);}
function ypIsPlainLocality(name){const s=String(name||'').trim();if(!s||s.length>80)return false;if(/^searched area\b/i.test(s))return false;if(/-?\d{1,3}\.\d{3,}/.test(s))return false;return true;}
function ypVerifiedLocality(item){if(!item||typeof item!=='object')return '';const type=String(item.result_type||'');let raw='';if(type==='suburb')raw=item.name||item.suburb||'';else if(type==='district')raw=item.name||item.district||'';else if(type==='city')raw=item.name||item.city||'';else if(type==='postcode')raw=item.suburb||item.city||'';else if(item.locality)raw=item.locality;const name=String(raw||'').trim();if(!ypIsPlainLocality(name)||/^\d{4}$/.test(name))return '';return name;}
function ypReviewLocation(rental){const own=ypVerifiedLocality(rental&&rental.locality?{locality:rental.locality}:{});if(own)return own;const centre=typeof window!=='undefined'?window.__ypListCentre:null;if(centre&&rental&&ypSuburbKey(centre.stockKey||centre.label)===rental.suburbKey){const from=ypVerifiedLocality(centre.locality?{locality:centre.locality}:centre);if(from)return from;}const chosen=typeof window!=='undefined'?window.__ypPlace:null;if(chosen&&rental&&ypSuburbKey(chosen.stockKey||chosen.label)===rental.suburbKey){const from=ypVerifiedLocality(chosen.locality?{locality:chosen.locality}:chosen);if(from)return from;}return 'Searched area';}
// END TESTABLE STOCK

/* Preview map adapter. Runs in the game page after the existing scripts. It does not change intro copy, finance, or c1 lot records. */
const YP_LIMIT='This highlight is one basemap footprint only. It is not a Your Plot lot, it has no game owner, and it has no game price. The saved id is a new UUID plus the click coordinate, not a vendor id and not a stable property identity.';
const YP_GAMELOT='This listing is an existing Coralwood game record. It is not a building on the basemap, so the camera was not moved and no real owner or price was created.';
const YP_STORE='yp.mapsel.v1';
const YP_DEMO=[152.348238,-24.865295];
const YP_CSS=`html.yp-preview #rsearch,html.yp-preview #yp-foot,html.yp-preview #yp-map-status,html.yp-preview #yp-locate,html.yp-preview #yp-locate-note,html.yp-preview #yp-locate-status,html.yp-preview #yp-properties,html.yp-preview #yp-search-extra,html.yp-preview #view3d{display:none!important}
html.yp-preview .fab{z-index:8}
#ypbasemap{position:absolute;inset:0;z-index:2;background:#e7eef5}
#yp-logo{position:absolute;left:8px;bottom:6px;z-index:3}
#yp-logo img{width:88px;background:#ffffffc9;display:block}
html.yp-preview #w3dc,html.yp-preview #map canvas#w3dc,body.ypbasemap #w3dc{display:none!important;visibility:hidden!important;pointer-events:none!important}
body.ypbasemap #map .maplibregl-ctrl-attrib{font-size:10px;max-width:70vw;z-index:5}
#yp-where,#yp-prop,#yp-rent-list,#yp-rent-detail{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:20px 20px calc(108px + var(--sab));background:rgba(11,37,69,.62);font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#14213d}
#yp-where .card,#yp-prop .card,#yp-rent-list .card,#yp-rent-detail .card{background:#fff;border-radius:24px;width:100%;max-width:380px;padding:0 22px 20px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.35);max-height:min(68dvh,560px);overflow:auto}
#yp-where .hwh,#yp-prop .hwh,#yp-rent-list .hwh,#yp-rent-detail .hwh{margin:0 -22px 16px;padding:18px 22px 14px;background:radial-gradient(120% 160% at 85% 0%,#1a6fff 0%,#0a3fb0 55%,#0b2545 100%);border-radius:24px 24px 0 0;color:#fff}
#yp-where h2,#yp-prop h2,#yp-rent-list h2,#yp-rent-detail h2{margin:0 0 12px;font-size:18px;font-weight:700;letter-spacing:-.3px;color:#0b2545}
#yp-where .hwh h2,#yp-rent-list .hwh h2,#yp-rent-detail .hwh h2{color:#fff;margin:0}
#yp-where p,#yp-where-status,#yp-prop p,#yp-rent-list p,#yp-rent-detail p{margin:0 0 10px;font-size:14.5px;line-height:1.35;font-weight:400;color:#5a6780;text-align:center}
#yp-rent-list,#yp-rent-detail{align-items:flex-start;padding-top:118px}
#yp-search-area{position:absolute;left:50%;bottom:calc(132px + var(--sab));transform:translateX(-50%);z-index:46;border:0;border-radius:999px;background:#b8410a;color:#fff;font:700 15px Inter,system-ui,sans-serif;min-height:44px;padding:0 16px;cursor:pointer}
#yp-rent-list .yp-rent-row{display:block;width:100%;min-height:44px;margin:6px 0;border:0;border-radius:12px;background:#e7f0ff;color:#0a3a8c;font:600 14px Inter,system-ui,sans-serif;cursor:pointer}
#yp-where-town{display:block;width:100%;box-sizing:border-box;border-radius:14px;border:1px solid rgba(20,33,61,.12);background:#fff;padding:11px 14px;font:500 16px Inter,system-ui,sans-serif;color:#14213d}
#yp-where-town:focus,#yp-where-town:focus-visible{outline:none;border-color:#0a3a8c;box-shadow:0 0 0 4px rgba(10,58,140,.15)}
#yp-where #yp-where-move{margin-top:16px}
#yp-chosen-note{position:absolute;left:50%;top:calc(72px + var(--sat));transform:translateX(-50%);z-index:6;margin:0;max-width:min(440px,92vw);padding:8px 12px;border-radius:12px;background:rgba(255,255,255,.95);color:#14213d;font:600 14px Inter,system-ui,sans-serif;text-align:center;pointer-events:none}
#yp-where .hwb,#yp-prop .hwb,#yp-rent-list .hwb,#yp-rent-detail .hwb{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;border:0;border-radius:999px;background:#b8410a;color:#fff;font:700 16px Inter,system-ui,sans-serif;margin-top:8px;cursor:pointer}
#yp-where #yp-where-close{min-height:54px;padding:0 16px;font-size:17px;font-weight:700;box-shadow:0 10px 22px rgba(196,71,11,.32)}
#yp-where .hwx,#yp-prop .hwx,#yp-rent-list .hwx,#yp-rent-detail .hwx{background:none;border:0;color:#5a6780;min-height:44px;min-width:44px;font:600 15px Inter,system-ui,sans-serif;cursor:pointer;padding:10px 14px}
#yp-where .hwb:focus,#yp-where .hwb:focus-visible,#yp-where .hwx:focus,#yp-where .hwx:focus-visible,#yp-prop button:focus,#yp-prop button:focus-visible,#yp-rent-list button:focus,#yp-rent-detail button:focus{outline:3px solid #0a3a8c;outline-offset:3px}
#yp-rent-detail{align-items:flex-start;justify-content:center;overflow:auto;padding:76px 16px calc(96px + var(--sab))}
#yp-rent-detail .yp-listing{text-align:left;max-width:440px;max-height:min(78dvh,calc(100dvh - 160px));overflow:auto;margin:0 auto}
#yp-rent-detail .yp-listing p,#yp-fixture-board .yp-listing p{text-align:left}
.yp-listing .hwh{text-align:left}
.yp-listing .yp-kicker{margin:0 0 6px;font:700 12px Inter,system-ui,sans-serif;letter-spacing:.04em;text-transform:uppercase;color:rgba(255,255,255,.88)}
.yp-listing .hwh h2{font-size:22px;line-height:1.25;text-align:left}
.yp-listing .yp-price{margin:16px 0 6px;color:#0b2545}
.yp-listing .yp-amt{font:800 34px/1.05 Inter,system-ui,sans-serif;letter-spacing:-.5px}
.yp-listing .yp-per{margin-left:8px;font:700 16px Inter,system-ui,sans-serif;color:#5a6780}
.yp-listing .yp-place{margin:0 0 14px;font:600 16px/1.35 Inter,system-ui,sans-serif;color:#14213d;overflow-wrap:anywhere}
.yp-listing .yp-facts{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px}
.yp-listing .yp-facts div{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:#e7f0ff;color:#0a3a8c}
.yp-listing .yp-facts svg{width:16px;height:16px;flex:none}
.yp-listing dt,.yp-listing dd{font:600 14px Inter,system-ui,sans-serif;color:#0a3a8c}
.yp-listing dd{margin:0;font-weight:700}
.yp-listing .yp-flow{margin:0 0 12px}
.yp-listing .yp-flow div{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid rgba(20,33,61,.08)}
.yp-listing .yp-flow dt{font:600 14px Inter,system-ui,sans-serif;color:#3d4a63}
.yp-listing .yp-flow dd{margin:0;font:700 15px Inter,system-ui,sans-serif;color:#14213d;text-align:right}
.yp-listing .yp-flow .yp-hint{display:block;font:500 12px Inter,system-ui,sans-serif;color:#5a6780}
.yp-listing .yp-neg{color:#c0672b}
.yp-listing .yp-status,.yp-listing .yp-limit,.yp-listing .yp-fixture{font-size:13.5px;line-height:1.45}
.yp-listing .yp-limit{color:#3d4a63}
.yp-listing .yp-fixture{color:#8a4b08;font-weight:650}
.yp-listing .hwb:disabled{opacity:.55;cursor:default}
#yp-rent-list .yp-rent-row{display:flex;flex-direction:column;align-items:flex-start;gap:2px;height:auto;white-space:normal;text-align:left;padding:10px 12px}
#yp-rent-list .yp-row-title{font-weight:750}
#yp-rent-list .yp-row-meta{font:500 13px Inter,system-ui,sans-serif;color:#3d4a63;overflow-wrap:anywhere}
#yp-rent-list .yp-row-price{font-weight:750;color:#0b2545}
#yp-fixture-board{position:fixed;inset:0;z-index:50;overflow:auto;background:#e7eef5;padding:16px}
#yp-fixture-board .yp-listing{margin:0 auto 16px;max-width:440px}
#yp-where-suggestions{text-align:left;max-height:160px;overflow:auto;margin-top:6px}
#yp-where-suggestions button{display:block;width:100%;min-height:44px;margin:4px 0;text-align:left;border:0;border-radius:12px;background:#e7f0ff;color:#0a3a8c;font:600 15px Inter,system-ui,sans-serif;padding:8px 12px;cursor:pointer;touch-action:manipulation}
#yp-where-suggestions button:hover,#yp-where-suggestions button.on{background:#d4e4ff;color:#0a3a8c}
#yp-where-suggestions button:focus,#yp-where-suggestions button:focus-visible{outline:3px solid #0a3a8c;outline-offset:2px;background:#d4e4ff}
#yp-where-suggestions button:active,#yp-where-suggestions button.press{background:#c5d9fb;transform:scale(.98)}
#yp-where-privacy{text-align:left}
#yp-prop .choices{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}
#yp-pending,#yp-history,#yp-property-menu{position:fixed;inset:0;z-index:48;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:76px 16px calc(96px + var(--sab));background:rgba(11,37,69,.62);font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#14213d}
#yp-pending .card,#yp-history .card,#yp-property-menu .card{background:#fff;border-radius:24px;width:100%;max-width:440px;padding:0 22px 20px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.35)}
#yp-pending .hwh,#yp-history .hwh,#yp-property-menu .hwh{margin:0 -22px 16px;padding:18px 22px 14px;background:radial-gradient(120% 160% at 85% 0%,#1a6fff 0%,#0a3fb0 55%,#0b2545 100%);border-radius:24px 24px 0 0;color:#fff}
#yp-pending .hwh h2,#yp-history .hwh h2,#yp-property-menu .hwh h2{margin:0;color:#fff;font-size:18px;font-weight:700}
#yp-pending p,#yp-history p,#yp-property-menu p{margin:0 0 10px;font-size:14.5px;line-height:1.35;color:#5a6780;text-align:center}
#yp-pending .yp-rent-row,#yp-history .yp-rent-row{display:flex;flex-direction:column;align-items:flex-start;gap:2px;width:100%;min-height:44px;margin:6px 0;border:0;border-radius:12px;background:#e7f0ff;color:#0a3a8c;font:600 14px Inter,system-ui,sans-serif;cursor:pointer;text-align:left;padding:10px 12px}
#yp-pending .yp-row-title,#yp-history .yp-row-title{font-weight:750}
#yp-pending .yp-row-meta,#yp-history .yp-row-meta,#yp-pending .yp-row-price,#yp-history .yp-row-price{font:500 13px Inter,system-ui,sans-serif;color:#3d4a63}
#yp-pending .hwb,#yp-history .hwb,#yp-property-menu .hwb{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;border:0;border-radius:999px;background:#b8410a;color:#fff;font:700 16px Inter,system-ui,sans-serif;margin-top:8px;cursor:pointer}
#yp-pending .hwx,#yp-history .hwx,#yp-property-menu .hwx{background:none;border:0;color:#5a6780;min-height:44px;font:600 15px Inter,system-ui,sans-serif;cursor:pointer}
#yp-apply-review{position:fixed;inset:0;z-index:52;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:76px 16px calc(96px + var(--sab));background:#0b2545;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#14213d}
#yp-apply-review .card{background:#fff;border-radius:24px;width:100%;max-width:400px;padding:0 22px 20px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.35)}
#yp-apply-review .hwh{margin:0 -22px 16px;padding:18px 22px 14px;background:radial-gradient(120% 160% at 85% 0%,#1a6fff 0%,#0a3fb0 55%,#0b2545 100%);border-radius:24px 24px 0 0}
#yp-apply-review .hwh h2{margin:0;color:#fff;font-size:18px;font-weight:700}
#yp-apply-review .yp-review-row{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:8px 0;border-top:1px solid rgba(20,33,61,.08);text-align:left}
#yp-apply-review .yp-review-row span:first-child{color:#3d4a63;font:600 13px Inter,system-ui,sans-serif}
#yp-apply-review .yp-review-row span:last-child{color:#14213d;font:700 16px Inter,system-ui,sans-serif;overflow-wrap:anywhere}
#yp-apply-review h3{margin:16px 0 0;font:700 16px Inter,system-ui,sans-serif;color:#14213d;text-align:left}
#yp-apply-review p{margin:6px 0 0;font-size:14.5px;line-height:1.4;color:#3d4a63;text-align:left}
#yp-apply-review .hwb{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;border:0;border-radius:999px;background:#b8410a;color:#fff;font:700 16px Inter,system-ui,sans-serif;margin-top:16px;cursor:pointer}
#yp-apply-review .hwx{background:none;border:0;color:#5a6780;min-height:44px;width:100%;font:600 15px Inter,system-ui,sans-serif;cursor:pointer}`;

function ypZoom(dir){
 if(!ypMap||typeof ypMap.getZoom!=='function'){ypShowAreaNote('The map is not ready, so zoom did not change.');return;}
 try{ypMap.easeTo({zoom:ypMap.getZoom()+(dir>0?1:-1),duration:0});}catch(e){ypShowAreaNote('Zoom did not change.');}
}
function ypRecentre(){
 const p=window.__ypListCentre||window.__ypPlace;
 if(!ypMap){ypShowAreaNote('The map is not ready, so the view was not moved.');return;}
 if(!p||!Number.isFinite(+p.lon)||!Number.isFinite(+p.lat)){ypShowAreaNote('Choose a town or suburb, or use Search Area, before recentring.');return;}
 try{ypMap.jumpTo({center:[+p.lon,+p.lat],zoom:13});}catch(e){ypShowAreaNote('The map could not move to the search area.');}
}
function ypSavedGame(){return !!window.__ypGameStarted;}
function ypBindMapControls(){
 const list=document.getElementById('list3d');
 if(list){list.onclick=()=>ypOpenListingsChoice();list.title='Listings';list.setAttribute('aria-label','Listings');const span=list.querySelector('span');if(span)span.textContent='List';}
 const top=document.getElementById('view3d');
 if(top){top.onclick=null;top.hidden=true;top.setAttribute('aria-hidden','true');}
 const zin=document.getElementById('zoomin'),zout=document.getElementById('zoomout');
 if(zin)zin.onclick=()=>ypZoom(1);
 if(zout)zout.onclick=()=>ypZoom(-1);
 const home=document.getElementById('home');
 if(home){home.hidden=false;home.title='Recentre';home.setAttribute('aria-label','Recentre on the search area');home.onclick=ypRecentre;}
}
(function ypBoot(){
 if(window.__ypMapBoot)return;window.__ypMapBoot=1;
 ypBindMapControls();
 document.documentElement.classList.add('yp-preview');
 window.__ypBlockAutoLists=true;
 const prevBoot=window.W3D_BOOT;
 window.W3D_BOOT=function(){try{prevBoot&&prevBoot();}catch(e){console.error(e);}if(ypSavedGame())ypEnterRealMap();};
 const prevStart=window.startView;
 if(typeof prevStart==='function')window.startView=function(){const r=prevStart.apply(this,arguments);ypEnterRealMap();return r;};
 if(ypSavedGame())ypEnterRealMap();
 if(typeof hud==='function'&&!hud.__ypHeader){const prevHud=hud;function ypHud(){const result=prevHud.apply(this,arguments);ypSyncHeader();return result;}ypHud.__ypHeader=1;window.hud=ypHud;}
 ypInstallHandoff();
})();

function ypFoot(extra){const el=document.getElementById('yp-foot');if(!el)return;el.textContent=extra?extra+' '+YP_LIMIT:YP_LIMIT;}
function ypReadSelection(){try{return ypSelection(JSON.parse(localStorage.getItem(YP_STORE)||'null'));}catch{return null;}}
function ypWriteSelection(record){const body=ypPersistable(record);if(!body)return false;try{localStorage.setItem(YP_STORE,JSON.stringify(body));return true;}catch{return false;}}
function ypGameLotNote(){try{toast(YP_GAMELOT);}catch(e){ypFoot(YP_GAMELOT);}}

let ypMap,ypReady=false,ypRecord=null,ypBuildingLayers=[],ypHighlightSignature='',ypGeoKey='',ypHasTiles=false,ypMapFailed=false,ypEntered=false,ypLocateCtrl=null;
function ypEmpty(){return {type:'FeatureCollection',features:[]};}
function ypHighlight(data){if(!ypMap)return;const signature=JSON.stringify(data);if(signature===ypHighlightSignature)return;ypHighlightSignature=signature;const src=ypMap.getSource('yp-highlight');if(src)src.setData(data);}
function ypAt(coordinate){if(!ypMap||!ypReady)return [];const pt=ypMap.project(coordinate),c=ypMap.getCanvas();if(pt.x<0||pt.y<0||pt.x>c.clientWidth||pt.y>c.clientHeight)return [];return pilotSelection.components(ypMap.queryRenderedFeatures(pt,{layers:ypBuildingLayers}),coordinate);}
function ypRematch(){
 if(!ypRecord||!ypReady)return;
 const hits=ypAt(ypRecord.coordinate);
 if(!hits.length){ypHighlight(ypEmpty());ypFoot('No rendered building at the saved coordinate in this view. Zoom in and the same id is kept. Coordinate re-matching is experimental.');return;}
 const chosen=hits[0];
 ypHighlight({type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:chosen.geometry}]});
 ypFoot((hits.length>1?'Overlapping footprints: the topmost one is highlighted. That is ambiguous, not a confirmed parcel. ':'One clicked polygon component. ')+'Saved id '+ypRecord.gameId+'.');
}
function ypPatchCamera(){
 if(!window.MapView)return;
 MapView.focus=function(){ypGameLotNote();};
 MapView.home=function(){if(ypRecord&&ypMap)ypMap.jumpTo({center:ypRecord.coordinate,zoom:18});else ypFoot('There is no Coralwood game lot to fly to on this basemap.');};
 if(MapView.m){
  MapView.m.zoomIn=function(){if(ypMap)ypMap.zoomIn();};
  MapView.m.zoomOut=function(){if(ypMap)ypMap.zoomOut();};
  MapView.m.fitBounds=function(){ypGameLotNote();};
  MapView.m.flyToBounds=function(){ypGameLotNote();};
  MapView.m.flyTo=function(){ypGameLotNote();};
  MapView.m.setView=function(){ypGameLotNote();};
 }
}
function ypLoadMapLibre(){
 function drop(){if(window.maplibregl&&Object.prototype.hasOwnProperty.call(maplibregl,'GeolocateControl'))delete maplibregl.GeolocateControl;}
 if(window.maplibregl){drop();return Promise.resolve();}
 return new Promise((resolve,reject)=>{
  if(!document.getElementById('yp-maplibre-css')){const css=document.createElement('link');css.id='yp-maplibre-css';css.rel='stylesheet';css.href='https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css';document.head.appendChild(css);}
  const s=document.createElement('script');s.src='https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js';s.onload=()=>{if(!window.maplibregl){reject(new Error('library'));return;}drop();resolve();};s.onerror=()=>reject(new Error('library'));document.head.appendChild(s);
 });
}
function ypMountChrome(){
 if(!document.getElementById('yp-preview-css')){const st=document.createElement('style');st.id='yp-preview-css';st.textContent=YP_CSS;document.head.appendChild(st);}
 document.body.classList.add('ypbasemap');
 const host=document.getElementById('map');
 let box=document.getElementById('ypbasemap');
 if(!box&&host){box=document.createElement('div');box.id='ypbasemap';host.appendChild(box);}
 ypMountSearchArea();
}
function ypStatusPanel(text){const live=document.getElementById('yp-where-status');if(live&&text)live.textContent=text;}
function ypClearStatusPanel(){const el=document.getElementById('yp-map-status');if(el)el.remove();}
const YP_STOCK_KEY='yp.previewStock.v1';
const YP_CENTRE_KEY='yp.listCentre.v1';
function ypSaveCentre(){try{localStorage.setItem(YP_CENTRE_KEY,JSON.stringify({place:window.__ypPlace||null,centre:window.__ypListCentre||null}));}catch(e){}}
function ypLoadCentre(){try{const o=JSON.parse(localStorage.getItem(YP_CENTRE_KEY)||'null');if(!o)return;if(o.place&&Number.isFinite(+o.place.lon)&&Number.isFinite(+o.place.lat))window.__ypPlace=o.place;if(o.centre&&Number.isFinite(+o.centre.lon)&&Number.isFinite(+o.centre.lat))window.__ypListCentre=o.centre;}catch(e){}}
function ypReadStock(){try{const o=JSON.parse(localStorage.getItem(YP_STOCK_KEY)||'null');if(!o||o.version!==1||!Array.isArray(o.rentals))return ypFreshStock();return o;}catch(e){return ypFreshStock();}}
function ypWriteStock(store){try{localStorage.setItem(YP_STOCK_KEY,JSON.stringify(store));}catch(e){}}
function ypApplyLabelPolicy(map){const layers=map&&map.getStyle&&map.getStyle()&&map.getStyle().layers||[];for(const layer of layers){if(ypShouldHideLabel(layer)){try{map.setLayoutProperty(layer.id,'visibility','none');}catch(e){}}}}
function ypSyncRentalMarkers(){if(!ypMap||!ypMap.getSource||!ypMap.getSource('yp-rentals'))return;const place=window.__ypListCentre;const items=place?ypRadiusList(ypReadStock(),place).items:[];ypMap.getSource('yp-rentals').setData({type:'FeatureCollection',features:items.map(r=>({type:'Feature',properties:{id:r.id},geometry:{type:'Point',coordinates:[r.lon,r.lat]}}))});}
function ypOpenSelectedList(){ypCloseWhere();window.__ypListPage=1;ypRenderRentalList();}
function ypSyncRadius(){const c=window.__ypListCentre;if(!ypMap||!ypMap.getSource||!ypMap.getSource('yp-search-radius'))return;if(!c){ypMap.getSource('yp-search-radius').setData(ypEmpty());return;}const ring=ypRadiusRing(c.lon,c.lat,2000);ypMap.getSource('yp-search-radius').setData({type:'FeatureCollection',features:[{type:'Feature',properties:{kind:'search-area'},geometry:{type:'Polygon',coordinates:[ring]}}]});}
function ypShowAreaNote(text){const host=document.getElementById('map');if(!host)return;let note=document.getElementById('yp-chosen-note');if(!note){note=document.createElement('p');note.id='yp-chosen-note';note.setAttribute('role','status');host.appendChild(note);}note.textContent=text;}
function ypSyncHeader(){const el=document.getElementById('cityname');const p=window.__ypListCentre;if(!el||!p||!p.label)return;el.textContent=p.label;el.title=p.label;}
function ypIsBuildingLayer(layer){const sourceLayer=String(layer&&(layer['source-layer']||layer.sourceLayer)||'').toLowerCase();if(sourceLayer==='building')return true;if(!sourceLayer&&/^(building|building-3d)$/i.test(layer&&layer.id||''))return true;return false;}
function ypMappedBuildings(map,place){if(!map||!map.getStyle||!place)return [];const layers=((map.getStyle()||{}).layers||[]).filter(l=>['fill','fill-extrusion'].includes(l.type)&&ypIsBuildingLayer(l));if(!layers.length)return [];const records=[];const seen=new Set();for(const layer of layers){const found=[];try{if(map.queryRenderedFeatures)found.push(...(map.queryRenderedFeatures({layers:[layer.id]})||[]));}catch(e){}try{if(map.querySourceFeatures&&layer.source)found.push(...(map.querySourceFeatures(layer.source,layer['source-layer']?{sourceLayer:layer['source-layer']}:{})||[]));}catch(e){}for(const feature of found){const sig=JSON.stringify(feature&&feature.geometry&&feature.geometry.coordinates);if(seen.has(sig))continue;seen.add(sig);records.push({geometry:feature.geometry,sourceLayer:'building'});}}return ypBuildingSites(records,place);}
let ypStockHold={key:'',sig:'',tilesLoaded:false};
function ypApplyPlacePins(){const place=window.__ypListCentre;if(!place)return;const buildings=ypMappedBuildings(ypMap,place);const tilesLoaded=!!(ypMap&&typeof ypMap.areTilesLoaded==='function'&&ypMap.areTilesLoaded());const result=ypCommitAreaStock(ypReadStock(),place,buildings,{key:ypStockHold.key,sig:ypStockHold.sig,tilesLoaded});ypStockHold=result.hold||ypStockHold;if(result.changed){try{ypWriteStock(result.store);}catch(e){}}else if(!result.committed&&!buildings.length){try{ypWriteStock(ypEnsureSuburbStock(ypReadStock(),place,[]));}catch(e){}}ypSyncRentalMarkers();if(result.placed)document.getElementById('yp-chosen-note')?.remove();else if(!buildings.length)ypShowAreaNote('No mapped buildings were available inside this 2 km area, so no sample pins were placed. Sample pins are not real vacancies.');}
let ypNameToken=0;
async function ypResolveSearchName(lon,lat,token){const key=ypGeoKey||window.ypGeoKey||'';if(!key)return;try{const url=new URL('https://api.geoapify.com/v1/geocode/reverse');url.search=new URLSearchParams({lat:String(lat),lon:String(lon),type:'locality',format:'json',limit:'1',apiKey:key});const response=await fetch(url.href,{...YP_MAP_REQUEST});if(!response.ok||token!==ypNameToken)return;const data=await response.json();const p=(data.results||[])[0];const name=p&&(p.suburb||p.district||p.city||p.name);if(!name||token!==ypNameToken)return;const label=[name,p.state,p.country].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');const locality=ypVerifiedLocality({result_type:p.suburb?'suburb':p.district?'district':p.city?'city':'city',name});const c=window.__ypListCentre;if(!c||Math.abs(+c.lon-lon)>0.0002||Math.abs(+c.lat-lat)>0.0002)return;c.label=label;if(locality)c.locality=locality;window.__ypListCentre=c;const keyName=ypSuburbKey(c.stockKey||c.label);const store=ypReadStock();store.rentals.forEach(r=>{if(r.suburbKey===keyName){r.placeLabel=label;if(locality)r.locality=locality;}});ypWriteStock(store);ypSaveCentre();ypSyncHeader();}catch(e){}}
function ypSearchArea(){
 if(!ypMap||typeof ypMap.getCenter!=='function'){ypShowAreaNote('The map is not ready, so Search Area did not move the 2 km centre.');return;}
 let raw;try{raw=ypMap.getCenter();}catch(e){ypShowAreaNote('The map centre could not be read, so Search Area did not move the 2 km centre.');return;}
 const lon=+Number(raw.lng).toFixed(4),lat=+Number(raw.lat).toFixed(4);
 if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>90){ypShowAreaNote('The map centre is not usable, so Search Area did not move the 2 km centre.');return;}
 const town=window.__ypPlace;
 const keep=!!(town&&Number.isFinite(+town.lon)&&Number.isFinite(+town.lat)&&ypDistanceM(+town.lon,+town.lat,lon,lat)<=80);
 const fallback='Searched area '+lon.toFixed(4)+', '+lat.toFixed(4);
 const label=keep?(town.label||'Chosen place'):fallback;
 const centreLon=keep?+town.lon:lon,centreLat=keep?+town.lat:lat;
 const stockKey=keep?(town.label||'Chosen place'):fallback;
 const locality=keep?ypVerifiedLocality(town):'';
 window.__ypListCentre={label,lon:centreLon,lat:centreLat,stockKey};if(locality)window.__ypListCentre.locality=locality;
 ypSaveCentre();
 ypSyncHeader();
 ypApplyPlacePins();
 ypSyncRadius();
 if(!keep){const token=++ypNameToken;ypResolveSearchName(centreLon,centreLat,token);}
}
function ypMountSearchArea(){if(document.getElementById('yp-search-area'))return;const host=document.getElementById('map');if(!host)return;const b=document.createElement('button');b.type='button';b.id='yp-search-area';b.textContent='Search Area';const run=e=>{if(e)e.preventDefault();ypSearchArea();};b.addEventListener('click',run);b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();ypSearchArea();}});host.appendChild(b);}
function ypRenderRentalList(){let panel=document.getElementById('yp-rent-list');if(!panel){panel=document.createElement('div');panel.id='yp-rent-list';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Available rentals');document.body.appendChild(panel);}const card=document.createElement('div');card.className='card';const centre=window.__ypListCentre;const result=ypRadiusList(ypReadStock(),centre);const page=ypPage(result.items,window.__ypListPage||1,20);const head=document.createElement('div');head.className='hwh';const h=document.createElement('h2');h.textContent='Available rentals';head.appendChild(h);const note=document.createElement('p');note.textContent=result.status!=='ready'?'Choose a town or suburb first. The rental list stays empty until that place has a map centre.':result.items.length?result.items.length+' sample pins sit on mapped buildings inside the 2 km area around '+centre.label+'. They are not real vacancies.':'No mapped buildings were available inside this 2 km area around '+centre.label+', so no sample pins were placed. Sample pins are not real vacancies.';card.append(head,note);page.items.forEach(r=>{const btn=document.createElement('button');btn.type='button';btn.className='yp-rent-row';btn.dataset.id=r.id;const d=ypRentalDetail(r);const rt=document.createElement('span');rt.className='yp-row-title';rt.textContent=d.title;const rm=document.createElement('span');rm.className='yp-row-meta';rm.textContent=d.place;const rp=document.createElement('span');rp.className='yp-row-price';const rentText=ypMoneyText(d.weeklyRent);if(rentText)rp.textContent=rentText+' a week';btn.append(rt,rm,rp);btn.addEventListener('click',()=>ypOpenRentalDetail(r.id));card.appendChild(btn);});if(page.pages>1){const prev=document.createElement('button');prev.type='button';prev.id='yp-rent-prev';prev.className='hwx';prev.textContent='Previous';prev.disabled=page.page<=1;const next=document.createElement('button');next.type='button';next.id='yp-rent-next';next.className='hwx';next.textContent='Next';next.disabled=page.page>=page.pages;prev.addEventListener('click',()=>{window.__ypListPage=page.page-1;ypRenderRentalList();});next.addEventListener('click',()=>{window.__ypListPage=page.page+1;ypRenderRentalList();});card.append(prev,next);}const back=document.createElement('button');back.type='button';back.className='hwx';back.id='yp-rent-list-back';back.textContent='Back to map';back.addEventListener('click',()=>panel.remove());card.appendChild(back);panel.replaceChildren(card);}
function ypFactIcon(){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.8');path.setAttribute('stroke-linecap','round');path.setAttribute('d','M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5v9M9.2 9.2c.6-.8 1.6-1.2 2.8-1.2 1.7 0 2.8.9 2.8 2.2 0 1.2-.8 1.9-2.6 2.3l-2.2.5c-1.8.4-2.6 1.1-2.6 2.3 0 1.3 1.1 2.2 2.8 2.2 1.2 0 2.2-.4 2.8-1.2');svg.appendChild(path);return svg;}
function ypMountListing(card,model){model=model||{};card.classList.add('card','yp-listing');card.replaceChildren();const head=document.createElement('div');head.className='hwh';const kicker=document.createElement('p');kicker.className='yp-kicker';kicker.textContent=model.kicker||'Game sample property';const h=document.createElement('h2');h.id='yp-listing-title';h.textContent=model.title||'Sample property';head.append(kicker,h);card.appendChild(head);const money=model.money||[];const primary=money.find(item=>item.primary);const rest=money.filter(item=>item!==primary);if(primary){const price=document.createElement('p');price.className='yp-price';const amt=document.createElement('span');amt.className='yp-amt';amt.textContent=primary.amount;const per=document.createElement('span');per.className='yp-per';per.textContent=' '+primary.label;price.append(amt,per);card.appendChild(price);}if(model.place){const place=document.createElement('p');place.className='yp-place';place.textContent=model.place;card.appendChild(place);}if(rest.length){const dl=document.createElement('dl');dl.className='yp-facts';rest.forEach(item=>{const row=document.createElement('div');row.appendChild(ypFactIcon());const dt=document.createElement('dt');dt.textContent=item.label;const dd=document.createElement('dd');dd.textContent=item.amount;row.append(dt,dd);dl.appendChild(row);});card.appendChild(dl);}if(model.flow&&model.flow.length){const flow=document.createElement('dl');flow.className='yp-flow';model.flow.forEach(item=>{const row=document.createElement('div');const dt=document.createElement('dt');dt.textContent=item.label;if(item.hint){const hint=document.createElement('span');hint.className='yp-hint';hint.textContent=item.hint;dt.appendChild(hint);}const dd=document.createElement('dd');dd.textContent=ypMoneyText(item.amount);if(+item.amount<0)dd.className='yp-neg';row.append(dt,dd);flow.appendChild(row);});card.appendChild(flow);}if(model.status){const status=document.createElement('p');status.className='yp-status';status.textContent=model.status;card.appendChild(status);}if(model.limitation){const limit=document.createElement('p');limit.className='yp-limit';limit.textContent=model.limitation;card.appendChild(limit);}if(model.fixtureNote){const note=document.createElement('p');note.className='yp-fixture';note.textContent=model.fixtureNote;card.appendChild(note);}if(model.history&&model.history.length){const h=document.createElement('div');h.className='yp-history';h.id='yp-property-history';const title=document.createElement('p');title.className='yp-status';title.textContent='Property History';h.appendChild(title);model.history.forEach(ev=>{const row=document.createElement('p');row.className='yp-limit';row.dataset.key=ev.key;const when=ypGameClockLabel(ev.gameMs);row.textContent=(when?when+'. ':'')+ev.text+'. Local preview record for this save, not a production title.';h.appendChild(row);});card.appendChild(h);}return card;}
let ypAppTimer=0;
const YP_HIST_KEY='yp.propertyHistory.v1';
function ypReadClock(wall){const weekMs=typeof CFG!=='undefined'&&CFG&&CFG.weekMs>0?CFG.weekMs:30000;const week=typeof G!=='undefined'&&G?G.week|0:0;const acc=typeof G!=='undefined'&&G?Math.max(0,+G.acc||0):0;const paused=!!(typeof G!=='undefined'&&G&&G.started&&!G.homeChosen&&!G.clockOn);return {week,acc,weekMs,wall:wall==null?Date.now():wall,paused};}
function ypReadHistory(){try{const o=JSON.parse(localStorage.getItem(YP_HIST_KEY)||'null');if(!o||o.version!==1||!Array.isArray(o.events))return {version:1,events:[]};return o;}catch(e){return {version:1,events:[]};}}
function ypRecordHistory(events){if(!events||!events.length)return ypReadHistory();const next=ypMergeHistory(ypReadHistory(),events);localStorage.setItem(YP_HIST_KEY,JSON.stringify(next));return next;}
function ypNotice(events){if(!events||!events.length||typeof notify!=='function'||typeof G==='undefined'||!G)return;let posted=false;events.forEach(ev=>{if(ev.kind!=='accepted'&&ev.kind!=='declined')return;const msg=ev.kind==='accepted'?'Your rental application was accepted. Open this notice to confirm. Nothing has been charged.':'Your rental application was declined. Nothing was charged.';notify('info',msg,null,true);const n=G.notifs&&G.notifs[0];if(n){n.ypRental=ev.propertyId;n.ypKind=ev.kind;}posted=true;});if(posted&&typeof save==='function')save();}
function ypSyncSample(clock){const now=clock||ypReadClock();const refreshed=ypRefreshSample(ypReadStock(),now);if(refreshed.changed)ypWriteStock(refreshed.store);if(refreshed.events&&refreshed.events.length){ypRecordHistory(refreshed.events);ypNotice(refreshed.events);}return refreshed.store;}
function ypShortText(result){const parts=[];if(result.short&&result.short.includes('bond'))parts.push('The six-week bond is '+ypMoneyText(result.bond)+' and the bank has '+ypMoneyText(result.bank)+'.');if(result.short&&result.short.includes('left'))parts.push('Left after this rent is '+ypMoneyText(result.left)+' a week.');return (parts.join(' ')||'Confirmation was not completed.')+' Nothing was charged. The other applications are unchanged.';}
function ypOpenApplyReview(id){const rental=(ypReadStock().rentals||[]).find(r=>r.id===id);if(!rental||rental.status!=='available'){ypOpenRentalDetail(id);return;}let panel=document.getElementById('yp-apply-review');if(panel)panel.remove();panel=document.createElement('div');panel.id='yp-apply-review';panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','yp-review-title');const card=document.createElement('div');card.className='card';const head=document.createElement('div');head.className='hwh';const h=document.createElement('h2');h.id='yp-review-title';h.textContent='Your Application';head.appendChild(h);card.appendChild(head);const add=(label,value)=>{const row=document.createElement('div');row.className='yp-review-row';const dt=document.createElement('span');dt.textContent=label;const dd=document.createElement('span');dd.textContent=value;row.append(dt,dd);card.appendChild(row);};const picture=ypRentPicture(rental.weeklyRent,null);add('Property',rental.n?'Sample rental '+rental.n:(rental.id||'Sample rental'));add('Location',ypReviewLocation(rental));add('Weekly rent',ypMoneyText(picture.rent)||'');add('Six-week bond',ypMoneyText(picture.bond)||'');const wait=document.createElement('h3');wait.id='yp-review-wait';wait.textContent='Waiting Period';const note=document.createElement('p');note.id='yp-review-note';note.textContent='After confirming your application, you will be notified as soon as possible of the outcome. If approved, we will move you in for free. Best of luck!';const go=document.createElement('button');go.type='button';go.className='hwb';go.id='yp-review-confirm';go.textContent='Confirm application';let sent=false;go.addEventListener('click',()=>{if(sent)return;sent=true;go.disabled=true;panel.remove();const cur=(ypReadStock().rentals||[]).find(r=>r.id===id);if(!cur||cur.status!=='available'){ypOpenRentalDetail(id);return;}ypSubmitApply(id);});const cancel=document.createElement('button');cancel.type='button';cancel.className='hwx';cancel.id='yp-review-cancel';cancel.textContent='Cancel';cancel.addEventListener('click',()=>panel.remove());card.append(wait,note,go,cancel);panel.appendChild(card);document.body.appendChild(panel);}
function ypSubmitApply(id){const clock=ypReadClock();const result=ypApplySample(ypSyncSample(clock),id,clock);if(result.ok){ypWriteStock(result.store);ypRecordHistory(result.events);}ypOpenRentalDetail(id,result.ok?'':result.reason==='already'?'This rental already has an application.':'');}
function ypSubmitCancel(id){const result=ypCancelSample(ypReadStock(),id);if(result.ok)ypWriteStock(result.store);ypOpenRentalDetail(id);}
function ypSubmitConfirm(id){const clock=ypReadClock();const player=ypReadPlayerMoney();const cash=typeof G!=='undefined'&&G?+G.cash:NaN;const week=typeof G!=='undefined'&&G?G.week|0:0;const result=ypConfirmSample(ypReadStock(),id,clock,player,cash,week);if(!result.ok){ypOpenRentalDetail(id,result.reason==='short'?ypShortText(result):result.reason==='expired'?'The test approval expired. Nothing was charged.':result.reason==='already-active'?'The bond was already paid once.':'');return;}if(typeof G!=='undefined'&&G)G.cash=result.cash;ypWriteStock(result.store);ypRecordHistory(result.events);if(typeof save==='function')save();if(typeof hud==='function')hud();ypOpenRentalDetail(id,'This tenancy is confirmed. Other pending rental applications were withdrawn. Nothing extra was charged.');}
function ypSettleSampleWeek(board){if(typeof G==='undefined'||!G)return;const result=ypChargeSampleWeek(ypReadStock(),G.week|0);if(!result.charged)return;if(board)G.cash+=board;G.cash-=result.charged;ypWriteStock(result.store);if(typeof save==='function')save();if(typeof hud==='function')hud();}
function ypOpenRentalDetail(id,note){clearInterval(ypAppTimer);const clock=ypReadClock();const rental=ypSyncSample(clock).rentals.find(r=>r.id===id);if(!rental){ypOpenMissingOffer(id);return;}const d=ypRentalDetail(rental,clock);d.listing.history=ypHistoryFor(ypReadHistory(),id);let panel=document.getElementById('yp-rent-detail');if(panel)panel.remove();panel=document.createElement('div');panel.id='yp-rent-detail';panel.dataset.ypId=id;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','yp-listing-title');const card=document.createElement('div');ypMountListing(card,d.listing);if(rental.status==='withdrawn'){const gone=document.createElement('p');gone.className='yp-status';gone.textContent='This application was withdrawn because another rental was confirmed. Nothing was charged. History is read only.';card.appendChild(gone);}if(note){const warn=document.createElement('p');warn.className='yp-status';warn.id='yp-short';warn.textContent=note;card.appendChild(warn);}if(d.listing.action&&rental.status!=='withdrawn'){const apply=document.createElement('button');apply.type='button';apply.className='hwb';apply.id='yp-rent-apply';apply.textContent=d.listing.action.label;apply.disabled=!!d.listing.action.disabled;apply.addEventListener('click',()=>{if(d.listing.action.act==='confirm')ypSubmitConfirm(id);else if(d.listing.action.act==='apply')ypOpenApplyReview(id);});card.appendChild(apply);}if(rental.status==='application-pending'||rental.status==='approved'){const cancel=document.createElement('button');cancel.type='button';cancel.className='hwx';cancel.id='yp-rent-cancel';cancel.textContent='Cancel test application';cancel.addEventListener('click',()=>ypSubmitCancel(id));card.appendChild(cancel);}const back=document.createElement('button');back.type='button';back.className='hwx';back.textContent='Back';back.addEventListener('click',()=>{clearInterval(ypAppTimer);panel.remove();});card.appendChild(back);panel.appendChild(card);document.body.appendChild(panel);if(rental.status==='application-pending'||rental.status==='approved'){ypAppTimer=setInterval(()=>{if(!document.getElementById('yp-rent-detail')){clearInterval(ypAppTimer);return;}const before=rental.status;const cur=ypSyncSample(ypReadClock()).rentals.find(r=>r.id===id);if(!cur||cur.status!==before)ypOpenRentalDetail(id);},1000);}}
function ypOpenMissingOffer(id){let panel=document.getElementById('yp-rent-detail');if(panel)panel.remove();panel=document.createElement('div');panel.id='yp-rent-detail';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Application');const card=document.createElement('div');card.className='card yp-listing';const head=document.createElement('div');head.className='hwh';const h=document.createElement('h2');h.textContent='Application';head.appendChild(h);const copy=document.createElement('p');copy.className='yp-limit';copy.textContent=id?'This application is no longer open. Nothing was charged.':'That notice does not match a current rental application.';const back=document.createElement('button');back.type='button';back.className='hwx';back.textContent='Back';back.addEventListener('click',()=>panel.remove());card.append(head,copy,back);panel.appendChild(card);document.body.appendChild(panel);}
function ypOfferStatus(status){return { 'application-pending':'Pending','approved':'Approved','active':'Tenancy confirmed','withdrawn':'Withdrawn','declined':'Declined','expired':'Expired' }[status]||status;}
function ypOpenPendingOffers(){ypSyncSample(ypReadClock());let panel=document.getElementById('yp-pending');if(panel)panel.remove();panel=document.createElement('div');panel.id='yp-pending';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Pending Offers');const card=document.createElement('div');card.className='card';const head=document.createElement('div');head.className='hwh';const h=document.createElement('h2');h.textContent='Pending Offers';head.appendChild(h);const note=document.createElement('p');note.textContent='These are your rental applications. They stay here when the map search changes. Nothing is charged until you confirm one.';card.append(head,note);const rows=ypReadStock().rentals.filter(r=>['application-pending','approved','active','withdrawn','declined','expired'].includes(r.status));if(!rows.length){const empty=document.createElement('p');empty.textContent='No rental applications yet.';card.appendChild(empty);}rows.forEach(r=>{const btn=document.createElement('button');btn.type='button';btn.className='yp-rent-row';btn.dataset.id=r.id;const t=document.createElement('span');t.className='yp-row-title';t.textContent=(r.placeLabel||r.id);const s=document.createElement('span');s.className='yp-row-meta';s.textContent=ypOfferStatus(r.status);btn.append(t,s);btn.addEventListener('click',()=>{panel.remove();ypOpenRentalDetail(r.id);});card.appendChild(btn);});const hist=document.createElement('button');hist.type='button';hist.className='hwx';hist.id='yp-open-history';hist.textContent='Property History';hist.addEventListener('click',()=>{panel.remove();ypOpenPropertyHistory();});const back=document.createElement('button');back.type='button';back.className='hwx';back.textContent='Back';back.addEventListener('click',()=>panel.remove());card.append(hist,back);panel.appendChild(card);document.body.appendChild(panel);}
function ypOpenPropertyHistory(){let panel=document.getElementById('yp-history');if(panel)panel.remove();panel=document.createElement('div');panel.id='yp-history';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Property History');const card=document.createElement('div');card.className='card';const head=document.createElement('div');head.className='hwh';const h=document.createElement('h2');h.textContent='Property History';head.appendChild(h);const note=document.createElement('p');note.textContent='Read only. Local preview records for this save. Opening a row does not charge or reopen an offer.';card.append(head,note);const events=ypMergeHistory(ypReadHistory(),[]).events;if(!events.length){const empty=document.createElement('p');empty.id='yp-history-empty';empty.textContent='No recorded rental events yet.';card.appendChild(empty);}events.forEach(ev=>{const btn=document.createElement('button');btn.type='button';btn.className='yp-rent-row';btn.dataset.key=ev.key;const t=document.createElement('span');t.className='yp-row-title';t.textContent=ev.text;const s=document.createElement('span');s.className='yp-row-meta';s.textContent=(ypReadStock().rentals.find(r=>r.id===ev.propertyId)||{}).placeLabel||ev.propertyId;const when=document.createElement('span');when.className='yp-row-price';when.textContent=ypGameClockLabel(ev.gameMs);btn.append(t,s,when);btn.addEventListener('click',()=>{panel.remove();ypOpenRentalDetail(ev.propertyId);});card.appendChild(btn);});const back=document.createElement('button');back.type='button';back.className='hwx';back.textContent='Back';back.addEventListener('click',()=>panel.remove());card.appendChild(back);panel.appendChild(card);document.body.appendChild(panel);}
function ypOpenPropertyOptions(){let panel=document.getElementById('yp-property-menu');if(panel)panel.remove();panel=document.createElement('div');panel.id='yp-property-menu';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Property');const card=document.createElement('div');card.className='card';const head=document.createElement('div');head.className='hwh';const h=document.createElement('h2');h.textContent='Property';head.appendChild(h);const owned=document.createElement('button');owned.type='button';owned.className='hwb';owned.id='yp-prop-owned';owned.textContent='Property Owned';owned.addEventListener('click',()=>{panel.remove();if(window.UI&&UI.mine)UI.mine();});const live=document.createElement('button');live.type='button';live.className='hwb';live.id='yp-prop-living';live.textContent='Living Arrangement';live.addEventListener('click',()=>{panel.remove();if(window.UI&&UI.port)UI.port();});const offers=document.createElement('button');offers.type='button';offers.className='hwb';offers.id='yp-pending-offers';offers.textContent='Pending Offers';offers.addEventListener('click',()=>{panel.remove();ypOpenPendingOffers();});const history=document.createElement('button');history.type='button';history.className='hwb';history.id='yp-property-history-open';history.textContent='Property History';history.addEventListener('click',()=>{panel.remove();ypOpenPropertyHistory();});const back=document.createElement('button');back.type='button';back.className='hwx';back.textContent='Back to map';back.addEventListener('click',()=>panel.remove());card.append(head,owned,live,offers,history,back);panel.appendChild(card);document.body.appendChild(panel);}

function ypMountSearch(){
 const box=document.getElementById('rsearch'),town=document.getElementById('rsq');
 if(!box||!town||box.dataset.ypsearch)return null;
 box.dataset.ypsearch='1';
 town.placeholder='Town, suburb or postcode';
 town.setAttribute('role','combobox');town.setAttribute('aria-autocomplete','list');town.setAttribute('aria-controls','yp-area-suggestions');town.setAttribute('aria-expanded','false');
 const extra=document.createElement('div');extra.id='yp-search-extra';
 const country=document.createElement('input');country.id='yp-country';country.maxLength=100;country.value='Australia';country.autocomplete='off';country.setAttribute('aria-label','Country');
 const street=document.createElement('input');street.id='yp-street';street.maxLength=100;street.placeholder='Street name, no house number';street.autocomplete='off';street.setAttribute('aria-label','Street name, no house number');street.setAttribute('role','combobox');street.setAttribute('aria-autocomplete','list');street.setAttribute('aria-controls','yp-street-suggestions');street.setAttribute('aria-expanded','false');
 const areaBox=document.createElement('div');areaBox.id='yp-area-suggestions';areaBox.setAttribute('role','listbox');areaBox.setAttribute('aria-label','Area suggestions');
 const streetBox=document.createElement('div');streetBox.id='yp-street-suggestions';streetBox.setAttribute('role','listbox');streetBox.setAttribute('aria-label','Street suggestions');
 const status=document.createElement('p');status.id='yp-search-status';status.setAttribute('role','status');
 const note=document.createElement('p');note.id='yp-search-note';note.textContent='After 3 characters and a short pause, the town, suburb or postcode and the street text are sent to Geoapify. Choosing a suggestion is deliberate. This is not anonymous: Geoapify receives the partial text and the connection. The map provider receives the view it loads. Searches are not saved. MapTiler supplies the basemap. A postcode on a chosen place is only that result’s attribute, not every suburb.';
 const go=document.createElement('button');go.type='button';go.id='yp-search-submit';go.textContent='Search streets';
 const attr=document.createElement('small');attr.id='yp-geo-attr';
 const a=document.createElement('a');a.href='https://www.geoapify.com/';a.target='_blank';a.rel='noopener';a.textContent='Powered by Geoapify';
 const osm=document.createElement('a');osm.href='https://www.openstreetmap.org/copyright';osm.target='_blank';osm.rel='noopener';osm.textContent='© OpenStreetMap contributors';
 attr.append(a,document.createTextNode(' · '),osm);
 extra.append(areaBox,country,street,streetBox,go,status,note,attr);
 const old=document.getElementById('rsres');
 if(old)box.insertBefore(extra,old);else box.appendChild(extra);
 return {town,country,street,areaBox,streetBox,status,go};
}

 async function ypEnterRealMap(){
 if(ypEntered)return;ypEntered=true;
 ypLoadCentre();
 ypMountChrome();
 ypPatchCamera();
 ypBindMapControls();
 let key='',geoapifyKey='';
 try{
  const response=await fetch('/runtime-config',{cache:'no-store'});
  if(!response.ok)throw Error('config');
  const body=await response.json();
  key=typeof body.key==='string'?body.key:'';
  geoapifyKey=typeof body.geoapifyKey==='string'?body.geoapifyKey:'';
 }catch{key='';geoapifyKey='';}
 ypGeoKey=geoapifyKey;
 ypHasTiles=!!key;
 ypWireWhere();
 const tiles=ypHasTiles;
 if(!tiles)ypStatusPanel('Map tiles need a key on this computer, so the basemap imagery stays empty. The old map is not used.');
 try{await ypLoadMapLibre();}catch{ypStatusPanel('The map library did not load. The old map is not used.');return;}
 if(!window.maplibregl){ypStatusPanel('The map library did not load. The old map is not used.');return;}
 ypRecord=ypReadSelection();
 const box=document.getElementById('ypbasemap');
 const blank={version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#d7e0ea'}}]};
 ypMap=new maplibregl.Map({container:box,style:tiles?'https://api.maptiler.com/maps/base-v4/style.json':blank,center:(window.__ypListCentre&&Number.isFinite(+window.__ypListCentre.lon)?[+window.__ypListCentre.lon,+window.__ypListCentre.lat]:null)||(window.__ypPlace&&window.__ypPlace.center)||ypRecord?.coordinate||YP_DEMO,zoom:(window.__ypListCentre||window.__ypPlace)?13:12,maxZoom:20,minZoom:3,maxPitch:0,renderWorldCopies:false,attributionControl:false,transformRequest(url){const u=new URL(url,location.href);if(tiles&&u.hostname==='api.maptiler.com'){u.searchParams.set('key',key);return {url:u.href};}return {url};}});
 window.__ypMap=ypMap;
 ypMap.addControl(new maplibregl.NavigationControl({showCompass:false}));
 ypMap.addControl(new maplibregl.AttributionControl({compact:false,customAttribution:tiles?'<a href="https://www.maptiler.com/copyright/">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>':'Sample pins only. Basemap tiles were not loaded.'}));
 ypMap.on('error',()=>{if(ypMapFailed)return;ypMapFailed=true;ypFoot('Map resource error (details suppressed). Check the key, allowed origins, quota or network, then reload. No buildings were invented.');});
 const applyLabels=()=>ypApplyLabelPolicy(ypMap);
 ypMap.on('style.load',applyLabels);
 ypMap.on('load',()=>{
  if(tiles)ypClearStatusPanel();
  else ypStatusPanel('Map tiles need a key on this computer, so the basemap imagery stays empty. The old map is not used. Sample pins are not buildings.');
  applyLabels();
  const layers=(ypMap.getStyle()&&ypMap.getStyle().layers)||[];
  ypBuildingLayers=layers.filter(l=>['fill','fill-extrusion'].includes(l.type)&&/building/i.test(l['source-layer']||l.id)&&!(l.layout&&l.layout.visibility==='none')).map(l=>l.id);
  ypMap.addSource('yp-highlight',{type:'geojson',data:ypEmpty()});
  const before=layers.find(l=>l.type==='symbol')?.id;
  ypMap.addLayer({id:'yp-highlight-fill',type:'fill',source:'yp-highlight',paint:{'fill-color':'#f8a51b','fill-opacity':0.6}},before);
  ypMap.addLayer({id:'yp-highlight-line',type:'line',source:'yp-highlight',paint:{'line-color':'#b65b00','line-width':3}},before);
  ypMap.addSource('yp-search-radius',{type:'geojson',data:ypEmpty()});
  ypMap.addLayer({id:'yp-search-radius-fill',type:'fill',source:'yp-search-radius',paint:{'fill-color':'#5a6780','fill-opacity':0.08}});
  ypMap.addLayer({id:'yp-search-radius-line',type:'line',source:'yp-search-radius',paint:{'line-color':'#5a6780','line-width':1.5,'line-dasharray':[2,2]}});
  ypMap.addSource('yp-rentals',{type:'geojson',data:ypEmpty(),cluster:true,clusterRadius:48,clusterMaxZoom:14});
  ypMap.addLayer({id:'yp-rental-cluster',type:'circle',source:'yp-rentals',filter:['has','point_count'],paint:{'circle-color':'#0a3a8c','circle-radius':18,'circle-opacity':.9}});
  const glyphStyle=ypMap.getStyle()||{};
  if(glyphStyle.glyphs){const sample=(glyphStyle.layers||[]).find(l=>l.layout&&l.layout['text-font']);const textFont=sample?sample.layout['text-font']:['Open Sans Regular'];ypMap.addLayer({id:'yp-rental-count',type:'symbol',source:'yp-rentals',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-size':12,'text-font':textFont},paint:{'text-color':'#fff'}});}
  ypMap.addLayer({id:'yp-rental-point',type:'circle',source:'yp-rentals',filter:['!',['has','point_count']],paint:{'circle-color':'#b8410a','circle-radius':8,'circle-stroke-width':2,'circle-stroke-color':'#fff'}});
  if(tiles&&!document.getElementById('yp-logo')){const logo=document.createElement('a');logo.id='yp-logo';logo.href='https://www.maptiler.com/';logo.target='_blank';logo.rel='noopener';const img=document.createElement('img');img.src='https://api.maptiler.com/resources/logo.svg';img.alt='MapTiler logo';logo.appendChild(img);box.appendChild(logo);}
  ypReady=true;
  ypRematch();
  ypCentreChosen();
  ypSyncHeader();
  ypApplyPlacePins();
  ypSyncRadius();
  ypSyncRentalMarkers();
  let ypPinWait=0;
  ypMap.on('idle',()=>{clearTimeout(ypPinWait);ypPinWait=setTimeout(()=>{if(window.__ypListCentre)ypApplyPlacePins();},400);});
 });
 ypMap.on('click','yp-rental-cluster',e=>{const f=e.features&&e.features[0];if(!f)return;const cid=f.properties.cluster_id;ypMap.getSource('yp-rentals').getClusterExpansionZoom(cid,(err,zoom)=>{if(!err)ypMap.easeTo({center:f.geometry.coordinates,zoom});});});
 ypMap.on('click','yp-rental-point',e=>{const f=e.features&&e.features[0];if(f&&f.properties&&f.properties.id)ypOpenRentalDetail(f.properties.id);});
 ypMap.on('moveend',()=>{if(ypReady)ypSyncRentalMarkers();});
 ypMap.on('idle',()=>{if(ypReady)ypRematch();});
 ypMap.on('click',e=>{
  if(!ypReady||!ypBuildingLayers.length)return;
  const clickAt=e.lngLat.toArray();
  const clickHits=ypAt(clickAt);
  if(!clickHits.length){ypFoot('No building at that point. Tap inside a visible building.');return;}
  const savedHits=ypRecord?ypAt(ypRecord.coordinate):[];
  const same=ypSameFootprint(savedHits,clickHits);
  const gameId=ypNextGameId(same?ypRecord.gameId:null,same);
  ypRecord={gameId,coordinate:clickAt};
  if(!ypWriteSelection(ypRecord))ypFoot('Selection works, but this browser did not store it. Reload will not restore it.');
  ypRematch();
 });
}

function ypWireSearch(ui,geoapifyKey){
 const {town,country,street,areaBox,streetBox,status,go}=ui;
 const msg=t=>{status.textContent=t;};
 let area=null,suggestionItems=[],areaItems=[],active=-1,areaActive=-1,streetTimer,areaTimer,lastRequest=0;
 const guard=pilotSuggest.gate(),areaGuard=pilotSuggest.gate();
 function closeStreet(){streetBox.replaceChildren();suggestionItems=[];active=-1;street.setAttribute('aria-expanded','false');street.removeAttribute('aria-activedescendant');}
 function cancel(){clearTimeout(streetTimer);guard.next();closeStreet();}
 function cancelArea(){clearTimeout(areaTimer);areaGuard.next();areaBox.replaceChildren();areaItems=[];areaActive=-1;town.setAttribute('aria-expanded','false');town.removeAttribute('aria-activedescendant');}
 async function request(params,signal){
  const slot=Math.max(Date.now(),lastRequest+220);lastRequest=slot;const wait=slot-Date.now();if(wait)await new Promise(r=>setTimeout(r,wait));if(signal.aborted)throw Error('aborted');
  const url=geocodeUrl(params,geoapifyKey);
  const timeout=setTimeout(()=>{if(!signal.aborted)msg('Suggestions taking too long. You can edit the fields or retry Search.');},15000);
  try{const r=await fetch(url.href,{...YP_MAP_REQUEST,signal});if(!r.ok)throw Error('bad');return await r.json();}finally{clearTimeout(timeout);}
 }
 function draw(boxEl,items,choose,input){boxEl.replaceChildren();items.forEach((item,i)=>{const b=document.createElement('button');b.type='button';b.id=boxEl.id+'-'+i;b.setAttribute('role','option');b.textContent=item.label;b.onclick=()=>choose(item);boxEl.appendChild(b);});input.setAttribute('aria-expanded',items.length?'true':'false');}
 function chooseArea(item){cancelArea();cancel();area=item;town.value=item.name||item.suburb||item.city||item.postcode||'';msg('Area chosen: '+item.label+'. Now type a street name.');scheduleStreet();}
 function chooseStreet(item){cancel();street.value=item.street;if(!ypReady||!ypMap){msg('Map is not ready; choose the street again after it loads.');return;}ypMap.jumpTo({center:item.center,zoom:17});msg('Moved to '+item.label+'. Choose a building yourself.');}
 async function loadStreet(){
  cancel();const token=guard.next();
  let params;try{params=autocompleteQuery('street',street.value,area,country.value);}catch(e){msg(e.message);return;}
  if(!geoapifyKey){msg('Search key missing. No street request was sent.');return;}
  msg('Finding streets in the chosen area…');
  try{const data=await request(params,token.signal);if(!guard.current(token.version))return;
   suggestionItems=pilotSuggest.roads(data,area);draw(streetBox,suggestionItems,chooseStreet,street);
   msg(suggestionItems.length?'Choose a full street name below.':'No verified street suggestions in this area. Try more letters; no address or place-of-interest fallback is used.');
  }catch{if(guard.current(token.version))msg('Street suggestions unavailable. Check connection or retry Search.');}
 }
 function scheduleStreet(){cancel();streetTimer=setTimeout(loadStreet,450);}
 function scheduleArea(){
  cancelArea();cancel();area=null;
  let params;try{params=autocompleteQuery('area',town.value,null,country.value);}catch(e){msg(e.message);return;}
  if(!geoapifyKey){msg('Search key missing. No area request was sent.');return;}
  const token=areaGuard.next();
  areaTimer=setTimeout(async()=>{msg('Finding towns, suburbs and postcode areas…');try{
   const data=await request(params,token.signal);if(!areaGuard.current(token.version))return;
   const postcode=/^\d{4}$/.test(town.value.trim())?town.value.trim():null;
   areaItems=pilotSuggest.areas(data,country.value.trim(),postcode);
   if(postcode)areaItems.sort((a,b)=>a.label.localeCompare(b.label));
   draw(areaBox,areaItems,chooseArea,town);
   msg(postcode?(areaItems.length?areaItems.length+' exact-postcode provider areas, alphabetically. This is not a complete suburb directory. If yours is missing, type its town or suburb name. Choose one deliberately.':'No exact-postcode provider areas. Coverage is incomplete; type a town or suburb name instead.'):(areaItems.length?'Choose an area; none is selected automatically.':'No matching area suggestions. Check spelling or country.'));
  }catch{if(areaGuard.current(token.version))msg('Area suggestions unavailable. Check connection and edit the area to retry.');}},450);
 }
 function keys(event,which){
  const items=which==='area'?areaItems:suggestionItems,boxEl=which==='area'?areaBox:streetBox,input=which==='area'?town:street;let n=which==='area'?areaActive:active;
  if(event.key==='Escape'){event.preventDefault();which==='area'?cancelArea():cancel();return;}
  if(['ArrowDown','ArrowUp'].includes(event.key)&&items.length){event.preventDefault();n=n<0?(event.key==='ArrowDown'?0:items.length-1):(n+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;Array.from(boxEl.children).forEach((b,i)=>b.setAttribute('aria-selected',String(i===n)));input.setAttribute('aria-activedescendant',boxEl.children[n].id);if(which==='area')areaActive=n;else active=n;}
  if(event.key==='Enter'&&items.length){event.preventDefault();if(n<0){msg('Use arrow keys or click to choose a suggestion.');return;}which==='area'?chooseArea(items[n]):chooseStreet(items[n]);}
 }
 town.addEventListener('input',e=>{e.stopImmediatePropagation();scheduleArea();},true);
 town.addEventListener('keydown',e=>{e.stopImmediatePropagation();keys(e,'area');},true);
 town.addEventListener('focus',e=>e.stopImmediatePropagation(),true);
 town.addEventListener('blur',e=>e.stopImmediatePropagation(),true);
 country.addEventListener('input',scheduleArea);street.addEventListener('input',scheduleStreet);
 street.addEventListener('keydown',e=>keys(e,'street'));
 go.addEventListener('click',()=>{clearTimeout(streetTimer);loadStreet();});
 msg(geoapifyKey?'Choose a town, suburb or postcode area first, then type a street.':'Search key missing; no search request will be sent. Map selection still needs a map key.');
}
function ypCloseAutoOverlays(){
 const listings=document.getElementById('listings');if(listings)listings.remove();
 const hw=document.getElementById('hwov');if(hw&&window.__ypBlockAutoLists)hw.remove();
}
function ypInstallHandoff(){
 if(window.__ypHandoff)return;window.__ypHandoff=1;
 if(typeof listOpen==='function'){const orig=listOpen;window.listOpen=function(){if(window.__ypBlockAutoLists)return;return orig.apply(this,arguments);};}
 if(typeof hwSummary==='function'){const orig=hwSummary;window.hwSummary=function(){if(window.__ypBlockAutoLists)return;return orig.apply(this,arguments);};}
 if(typeof hwChoose==='function'){const orig=hwChoose;window.hwChoose=function(){if(window.__ypBlockAutoLists)return;return orig.apply(this,arguments);};}
 if(typeof statusDone==='function'){const orig=statusDone;window.statusDone=function(){const result=orig.apply(this,arguments);ypEnterRealMap();ypCloseAutoOverlays();ypShowWherePopup();return result;};}
 if(window.UI&&typeof UI.sale==='function')UI.sale=function(){ypOpenListingsChoice();};
 const saleBtn=document.querySelector('nav button[data-v="sale"]');
 if(saleBtn){
  [...saleBtn.childNodes].forEach(n=>{if(n.nodeType===3&&n.textContent.trim())n.textContent='Listings';});
  saleBtn.setAttribute('aria-label','Listings');
  saleBtn.onclick=()=>{if(typeof tab==='function')tab('sale');if(typeof picker==='function')picker(false);if(window.UI&&UI.menu)UI.menu(false);if(window.UI&&UI.el)UI.el.classList.remove('open');document.body.classList.remove('sheetopen');ypOpenListingsChoice();};
 }
 const mapBtn=document.querySelector('nav button[data-v="map"]');
 if(mapBtn)mapBtn.addEventListener('click',()=>{ypCloseAutoOverlays();document.getElementById('yp-prop')?.remove();document.documentElement.classList.add('yp-preview');});
}
function ypShowWherePopup(){
 if(document.getElementById('yp-where'))return;
 const wrap=document.createElement('div');wrap.id='yp-where';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-labelledby','yp-where-title');
 const card=document.createElement('div');card.className='card';
 const head=document.createElement('div');head.className='hwh';
 const title=document.createElement('h2');title.id='yp-where-title';title.textContent='Choose location';
 head.appendChild(title);
 const input=document.createElement('input');input.id='yp-where-town';input.maxLength=100;input.autocomplete='off';input.placeholder='enter town or suburb';input.setAttribute('aria-label','enter town or suburb');input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls','yp-where-suggestions');input.setAttribute('aria-expanded','false');
 const moveNote=document.createElement('p');moveNote.id='yp-where-move';moveNote.textContent='You can also search on the map';
 const suggestions=document.createElement('div');suggestions.id='yp-where-suggestions';suggestions.setAttribute('role','listbox');suggestions.setAttribute('aria-label','Town and suburb suggestions');
 const status=document.createElement('p');status.id='yp-where-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const close=document.createElement('button');close.type='button';close.id='yp-where-close';close.className='hwb';close.textContent='Close';
 close.addEventListener('click',ypCloseWhere);
 wrap.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();ypCloseWhere();}});
 card.append(head,input,moveNote,suggestions,status,close);
 wrap.appendChild(card);
 document.body.appendChild(wrap);
 ypWireWhere();
 input.focus();
}
function ypCloseWhere(){const el=document.getElementById('yp-where');if(el)el.remove();}
function ypWireWhere(){
 const input=document.getElementById('yp-where-town'),box=document.getElementById('yp-where-suggestions'),status=document.getElementById('yp-where-status');
 if(!input||input.dataset.wired)return;input.dataset.wired='1';
 let timer=0,items=[],active=-1;const gate=pilotSuggest.gate();
 function paint(){
  [...box.children].forEach((el,i)=>{el.classList.toggle('on',i===active);el.setAttribute('aria-selected',i===active?'true':'false');});
  if(active>=0&&box.children[active])input.setAttribute('aria-activedescendant',box.children[active].id);
  else input.removeAttribute('aria-activedescendant');
 }
 input.addEventListener('keydown',e=>{
  if((e.key==='ArrowDown'||e.key==='ArrowUp')&&items.length){e.preventDefault();active=e.key==='ArrowDown'?(active+1)%items.length:(active-1+items.length)%items.length;paint();return;}
  if(e.key==='Enter'&&active>=0&&items[active]){e.preventDefault();ypChooseTown(items[active]);}
 });
 input.addEventListener('input',()=>{clearTimeout(timer);gate.next();box.replaceChildren();items=[];active=-1;input.setAttribute('aria-expanded','false');paint();
  const text=input.value.trim();
  let params;try{params=autocompleteQuery('area',text,null,'Australia');}catch(e){status.textContent=e.message;return;}
  const key=ypGeoKey||window.ypGeoKey||'';
  if(!key){status.textContent='Search key missing. No town request was sent. Close leaves the map as it is. The old map stays hidden.';return;}
  const token=gate.next();
  timer=setTimeout(async()=>{status.textContent='Finding towns and suburbs…';try{
   const url=geocodeUrl(params,key);
   const response=await fetch(url.href,{...YP_MAP_REQUEST,signal:token.signal});
   if(!response.ok||!gate.current(token.version))throw Error('bad');
   items=pilotSuggest.areas(await response.json(),'Australia',/^\d{4}$/.test(text)?text:null);
   if(!gate.current(token.version))return;
   box.replaceChildren();
   items.forEach((item,i)=>{const b=document.createElement('button');b.type='button';b.id='yp-where-opt-'+i;b.setAttribute('role','option');b.textContent=item.label;b.addEventListener('pointerdown',()=>b.classList.add('press'));const up=()=>b.classList.remove('press');b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('pointerleave',up);b.addEventListener('click',()=>ypChooseTown(item));box.appendChild(b);});
   input.setAttribute('aria-expanded',items.length?'true':'false');
   paint();
   status.textContent=items.length?'':'No matching suggestion. Nothing was invented.';
  }catch{if(gate.current(token.version))status.textContent='Town suggestions are unavailable. The old map was not opened.';}},450);
 });
}
function ypCentreChosen(){
 const p=window.__ypListCentre||window.__ypPlace;
 if(!p||!ypMap||!Number.isFinite(+p.lon)||!Number.isFinite(+p.lat))return false;
 try{ypMap.jumpTo({center:[+p.lon,+p.lat],zoom:13});return true;}catch(e){return false;}
}
function ypShowChosen(label,moved){
 const host=document.getElementById('map');if(!host)return;
 let note=document.getElementById('yp-chosen-note');
 if(!note){note=document.createElement('p');note.id='yp-chosen-note';note.setAttribute('role','status');host.appendChild(note);}
 note.textContent=moved?(ypHasTiles?'Selected: '+label+'.':'Selected: '+label+'. Map tiles are not loaded, so the picture stays empty. The 2 km area is set.'):'Selected: '+label+'. The 2 km area is set. The map will move here when it is ready.';
}
function ypChooseTown(item){
 const lon=Number(item&&item.lon),lat=Number(item&&item.lat);
 if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>90){const status=document.getElementById('yp-where-status');if(status)status.textContent='That suggestion has no map centre, so it was not selected. Choose another suggestion.';return;}
 const label=item.label||item.name||'Chosen place';
 const locality=ypVerifiedLocality(item);
 window.__ypPlace={label,lon,lat,center:[lon,lat]};if(locality)window.__ypPlace.locality=locality;
 window.__ypListCentre={label,lon,lat,stockKey:label};if(locality)window.__ypListCentre.locality=locality;
 ypSaveCentre();
 ypSyncHeader();
 ypCloseWhere();
 ypMountSearchArea();
 ypCentreChosen();
 ypApplyPlacePins();
 ypSyncRadius();
}
function ypPlaceLine(){
 const p=window.__ypListCentre;
 return p&&Number.isFinite(p.lon)&&Number.isFinite(p.lat)?'Search area: 2 km around '+p.label+'. Moving the map does not move it.':'Choose a town or suburb first.';
}
function ypOpenListingsChoice(){
 ypCloseWhere();
 document.getElementById('yp-rent-list')?.remove();
 document.getElementById('yp-rent-detail')?.remove();
 let panel=document.getElementById('yp-prop');if(panel)panel.remove();
 panel=document.createElement('div');panel.id='yp-prop';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Listings');
 const card=document.createElement('div');card.className='card';
 const head=document.createElement('div');head.className='hwh';
 const title=document.createElement('h2');title.textContent='Listings';head.appendChild(title);
 const copy=document.createElement('p');copy.textContent='Choose a category. For Rent lists sample pins inside the 2 km search area. For Sale, Room Share, and Auctions have no stock in this preview.';
 const rent=document.createElement('button');rent.type='button';rent.id='yp-cat-rent';rent.className='hwb';rent.textContent='For Rent';
 const sale=document.createElement('button');sale.type='button';sale.id='yp-cat-sale';sale.className='hwb';sale.textContent='For Sale';
 const room=document.createElement('button');room.type='button';room.id='yp-cat-room';room.className='hwb';room.textContent='Room Share';
 const auction=document.createElement('button');auction.type='button';auction.id='yp-cat-auction';auction.className='hwb';auction.textContent='Auctions';
 const back=document.createElement('button');back.type='button';back.id='yp-prop-back';back.className='hwx';back.textContent='Back to map';
 rent.addEventListener('click',()=>{panel.remove();ypOpenSelectedList();});
 sale.addEventListener('click',()=>ypShowEmptyCategory('sale'));
 room.addEventListener('click',()=>ypShowEmptyCategory('room'));
 auction.addEventListener('click',()=>ypShowEmptyCategory('auction'));
 back.addEventListener('click',()=>panel.remove());
 card.append(head,copy,sale,rent,room,auction,back);panel.appendChild(card);document.body.appendChild(panel);
}
function ypShowEmptyCategory(kind){
 const panel=document.getElementById('yp-prop');if(!panel)return;
 const titles={sale:'For Sale',room:'Room Share',auction:'Auctions'};
 const empty={sale:'For Sale has no listings in this preview. No sale price or sale flow was added.',room:'Room Share has no listings in this preview. No share matching or price was added.',auction:'Auctions has no listings in this preview. No auction flow was added.'};
 const card=panel.querySelector('.card');
 card.replaceChildren();
 const head=document.createElement('div');head.className='hwh';
 const title=document.createElement('h2');title.textContent=titles[kind];head.appendChild(title);
 const copy=document.createElement('p');copy.id='yp-prop-note';copy.textContent=ypPlaceLine()+' '+empty[kind];
 const back=document.createElement('button');back.type='button';back.id='yp-cat-back';back.className='hwx';back.textContent='Back';
 back.addEventListener('click',ypOpenListingsChoice);
 card.append(head,copy,back);
}
if(typeof weekTick==='function'&&!weekTick.__ypRent){const origWeek=weekTick;const wrapped=function(){const board=typeof G!=='undefined'&&G&&G.clockOn&&!G.homeChosen&&!(G.lease&&G.lease.id)&&typeof NOHOME_BOARD==='number'?NOHOME_BOARD:0;const out=origWeek.apply(this,arguments);try{ypSettleSampleWeek(board);}catch(e){}return out;};wrapped.__ypRent=1;weekTick=wrapped;}
if(typeof openNotif==='function'&&!openNotif.__yp){const origNotif=openNotif;const wrappedNotif=function(i){const n=G.notifs&&G.notifs[i];if(n&&n.ypRental){n.read=true;if(typeof save==='function')save();if(typeof badge==='function')badge();const other=document.getElementById('yp-where')||document.getElementById('yp-prop');if(!other)ypOpenRentalDetail(n.ypRental);return;}return origNotif.apply(this,arguments);};wrappedNotif.__yp=1;openNotif=wrappedNotif;}
const ypMineBtn=document.getElementById('minebtn');if(ypMineBtn){ypMineBtn.onclick=()=>{if(typeof tab==='function')tab('mine');if(typeof picker==='function')picker(false);if(window.UI&&UI.menu)UI.menu(false);if(window.UI&&UI.el)UI.el.classList.remove('open');document.body.classList.remove('sheetopen');ypOpenPropertyOptions();};}
window.ypChooseTown=ypChooseTown;
window.ypSearchArea=ypSearchArea;
window.ypEnterRealMap=ypEnterRealMap;
window.ypDistanceM=ypDistanceM;
window.ypDestination=ypDestination;
window.ypOpenRentalDetail=ypOpenRentalDetail;
