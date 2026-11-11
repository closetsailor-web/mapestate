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
function ypRadiusRing(lon,lat,distanceM){const ring=[];for(let i=0;i<=64;i++){const p=ypDestination(lon,lat,i/64*360,distanceM);ring.push([p.lon,p.lat]);}return ring;}
function ypStockId(suburbKey,n){return 'preview:'+suburbKey+':'+n;}
function ypFreshStock(){return {version:1,rentals:[]};}
/* Only buildings in our Overture list (a ypb game id, which always has a permanent code) can be listed, shown or applied for. */
function ypHasCode(r){return !!r&&String(r.footprintId||'').startsWith('ypb-');}
function ypEnsureSuburbStock(store,place,buildings){
 const next={version:1,rentals:(store&&Array.isArray(store.rentals)?store.rentals:[]).map(r=>({...r}))};
 const key=ypSuburbKey(place&&(place.stockKey||place.label));
 if(!key||!place||!Number.isFinite(+place.lon)||!Number.isFinite(+place.lat))return next;
 if(!Array.isArray(buildings))return next;
 const seen=new Set(),picks=[];
 for(const b of buildings){
  const lon=Number(b&&b.lon),lat=Number(b&&b.lat);
  if(!Number.isFinite(lon)||!Number.isFinite(lat)||!ypHasCode(b))continue;
  if(ypDistanceM(+place.lon,+place.lat,lon,lat)>2000)continue;
  const sig=String(b.footprintId);
  if(seen.has(sig))continue;
  seen.add(sig);
  picks.push({lon:+lon.toFixed(6),lat:+lat.toFixed(6),footprintId:sig,geometry:b.geometry||null});
 }
 picks.sort((a,b)=>a.lon-b.lon||a.lat-b.lat);
 const chosen=picks.slice(0,10);
 const old=next.rentals.filter(r=>r.suburbKey===key);
 next.rentals=next.rentals.filter(r=>r.suburbKey!==key);
 chosen.forEach((pin,i)=>{
  const n=i+1,id=ypStockId(key,n),prev=old.find(r=>r.id===id),weekly=ypPreviewWeeklyRent(id);
  const keep=prev&&['application-pending','approved','active','expired','withdrawn','cancelled','declined'].includes(prev.status)?prev.status:'available';
  const row={id,suburbKey:key,placeLabel:String(place.label),placement:'footprint',radiusM:2000,centreLon:+place.lon,centreLat:+place.lat,n,lon:pin.lon,lat:pin.lat,weeklyRent:weekly,bond:weekly*4,kind:'game-starter',status:keep,footprintId:pin.footprintId};if(pin.geometry)row.geometry=JSON.parse(JSON.stringify(pin.geometry));const locality=ypVerifiedLocality(place)||(prev&&ypVerifiedLocality({locality:prev.locality}));if(locality)row.locality=locality;
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
 const items=(store&&store.rentals||[]).filter(r=>r.suburbKey===key&&ypHasCode(r)&&Number.isFinite(r.lon)&&Number.isFinite(r.lat)&&ypDistanceM(+centre.lon,+centre.lat,r.lon,r.lat)<=2000);
 items.sort((a,b)=>a.n-b.n);
 return {status:'ready',items};
}
function ypPage(items,page,size){size=size||20;const pages=Math.max(1,Math.ceil((items||[]).length/size));const p=Math.min(Math.max(1,page|0),pages);return {page:p,pages,items:(items||[]).slice((p-1)*size,p*size)};}
function ypInView(rental,bounds){if(!bounds)return true;return rental.lon>=bounds.west&&rental.lon<=bounds.east&&rental.lat>=bounds.south&&rental.lat<=bounds.north;}
function ypMoneyText(amount){const n=Math.round(Number(amount));if(!Number.isFinite(n))return '';const grouped=String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g,',');return (n<0?'-$':'$')+grouped;}
function ypRentPicture(weeklyRent,player){const num=v=>v==null||v===''?null:(Number.isFinite(+v)?+v:null);const rent=num(weeklyRent);const income=num(player&&player.incomeWk);const expenses=num(player&&player.expenseWk);const bank=num(player&&player.bank);const rentWk=rent==null?null:Math.round(rent);const incomeWk=income==null?null:Math.round(income);const expenseWk=expenses==null?null:Math.round(expenses);const bond=rentWk==null?null:rentWk*4;const advance=rentWk==null?null:rentWk*2;const upfront=rentWk==null?null:rentWk*6;const left=incomeWk==null||expenseWk==null||rentWk==null?null:incomeWk-expenseWk-rentWk;const bankWk=bank==null?null:Math.round(bank);return {rent:rentWk,bond,advance,upfront,income:incomeWk,expenses:expenseWk,left,bank:bankWk,afterBond:bankWk==null||upfront==null?null:bankWk-upfront};}
function ypListingModel(input){input=input||{};const kind=input.kind||'rent';const titles={rent:'Sample rental',sale:'Sample for sale',auction:'Sample auction',roomshare:'Sample room share'};const title=(titles[kind]||'Sample property')+(input.n?' '+input.n:'');const money=[];const add=(label,amount,primary)=>{const text=ypMoneyText(amount);if(text)money.push({label,amount:text,value:Math.round(Number(amount)),primary:!!primary});};const picture=kind==='rent'?ypRentPicture(input.weeklyRent,input.player):null;if(kind==='rent'){add('Weekly rent',input.weeklyRent,true);if(picture&&picture.bond!=null)add('Four-week bond',picture.bond,false);if(picture&&picture.advance!=null)add('Two weeks rent in advance',picture.advance,false);}else if(kind==='sale')add('Asking price',input.price,true);else if(kind==='auction')add('Current bid',input.bid,true);else if(kind==='roomshare')add('Weekly room share',input.share,true);const flow=[];if(picture&&picture.income!=null){flow.push({label:'Weekly income',amount:picture.income,hint:'Take-home pay'});flow.push({label:'Weekly expenses',amount:picture.expenses,hint:'Living costs before this rent'});flow.push({label:'Left after this rent',amount:picture.left,hint:'Income minus expenses minus this rent'});}if(picture&&picture.bank!=null)flow.push({label:'In the bank',amount:picture.bank,hint:'Your balance now'});if(picture&&picture.afterBond!=null&&input.status!=='active')flow.push({label:'Bank after move-in costs',amount:picture.afterBond,hint:'After the bond and two weeks rent in advance'});const st=input.appStatus||input.status||'available';const owner=input.owner==='player'?'player':'game';const limits={rent:'Game sample. Not a real vacancy. Apply does not charge you. The four-week bond and two weeks rent in advance are paid when you are approved.',sale:'Game sample. Not a real listing. Buying is not available, and nothing is charged.',auction:'Game sample. Not a real auction. Bidding is not available, and nothing is charged.',roomshare:'Game sample. Not a real room share. Sharing is not available, and nothing is charged.'};let action=kind==='rent'&&!input.fixture?{label:'Apply to rent',disabled:false,act:'apply'}:null;let statusText='';let limitation=limits[kind]||limits.rent;if(kind==='rent'&&!input.fixture&&st==='expired'){action=null;statusText='The test approval expired. Nothing was charged.';}else if(kind==='rent'&&!input.fixture&&st==='application-pending'){action={label:owner==='player'?'Waiting for the owner':'Test approval pending',disabled:true,act:'pending'};limitation=owner==='player'?'Waiting for the owner. This test does not decide for them. Nothing is charged.':'Test application pending. Nothing is charged. A game-provided rental is accepted after 1 game hour. That hour still passes while you are choosing a home.';if(owner!=='player'&&input.hoursLeft!=null){const shown=input.hoursLeft<=1?1:Math.ceil(input.hoursLeft-1e-6);statusText=(shown===1?'About 1 game hour left.':'About '+shown+' game hours left.')+' Nothing is charged.';}}else if(kind==='rent'&&!input.fixture&&st==='approved'){action=null;statusText='Your application was accepted. The four-week bond and two weeks rent in advance are paid automatically when you have enough in the bank.';limitation='The four-week bond and two weeks rent in advance are paid when the application is accepted. Weekly rent starts from the third game week.';}else if(kind==='rent'&&!input.fixture&&st==='active'){action=null;statusText='';limitation='';}if(kind==='rent'&&(st==='declined'||st==='withdrawn')){action=null;if(!statusText)statusText=st==='declined'?'This application was declined. Nothing was charged.':'This application was withdrawn. Nothing was charged.';}const approval=(kind==='rent'&&!input.fixture&&(st==='approved'||st==='active'))?'Your application has been approved.':'';return {kind,title,place:input.place||'',money,flow,kicker:'Game sample property',approval,status:statusText,limitation,action,fixture:!!input.fixture,fixtureNote:input.fixture?'Fixture only. Not a live record.':''};}
function ypReadPlayerMoney(){let incomeWk=null,expenseWk=null,bank=null;try{if(typeof salaryNetWk==='function')incomeWk=salaryNetWk();if(typeof INC==='function'){const inc=INC()||{};expenseWk=(typeof GAME_EXP_MO!=='undefined'?GAME_EXP_MO:((+inc.exp||0)+(+inc.debt||0)))*12/52;}if(typeof G!=='undefined'&&G&&Number.isFinite(+G.cash))bank=+G.cash;}catch(e){}return {incomeWk,expenseWk,bank};}
function ypRentalDetail(r,clock){const player=ypReadPlayerMoney();const wall=clock&&clock.wall!=null?clock.wall:null;const hour=clock?ypHourMs(clock):null;const gameLeft=r&&r.approveGameMs!=null&&hour?(r.approveGameMs-ypGameMs(clock))/hour:null;const wallLeft=r&&r.approveAt!=null&&hour&&clock&&clock.wall!=null?(r.approveAt-clock.wall)/hour:null;const hoursLeft=r&&r.status==='application-pending'&&(gameLeft!=null||wallLeft!=null)?Math.max(0,Math.min.apply(null,[gameLeft,wallLeft].filter(v=>v!=null))):null;const secondsLeft=r&&r.status==='approved'&&r.expiresAt!=null&&wall!=null?Math.max(0,Math.ceil((r.expiresAt-wall)/1000)):null;const suburb=ypDisplaySuburb(r);const listing=ypListingModel({kind:'rent',n:r.n,place:suburb,weeklyRent:r.weeklyRent,status:r.status,owner:r.owner,hoursLeft,secondsLeft,paused:!!(clock&&clock.paused),player});const pin=r.footprintId?('This rental is building '+r.footprintId+'. The house itself is marked on the map. It is not a real vacancy, occupant, or landlord.'):'Sample pin on a mapped building inside the 2 km search area around '+r.placeLabel+'. The circle stays on that centre when the map moves. It is not a real vacancy, occupant, or landlord.';return {id:r.id,title:listing.title,place:suburb,weeklyRent:r.weeklyRent,bond:r.weeklyRent*4,placement:r.placement||'mapped-building',footprintId:r.footprintId||'',pin,ongoing:'Not calculated. This is not a measured building, so insurance and rates are not applied.',availability:listing.limitation,kind:r.kind,applyNote:'Apply records a preview application only. It does not charge your game balance and does not start a tenancy.',listing};}
function ypApplyPreview(store,id){return {version:1,rentals:(store&&store.rentals||[]).map(r=>r.id===id&&r.status==='available'?{...r,status:'application-pending'}:{...r})};}
const YP_GAME_HOURS_PER_WEEK=168;
function ypWeekMs(clock){const n=Number(clock&&clock.weekMs);return n>0?n:(typeof CFG!=='undefined'&&CFG&&CFG.weekMs>0?CFG.weekMs:YP_WEEK_MS);}
function ypGameMs(clock){if(!clock||typeof clock==='number')return 0;return (clock.week|0)*ypWeekMs(clock)+Math.max(0,+clock.acc||0);}
function ypHourMs(clock){return ypWeekMs(clock)/YP_GAME_HOURS_PER_WEEK;}
function ypCloneStore(store){return {version:1,rentals:(store&&store.rentals||[]).map(r=>({...r}))};}
function ypEventWall(ev){if(!ev)return NaN;if(Number.isFinite(+ev.at)&&ev.at!==null)return +ev.at;return typeof ypWallAt==='function'?ypWallAt(ev.gameMs):NaN;}
function ypEventClockLabel(ev){return typeof ypRealClockLabel==='function'?ypRealClockLabel(ypEventWall(ev)):'';}
function ypHistoryEvent(id,kind,gameMs,reason,at){if(!id||!Number.isFinite(+gameMs))return null;const text={applied:'Applied for Rental',accepted:'Accepted',declined:'Declined',withdrawn:'Withdrawn after another tenancy was confirmed',expired:'Expired',confirmed:'Tenancy confirmed',cancelled:'Cancelled'}[kind];if(!text)return null;const ev={key:id+'|'+kind+'|'+gameMs,propertyId:id,kind,gameMs:+gameMs,text};if(reason)ev.reason=reason;if(at!=null&&Number.isFinite(+at))ev.at=+at;return ev;}
function ypMergeHistory(log,events){const eventsIn=Array.isArray(log&&log.events)?log.events.map(e=>({...e})):[];const seen=new Set(eventsIn.map(e=>e.key));(events||[]).forEach(e=>{if(!e||!e.key||seen.has(e.key)||!Number.isFinite(+e.gameMs))return;seen.add(e.key);const row={key:e.key,propertyId:e.propertyId,kind:e.kind,gameMs:+e.gameMs,text:e.text};if(e.reason)row.reason=e.reason;if(e.at!=null&&Number.isFinite(+e.at))row.at=+e.at;eventsIn.push(row);});const atOf=e=>e.at!=null&&Number.isFinite(+e.at)?+e.at:Infinity;eventsIn.sort((a,b)=>a.gameMs-b.gameMs||(atOf(a)-atOf(b))||(a.key<b.key?-1:1));return {version:1,events:eventsIn};}
function ypHistoryFor(log,propertyId){return ypMergeHistory(log,[]).events.filter(e=>e.propertyId===propertyId);}
function ypApplySample(store,id,clock){const next=ypCloneStore(store);const r=next.rentals.find(x=>x.id===id);if(!r)return {store:next,ok:false,reason:'missing',events:[]};if(r.status==='application-pending'||r.status==='approved'||r.status==='active')return {store:next,ok:false,reason:'already',events:[]};const game=r.owner!=='player';const gameMs=ypGameMs(clock);const wall=clock&&clock.wall!=null?clock.wall:Date.now();r.status='application-pending';r.owner=game?'game':'player';r.appliedGameMs=gameMs;r.appliedAt=wall;r.bondCharged=false;delete r.expiresAt;delete r.notified;if(game){r.approveGameMs=gameMs+ypHourMs(clock);r.approveAt=wall+ypHourMs(clock);}else{delete r.approveGameMs;delete r.approveAt;}const ev=ypHistoryEvent(r.id,'applied',gameMs,null,wall);return {store:next,ok:true,reason:game?'pending-test':'pending-owner',events:ev?[ev]:[]};}
function ypReleaseHeld(rental){const held=rental&&rental.bondCharged&&Number.isFinite(+rental.bondPaid)?Math.max(0,+rental.bondPaid):0;if(!rental)return 0;rental.bondCharged=false;delete rental.bondPaid;delete rental.approveGameMs;delete rental.approveAt;delete rental.expiresAt;return held;}
function ypCancelPending(rental,gameMs,events,at){if(!rental||(rental.status!=='application-pending'&&rental.status!=='approved'))return 0;const released=ypReleaseHeld(rental);rental.status='cancelled';rental.notified='cancelled';const ev=ypHistoryEvent(rental.id,'cancelled',gameMs,'Another application was accepted',at);if(ev)events.push(ev);return released;}
function ypRentalIsDue(r,clock){if(!r||r.owner==='player')return false;if(r.status==='approved')return true;if(r.status!=='application-pending')return false;const gameNow=ypGameMs(clock);const wall=clock&&clock.wall!=null?clock.wall:0;return (r.approveGameMs!=null&&gameNow>=r.approveGameMs)||(r.approveAt!=null&&wall>=r.approveAt);}function ypRefreshSample(store,clock){const next=ypCloneStore(store);const gameNow=ypGameMs(clock);const events=[];let changed=false,released=0;if((next.rentals||[]).some(r=>r.status==='active'))(next.rentals||[]).forEach(r=>{const before=r.status;released+=ypCancelPending(r,gameNow,events,clock&&clock.wall!=null?clock.wall:Date.now());if(r.status!==before)changed=true;});return {store:next,changed,events,released};}function ypAutoActivateTenancy(store,clock){const cash=typeof G!=='undefined'&&G?+G.cash:NaN;const week=typeof G!=='undefined'&&G?G.week|0:0;const empty={store,cash,ok:false,charged:0,events:[]};if(!store)return Object.assign(empty,{reason:'missing'});if((store.rentals||[]).some(r=>r.status==='active'))return Object.assign(empty,{reason:'already-active'});const due=(store.rentals||[]).find(r=>ypRentalIsDue(r,clock));if(!due)return Object.assign(empty,{reason:'none'});const player=typeof ypReadPlayerMoney==='function'?ypReadPlayerMoney():null;return ypConfirmSample(store,due.id,clock,player,cash,week);}
function ypDeclineSample(store,id,clock){const next=ypCloneStore(store);const r=next.rentals.find(x=>x.id===id);if(!r||r.status!=='application-pending'||r.bondCharged)return {store:next,ok:false,events:[]};r.status='declined';if(r.notified==='declined')return {store:next,ok:true,events:[]};r.notified='declined';const ev=ypHistoryEvent(r.id,'declined',ypGameMs(clock),null,clock&&clock.wall!=null?clock.wall:Date.now());return {store:next,ok:true,events:ev?[ev]:[]};}
function ypCancelSample(store,id){const next=ypCloneStore(store);const r=next.rentals.find(x=>x.id===id);if(!r||(r.status!=='application-pending'&&r.status!=='approved')||r.bondCharged)return {store:next,ok:false};r.status='available';delete r.appliedGameMs;delete r.appliedAt;delete r.approveGameMs;delete r.approveAt;delete r.expiresAt;delete r.notified;return {store:next,ok:true};}
function ypConfirmSample(store,id,clock,player,cash,week){const base=ypCloneStore(store);const r=base.rentals.find(x=>x.id===id);const same={store,cash:+cash,ok:false,charged:0,events:[]};if(!r)return Object.assign(same,{reason:'missing'});if(r.status==='active'&&r.bondCharged)return Object.assign(same,{reason:'already-active'});if(!(r.status==='approved'||ypRentalIsDue(r,clock)))return Object.assign(same,{reason:r.status==='expired'?'expired':'not-due'});if(base.rentals.some(x=>x.id!==id&&x.status==='active'))return Object.assign(same,{reason:'other-active'});const picture=ypRentPicture(r.weeklyRent,player);const bond=picture.upfront;const problems=[];if(picture.left!=null&&picture.left<0)problems.push('left');if(!Number.isFinite(+cash)||+cash<bond)problems.push('bond');if(problems.length)return Object.assign(same,{reason:'short',short:problems,left:picture.left,bond,bank:+cash});const gameMs=ypGameMs(clock);const nowWall=clock&&clock.wall!=null?clock.wall:Date.now();const at=Number.isFinite(+r.approveAt)&&r.approveAt!=null&&+r.approveAt<=nowWall?+r.approveAt:nowWall;r.status='active';r.bondCharged=true;r.bondPaid=picture.bond;r.advancePaid=picture.advance;r.startWeek=week|0;r.lastChargedWeek=(week|0)+1;r.confirmedAt=at;delete r.expiresAt;const events=[];if(r.notified!=='approved'&&r.notified!=='confirmed'){r.notified='approved';const accepted=ypHistoryEvent(r.id,'accepted',gameMs,null,at);if(accepted)events.push(accepted);}r.notified='confirmed';const confirmed=ypHistoryEvent(r.id,'confirmed',gameMs,null,at);if(confirmed)events.push(confirmed);base.rentals.forEach(x=>{if(x.id!==id)ypCancelPending(x,gameMs,events,at);});return {store:base,cash:+cash-bond,ok:true,reason:'active',charged:bond,startWeek:r.startWeek,firstRentWeek:(week|0)+2,events};}
function ypChargeSampleWeek(store,week){const next=ypCloneStore(store);let charged=0;const now=week|0;next.rentals.forEach(r=>{if(r.status!=='active'||!r.bondCharged)return;const start=r.startWeek|0;const last=r.lastChargedWeek==null?start:r.lastChargedWeek|0;if(now<=last||now<=start)return;charged+=(now-last)*Math.round(+r.weeklyRent||0);r.lastChargedWeek=now;});return {store:next,charged};}
function ypOuterRings(geometry){if(!geometry||!geometry.coordinates)return [];if(geometry.type==='Polygon')return geometry.coordinates[0]?[geometry.coordinates[0]]:[];if(geometry.type==='MultiPolygon')return geometry.coordinates.map(p=>p&&p[0]).filter(Boolean);return [];}
function ypRingOpen(ring){if(!ring||ring.length<4)return [];const last=ring.length-1;if(ring[0][0]===ring[last][0]&&ring[0][1]===ring[last][1])return ring.slice(0,last);return ring.slice();}
function ypPointInRing(lon,lat,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];if(((yi>lat)!==(yj>lat))&&(lon<(xj-xi)*(lat-yi)/(yj-yi)+xi))inside=!inside;}return inside;}
function ypRingAreaM2(ring){const open=ypRingOpen(ring);if(open.length<3)return 0;const lat=open.reduce((s,p)=>s+p[1],0)/open.length;const mx=111320*Math.cos(lat*Math.PI/180),my=111320;let a=0;for(let i=0;i<open.length;i++){const p=open[i],q=open[(i+1)%open.length];a+=p[0]*mx*q[1]*my-q[0]*mx*p[1]*my;}return Math.abs(a)/2;}
function ypInteriorPoint(ring){const open=ypRingOpen(ring);if(open.length<3)return null;let lon=0,lat=0;open.forEach(p=>{lon+=p[0];lat+=p[1];});lon/=open.length;lat/=open.length;if(!ypPointInRing(lon,lat,ring))return null;return {lon,lat};}
function ypSpreadRow(p){const row={lon:+Number(p.lon).toFixed(6),lat:+Number(p.lat).toFixed(6)};if(p.footprintId){row.footprintId=String(p.footprintId);if(p.geometry)row.geometry=p.geometry;}return row;}
function ypSpreadSites(points,limit){limit=limit||10;const seen=new Set(),uniq=[];for(const p of points||[]){const lon=+Number(p&&p.lon).toFixed(6),lat=+Number(p&&p.lat).toFixed(6);if(!Number.isFinite(lon)||!Number.isFinite(lat))continue;const sig=p&&p.footprintId?String(p.footprintId):(lon.toFixed(5)+','+lat.toFixed(5));if(seen.has(sig))continue;seen.add(sig);const site={lon,lat,d:Number.isFinite(+p.d)?+p.d:0};if(p.footprintId){site.footprintId=String(p.footprintId);if(p.geometry)site.geometry=p.geometry;}uniq.push(site);}if(uniq.length<=limit){uniq.sort((a,b)=>a.lon-b.lon||a.lat-b.lat);return uniq.map(ypSpreadRow);}const left=uniq.slice().sort((a,b)=>b.d-a.d||a.lon-b.lon||a.lat-b.lat);const chosen=[left.shift()];while(chosen.length<limit&&left.length){let best=0,bestScore=-1;for(let i=0;i<left.length;i++){let minD=Infinity;for(const c of chosen){const dist=ypDistanceM(left[i].lon,left[i].lat,c.lon,c.lat);if(dist<minD)minD=dist;}const closer=minD>bestScore+0.05,tie=Math.abs(minD-bestScore)<=0.05&&(left[i].lon<left[best].lon||(left[i].lon===left[best].lon&&left[i].lat<left[best].lat));if(closer||tie){best=i;bestScore=minD;}}chosen.push(left.splice(best,1)[0]);}return chosen.map(ypSpreadRow);}
function ypBuildingSites(records,place){const out=[],seen=new Set();if(!place||!Number.isFinite(+place.lon)||!Number.isFinite(+place.lat))return [];for(const rec of records||[]){if(String(rec&&rec.sourceLayer||'').toLowerCase()!=='building')continue;for(const ring of ypOuterRings(rec.geometry)){const area=ypRingAreaM2(ring);if(!(area>=40&&area<=12000))continue;const point=ypInteriorPoint(ring);if(!point)continue;const d=ypDistanceM(+place.lon,+place.lat,point.lon,point.lat);if(d>2000)continue;const sig=point.lon.toFixed(5)+','+point.lat.toFixed(5);if(seen.has(sig))continue;seen.add(sig);out.push({lon:+point.lon.toFixed(6),lat:+point.lat.toFixed(6),d});}}return ypSpreadSites(out,10);}
function ypIsPlainLocality(name){const s=String(name||'').trim();if(!s||s.length>80)return false;if(/^searched area\b/i.test(s))return false;if(/-?\d{1,3}\.\d{3,}/.test(s))return false;return true;}
function ypVerifiedLocality(item){if(!item||typeof item!=='object')return '';const type=String(item.result_type||'');let raw='';if(type==='suburb')raw=item.name||item.suburb||'';else if(type==='district')raw=item.name||item.district||'';else if(type==='city')raw=item.name||item.city||'';else if(type==='postcode')raw=item.suburb||item.city||'';else if(item.locality)raw=item.locality;const name=String(raw||'').trim();if(!ypIsPlainLocality(name)||/^\d{4}$/.test(name))return '';return name;}
function ypSuburbText(value){let s=String(value||'').trim();if(s.includes(','))s=s.split(',')[0].trim();if(!ypIsPlainLocality(s)||/\d/.test(s))return '';if(/\b(street|st|road|rd|avenue|ave|drive|dr|court|ct|lane|ln|crescent|cres|boulevard|blvd|terrace|tce|parade|pde|close|circuit|cct|place|pl)\.?$/i.test(s))return '';return s;}
function ypSameSelection(item,rental){return !!(item&&rental&&ypSuburbKey(item.stockKey||item.label)===rental.suburbKey);}
function ypKnownSuburb(rental){const centre=typeof window!=='undefined'?window.__ypListCentre:null;const chosen=typeof window!=='undefined'?window.__ypPlace:null;const values=[];if(rental&&rental.locality)values.push(rental.locality);if(ypSameSelection(centre,rental)){if(centre.locality)values.push(centre.locality);if(centre.label)values.push(centre.label);}if(ypSameSelection(chosen,rental)){if(chosen.locality)values.push(chosen.locality);if(chosen.label)values.push(chosen.label);}if(rental&&rental.placeLabel)values.push(rental.placeLabel);for(const value of values){const name=ypSuburbText(value);if(name)return name;}return '';}
function ypDisplaySuburb(rental){return (rental&&ypOfficialSuburb(rental.footprintId||rental.id))||ypKnownSuburb(rental)||'Unknown suburb';}
function ypReviewLocation(rental){return ypDisplaySuburb(rental);}
function ypSuburbFromMap(lon,lat){if(typeof ypMap==='undefined'||!ypMap||typeof ypMap.queryRenderedFeatures!=='function'||typeof ypMap.getStyle!=='function'||!Number.isFinite(+lon)||!Number.isFinite(+lat))return '';let layers=[];try{layers=((ypMap.getStyle()||{}).layers||[]).filter(layer=>{const blob=(String(layer.id||'')+' '+String(layer['source-layer']||layer.sourceLayer||'')).toLowerCase();if(/road|street|housenumber|poi|address|building|water|park|landuse/.test(blob))return false;return /suburb|neighbourhood|neighborhood|place|locality|settlement/.test(blob);}).map(layer=>layer.id);}catch(e){return '';}if(!layers.length)return '';let features=[];try{features=ypMap.queryRenderedFeatures(undefined,{layers})||[];}catch(e){return '';}let best='',bestD=Infinity;for(const feature of features){const props=feature&&feature.properties||{};const cls=String(props.class||props.type||props.place_type||'').toLowerCase();if(/city|town|municipality|state|country/.test(cls))continue;if(cls&&!/suburb|neighbourhood|neighborhood|quarter|locality|village|hamlet/.test(cls))continue;const name=ypSuburbText(props.name_en||props['name:en']||props.name||'');if(!name)continue;const point=feature.geometry&&feature.geometry.type==='Point'?feature.geometry.coordinates:null;if(!point||!Number.isFinite(+point[0])||!Number.isFinite(+point[1]))continue;const dist=ypDistanceM(+lon,+lat,+point[0],+point[1]);if(dist<=4000&&dist<bestD){bestD=dist;best=name;}}return best;}
function ypApplySuburb(name){const suburb=ypSuburbText(name);const c=typeof window!=='undefined'?window.__ypListCentre:null;if(!suburb||!c)return;const keyName=ypSuburbKey(c.stockKey||c.label);c.locality=suburb;c.label=suburb;window.__ypListCentre=c;const store=ypReadStock();store.rentals.forEach(r=>{if(r.suburbKey===keyName){r.placeLabel=suburb;r.locality=suburb;}});ypWriteStock(store);ypSaveCentre();if(typeof ypSyncHeader==='function')ypSyncHeader();ypRefreshSuburbText();}
function ypRefreshSuburbText(){const detail=document.getElementById('yp-rent-detail');if(detail&&detail.dataset.ypId){const rental=(ypReadStock().rentals||[]).find(r=>r.id===detail.dataset.ypId);const place=detail.querySelector('.yp-place');if(place&&rental)place.textContent=ypDisplaySuburb(rental);}const review=document.getElementById('yp-apply-review');if(review&&review.dataset.ypId){const rental=(ypReadStock().rentals||[]).find(r=>r.id===review.dataset.ypId);const loc=document.getElementById('yp-review-location');if(loc&&rental)loc.textContent=ypDisplaySuburb(rental);}const history=document.getElementById('yp-history');if(history)history.querySelectorAll('.yp-rent-row').forEach(row=>{const meta=row.querySelector('.yp-row-meta');const id=String(row.dataset.key||'').split('|')[0];const rental=(ypReadStock().rentals||[]).find(r=>r.id===id);if(meta&&rental)meta.textContent=ypDisplaySuburb(rental);});if(document.getElementById('yp-rent-list')&&typeof ypRenderRentalList==='function')ypRenderRentalList();}
function ypSelectionKey(centre){if(!centre)return '';if(centre.stockKey)return 'sk:'+ypSuburbKey(centre.stockKey);if(Number.isFinite(+centre.lon)&&Number.isFinite(+centre.lat))return 'll:'+(+centre.lon).toFixed(4)+','+(+centre.lat).toFixed(4);return '';}
const ypSuburbAsked=new Set();
function ypAskSuburbOnce(lon,lat){const centre=typeof window!=='undefined'?window.__ypListCentre:null;const key=ypSelectionKey(centre)||('ll:'+(+lon).toFixed(4)+','+(+lat).toFixed(4));if(!key||ypSuburbAsked.has(key))return;const fromMap=ypSuburbFromMap(lon,lat);if(fromMap){ypSuburbAsked.add(key);ypApplySuburb(fromMap);return;}if(!(ypGeoKey||(typeof window!=='undefined'&&window.ypGeoKey)))return;ypSuburbAsked.add(key);const token=++ypNameToken;ypResolveSearchName(lon,lat,token);}
function ypEnsureSuburbName(rental){if(ypKnownSuburb(rental))return;const centre=typeof window!=='undefined'?window.__ypListCentre:null;if(!centre||!Number.isFinite(+centre.lon)||!Number.isFinite(+centre.lat))return;ypAskSuburbOnce(+centre.lon,+centre.lat);}
function ypTenancyLengthLabel(){const lease=typeof G!=='undefined'&&G?G.lease:null;let months=lease?+lease.months:NaN;if(months!==3&&months!==6&&months!==12)months=typeof G!=='undefined'&&G?+G.statusLease:NaN;if(months!==3&&months!==6&&months!==12)months=12;return months+' months';}
function ypClockAt(gameMs){const clock=ypReadClock();if(!Number.isFinite(+gameMs))return clock;const weekMs=ypWeekMs(clock);clock.week=Math.floor(+gameMs/weekMs);clock.acc=+gameMs-clock.week*weekMs;return clock;}
// END TESTABLE STOCK

/* Preview map adapter. Runs in the game page after the existing scripts. It does not change intro copy, finance, or c1 lot records. */
const YP_LIMIT='This highlight is one basemap footprint only. It is not a Your Plot lot, it has no game owner, and it has no game price. The saved id is a new UUID plus the click coordinate, not a vendor id and not a stable property identity.';
const YP_GAMELOT='This listing is an existing Coralwood game record. It is not a building on the basemap, so the camera was not moved and no real owner or price was created.';
const YP_STORE='yp.mapsel.v1';
const YP_DEMO=[152.348238,-24.865295];

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
 if(list)list.onclick=()=>ypOpenListingsMenu();
 const zin=document.getElementById('zoomin'),zout=document.getElementById('zoomout');
 if(zin)zin.onclick=()=>ypZoom(1);
 if(zout)zout.onclick=()=>ypZoom(-1);
 const home=document.getElementById('home');
 if(home)home.onclick=ypRecentre;
}
(function ypBoot(){
 if(window.__ypMapBoot)return;window.__ypMapBoot=1;
 ypBindMapControls();
 ypMountChrome();
 const prevBoot=window.W3D_BOOT;
 window.W3D_BOOT=function(){try{prevBoot&&prevBoot();}catch(e){console.error(e);}ypInstallBottomNav();};
 const prevStart=window.startView;
 if(typeof prevStart==='function')window.startView=function(){const r=prevStart.apply(this,arguments);ypInstallBottomNav();return r;};
 ypInstallBottomNav();
 ypWrapHomeScreens();
 ypFitGameSheets();
 document.addEventListener('DOMContentLoaded',()=>{ypOffsetFreshNote();ypWatchTopNotices();requestAnimationFrame(ypOffsetFreshNote);});
 ypWatchTopNotices();
 ypWatchSheetHome();
 setTimeout(ypOffsetFreshNote,400);
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
 function drop(){try{if(window.maplibregl&&Object.prototype.hasOwnProperty.call(maplibregl,'GeolocateControl'))delete maplibregl.GeolocateControl;}catch(e){}}
 if(window.maplibregl){drop();return Promise.resolve();}
 return new Promise((resolve,reject)=>{
  if(!document.getElementById('yp-maplibre-css')){const css=document.createElement('link');css.id='yp-maplibre-css';css.rel='stylesheet';css.href='https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css';document.head.appendChild(css);}
  const s=document.createElement('script');s.src='https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js';s.onload=()=>{if(!window.maplibregl){reject(new Error('library'));return;}drop();resolve();};s.onerror=()=>reject(new Error('library'));document.head.appendChild(s);
 });
}
function ypMountChrome(){
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
function ypSaveCentre(){try{const prev=JSON.parse(localStorage.getItem(YP_CENTRE_KEY)||'null')||{};localStorage.setItem(YP_CENTRE_KEY,JSON.stringify({place:window.__ypPlace||null,centre:window.__ypListCentre||null,view:window.__ypMapView||prev.view||null}));}catch(e){}}
function ypLoadCentre(){try{const o=JSON.parse(localStorage.getItem(YP_CENTRE_KEY)||'null');if(!o)return;if(o.place&&Number.isFinite(+o.place.lon)&&Number.isFinite(+o.place.lat))window.__ypPlace=o.place;if(o.centre&&Number.isFinite(+o.centre.lon)&&Number.isFinite(+o.centre.lat))window.__ypListCentre=o.centre;if(o.view&&Number.isFinite(+o.view.lon)&&Number.isFinite(+o.view.lat))window.__ypMapView=o.view;}catch(e){}}
function ypMigrateWithdrawnRental(rental){if(!rental||rental.status!=='withdrawn')return false;rental.status='cancelled';if(rental.notified==='withdrawn')rental.notified='cancelled';rental.bondCharged=false;delete rental.bondPaid;delete rental.approveGameMs;delete rental.expiresAt;return true;}
function ypReadStock(){try{const o=JSON.parse(localStorage.getItem(YP_STOCK_KEY)||'null');if(!o||o.version!==1||!Array.isArray(o.rentals))return ypFreshStock();let changed=false;o.rentals.forEach(r=>{if(ypMigrateWithdrawnRental(r))changed=true;});if(changed)ypWriteStock(o);return o;}catch(e){return ypFreshStock();}}
function ypWriteStock(store){try{localStorage.setItem(YP_STOCK_KEY,JSON.stringify(store));}catch(e){}}
function ypApplyLabelPolicy(map){const layers=map&&map.getStyle&&map.getStyle()&&map.getStyle().layers||[];for(const layer of layers){if(ypShouldHideLabel(layer)){try{map.setLayoutProperty(layer.id,'visibility','none');}catch(e){}}}}
function ypListedRentals(place){return place?ypRadiusList(ypReadStock(),place).items:[];}
function ypSyncListingHomes(items){if(!ypMap||!ypMap.getSource||!ypMap.getSource('yp-listing-homes'))return;const features=[];for(const rental of items||[]){if(!rental.footprintId||!rental.geometry)continue;features.push({type:'Feature',properties:{id:rental.id,footprintId:rental.footprintId},geometry:rental.geometry});}ypMap.getSource('yp-listing-homes').setData({type:'FeatureCollection',features});const anchor=ypMap.getLayer('ypb-selected-fill')?'ypb-selected-fill':null;const stack=['yp-listing-fill','yp-listing-line','yp-rental-shadow','yp-rental-point'];try{stack.forEach(id=>{if(!ypMap.getLayer(id))return;if(anchor)ypMap.moveLayer(id,anchor);else ypMap.moveLayer(id);});}catch(e){}}
let ypListingTapAt=0;
function ypListingHit(event){const m=typeof ypMap!=='undefined'?ypMap:null;if(!m||!event)return '';const layers=['yp-listing-fill','yp-listing-line','yp-rental-point','yp-rental-shadow'].filter(id=>m.getLayer(id));if(event.point&&layers.length){try{const hits=m.queryRenderedFeatures(event.point,{layers})||[];const hit=hits.find(f=>f.properties&&f.properties.id);if(hit)return String(hit.properties.id);}catch(e){}}const lng=event.lngLat&&+event.lngLat.lng,lat=event.lngLat&&+event.lngLat.lat;if(!Number.isFinite(lng)||!Number.isFinite(lat))return '';const zoom=typeof m.getZoom==='function'?m.getZoom():0;if(zoom<14)return '';for(const rental of ypListedRentals(window.__ypListCentre)){if(ypOuterRings(rental.geometry).some(ring=>ypPointInRing(lng,lat,ring)))return rental.id;}return '';}
function ypOpenListingTap(event){const id=ypListingHit(event);if(!id)return false;const now=performance.now();if(now-ypListingTapAt>450){ypListingTapAt=now;const mine=typeof ypActiveTenancy==='function'?ypActiveTenancy():null;if(mine&&mine.id===id)ypOpenLivingArrangement(true);else ypOpenRentalDetail(id);}return true;}
function ypSyncRentalMarkers(){if(!ypMap||!ypMap.getSource||!ypMap.getSource('yp-rentals'))return;const items=ypListedRentals(window.__ypListCentre);ypMap.getSource('yp-rentals').setData({type:'FeatureCollection',features:items.map(r=>({type:'Feature',properties:{id:r.id},geometry:{type:'Point',coordinates:[r.lon,r.lat]}}))});ypSyncListingHomes(items);}
function ypOpenSelectedList(){ypCloseWhere();window.__ypListPage=1;ypRenderRentalList();}
function ypSyncRadius(){const c=window.__ypListCentre;if(!ypMap||!ypMap.getSource||!ypMap.getSource('yp-search-radius'))return;if(!c){ypMap.getSource('yp-search-radius').setData(ypEmpty());return;}const ring=ypRadiusRing(c.lon,c.lat,2000);ypMap.getSource('yp-search-radius').setData({type:'FeatureCollection',features:[{type:'Feature',properties:{kind:'search-area'},geometry:{type:'Polygon',coordinates:[ring]}}]});}
function ypShowAreaNote(text){const host=document.getElementById('map');if(!host)return;let note=document.getElementById('yp-chosen-note');if(!note){note=document.createElement('p');note.id='yp-chosen-note';note.setAttribute('role','status');host.appendChild(note);}note.textContent=text;}
function ypSyncHeader(){if(typeof G==='undefined'||!G||G.homeChosen)return;const p=window.__ypListCentre;if(p&&p.label)G.placeName=p.label;}
let ypFootHold={key:'',sig:''};
let ypResidentialSeen=false;
const YP_HOUSE_MIN_M2=80,YP_HOUSE_MAX_M2=450;
function ypFootprintPoint(ring){const inside=ypInteriorPoint(ring);if(inside)return inside;const open=ypRingOpen(ring);if(!open.length)return null;let lon=0,lat=0;open.forEach(p=>{lon+=p[0];lat+=p[1];});lon/=open.length;lat/=open.length;let best=open[0],bestD=Infinity;for(const p of open){const d=(p[0]-lon)*(p[0]-lon)+(p[1]-lat)*(p[1]-lat);if(d<bestD){bestD=d;best=p;}}return {lon:best[0],lat:best[1]};}
function ypAdoptedHomes(place){ypResidentialSeen=false;const features=window.__ygParts&&window.__ygParts.adopted&&window.__ygParts.adopted.features||[];const out=[],seen=new Set();if(!place||!Number.isFinite(+place.lon)||!Number.isFinite(+place.lat))return [];for(const feature of features){const props=feature&&feature.properties||{};const id=props.gameId?String(props.gameId):'';const tone=String(props.tone||'none');if(!props.adopted||!id||seen.has(id)||tone==='trade'||tone==='other')continue;const ring=ypOuterRings(feature.geometry)[0];if(!ring)continue;const point=ypFootprintPoint(ring);if(!point)continue;const d=ypDistanceM(+place.lon,+place.lat,point.lon,point.lat);if(d>2000)continue;seen.add(id);ypResidentialSeen=true;const area=ypRingAreaM2(ring);if(!(area>=YP_HOUSE_MIN_M2&&area<=YP_HOUSE_MAX_M2))continue;out.push({footprintId:id,lon:+point.lon.toFixed(6),lat:+point.lat.toFixed(6),d,geometry:feature.geometry,eligible:props.eligible===true});}return out;}
function ypApplyPlacePins(){const place=window.__ypListCentre;if(!place)return;const key=ypSuburbKey(place.stockKey||place.label);const homes=ypAdoptedHomes(place);const chosen=ypSpreadSites(homes,10);const residential=ypResidentialSeen;const rows=(ypReadStock().rentals||[]).filter(r=>r.suburbKey===key);const locked=rows.some(r=>r.status&&r.status!=='available');const bound=rows.length>0&&rows.every(r=>r.footprintId);const sig=chosen.map(h=>h.footprintId).join('|')||(residential?'none':'');const view=window.__ygView;const partsReady=!!(view&&view.hits>0&&view.loaded===view.hits);const stable=!!sig&&ypFootHold.key===key&&sig===ypFootHold.sig&&(chosen.length>=10||partsReady);ypFootHold={key,sig};if(residential||chosen.length){if(!locked&&!bound&&stable){const store=ypReadStock();store.rentals=store.rentals.filter(r=>r.suburbKey!==key);try{ypWriteStock(chosen.length?ypEnsureSuburbStock(store,place,chosen):store);}catch(e){}}ypSyncRentalMarkers();if(bound||(stable&&chosen.length))document.getElementById('yp-chosen-note')?.remove();else if(stable)ypShowAreaNote('No mapped buildings were available inside this 2 km area, so no sample pins were placed. Sample pins are not real vacancies.');return;}if(partsReady)ypShowAreaNote('No mapped buildings were available inside this 2 km area, so no sample pins were placed. Sample pins are not real vacancies.');}
let ypNameToken=0;
async function ypResolveSearchName(lon,lat,token){const key=ypGeoKey||window.ypGeoKey||'';if(!key)return;try{const url=new URL('https://api.geoapify.com/v1/geocode/reverse');url.search=new URLSearchParams({lat:String(lat),lon:String(lon),type:'locality',format:'json',limit:'1',apiKey:key});const response=await fetch(url.href,{...YP_MAP_REQUEST});if(!response.ok||token!==ypNameToken)return;const data=await response.json();const p=(data.results||[])[0];if(!p||p.housenumber||token!==ypNameToken)return;const name=ypSuburbText(p.suburb||p.district||p.city||'');if(!name)return;const c=window.__ypListCentre;if(!c||Math.abs(+c.lon-lon)>0.0002||Math.abs(+c.lat-lat)>0.0002)return;ypApplySuburb(name);}catch(e){}}
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
 if(!keep)ypAskSuburbOnce(centreLon,centreLat);
}
function ypMountSearchArea(){if(document.getElementById('yp-search-area'))return;const host=document.getElementById('map');if(!host)return;const b=document.createElement('button');b.type='button';b.id='yp-search-area';b.textContent='Search Area';const run=e=>{if(e)e.preventDefault();ypSearchArea();};b.addEventListener('click',run);b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();ypSearchArea();}});host.appendChild(b);}
function ypRenderRentalList(){ypExclusive('yp-rent-list');let panel=document.getElementById('yp-rent-list');if(!panel){panel=document.createElement('div');panel.id='yp-rent-list';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Available rentals');document.body.appendChild(panel);}const card=document.createElement('div');card.className='card';const centre=window.__ypListCentre;const result=ypRadiusList(ypReadStock(),centre);const page=ypPage(result.items,window.__ypListPage||1,20);const head=document.createElement('div');head.className='hwh';const h=document.createElement('h2');h.textContent='Available rentals';head.appendChild(h);ypHeaderDismiss(head,()=>panel.remove());const note=document.createElement('p');note.textContent=result.status!=='ready'?'Choose a town or suburb first. The rental list stays empty until that place has a map centre.':result.items.length?(result.items.some(r=>r.footprintId)?result.items.length+' rentals use real building footprints inside the 2 km area around '+centre.label+'. They are not real vacancies.':result.items.length+' sample pins sit on mapped buildings inside the 2 km area around '+centre.label+'. They are not real vacancies.'):'No mapped buildings were available inside this 2 km area around '+centre.label+', so no sample pins were placed. Sample pins are not real vacancies.';card.append(head,note);page.items.forEach(r=>{const btn=document.createElement('button');btn.type='button';btn.className='yp-rent-row';btn.dataset.id=r.id;const d=ypRentalDetail(r);const rt=document.createElement('span');rt.className='yp-row-title';rt.textContent=d.title;const rm=document.createElement('span');rm.className='yp-row-meta';rm.textContent=d.place;const rp=document.createElement('span');rp.className='yp-row-price';const rentText=ypMoneyText(d.weeklyRent);if(rentText)rp.textContent=rentText+' a week';btn.append(rt,rm,rp);btn.addEventListener('click',()=>ypOpenRentalDetail(r.id));card.appendChild(btn);});if(page.pages>1){const prev=document.createElement('button');prev.type='button';prev.id='yp-rent-prev';prev.className='hwx';prev.textContent='Previous';prev.disabled=page.page<=1;const next=document.createElement('button');next.type='button';next.id='yp-rent-next';next.className='hwx';next.textContent='Next';next.disabled=page.page>=page.pages;prev.addEventListener('click',()=>{window.__ypListPage=page.page-1;ypRenderRentalList();});next.addEventListener('click',()=>{window.__ypListPage=page.page+1;ypRenderRentalList();});card.append(prev,next);}const back=document.createElement('button');back.type='button';back.className='hwx';back.id='yp-rent-list-back';back.textContent='Back to map';back.addEventListener('click',()=>panel.remove());card.appendChild(back);panel.replaceChildren(card);}
function ypFactIcon(){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.8');path.setAttribute('stroke-linecap','round');path.setAttribute('d','M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5v9M9.2 9.2c.6-.8 1.6-1.2 2.8-1.2 1.7 0 2.8.9 2.8 2.2 0 1.2-.8 1.9-2.6 2.3l-2.2.5c-1.8.4-2.6 1.1-2.6 2.3 0 1.3 1.1 2.2 2.8 2.2 1.2 0 2.2-.4 2.8-1.2');svg.appendChild(path);return svg;}
function ypMountListing(card,model){model=model||{};card.classList.add('card','yp-listing');card.replaceChildren();const head=document.createElement('div');head.className='hwh';const kicker=document.createElement('p');kicker.className='yp-kicker';kicker.textContent=model.kicker||'Game sample property';const h=document.createElement('h2');h.id='yp-listing-title';h.textContent=model.title||'Sample property';head.append(kicker,h);card.appendChild(head);if(model.approval){const approved=document.createElement('p');approved.className='yp-approval';approved.id='yp-approved-status';approved.textContent=model.approval;card.appendChild(approved);}const money=model.money||[];const primary=money.find(item=>item.primary);const rest=money.filter(item=>item!==primary);if(primary){const price=document.createElement('p');price.className='yp-price';const amt=document.createElement('span');amt.className='yp-amt';amt.textContent=primary.amount;const per=document.createElement('span');per.className='yp-per';per.textContent=' '+primary.label;price.append(amt,per);card.appendChild(price);}if(model.place){const place=document.createElement('p');place.className='yp-place';place.textContent=model.place;card.appendChild(place);}if(rest.length){const dl=document.createElement('dl');dl.className='yp-facts';rest.forEach(item=>{const row=document.createElement('div');row.appendChild(ypFactIcon());const dt=document.createElement('dt');dt.textContent=item.label;const dd=document.createElement('dd');dd.textContent=item.amount;row.append(dt,dd);dl.appendChild(row);});card.appendChild(dl);}if(model.flow&&model.flow.length)card.appendChild(ypFlow(model.flow.map(item=>({label:item.label,hint:item.hint,value:ypMoneyText(item.amount),neg:+item.amount<0}))));if(model.status){const status=document.createElement('p');status.className='yp-status';status.textContent=model.status;card.appendChild(status);}if(model.limitation){const limit=document.createElement('p');limit.className='yp-limit';limit.textContent=model.limitation;card.appendChild(limit);}if(model.fixtureNote){const note=document.createElement('p');note.className='yp-fixture';note.textContent=model.fixtureNote;card.appendChild(note);}if(model.history&&model.history.length){const h=document.createElement('div');h.className='yp-history';h.id='yp-property-history';const title=document.createElement('p');title.className='yp-status';title.textContent='Property History';h.appendChild(title);const histEvents=model.history.slice().sort((a,b)=>{const rank=k=>({confirmed:0,accepted:1}[k]??2);const ra=rank(a.kind),rb=rank(b.kind);if(ra!==rb)return ra-rb;const atOf=e=>e.at!=null&&Number.isFinite(+e.at)?+e.at:+e.gameMs||0;return atOf(b)-atOf(a);});histEvents.forEach(ev=>{const row=document.createElement('p');row.className='yp-limit';row.dataset.key=ev.key;const when=ypEventClockLabel(ev);row.textContent=(when?when+'. ':'')+ev.text+'.';h.appendChild(row);});card.appendChild(h);}return card;}
let ypAppTimer=0;
const YP_HIST_KEY='yp.propertyHistory.v1';
function ypReadClock(wall){const weekMs=ypWeekMs();const week=typeof G!=='undefined'&&G?G.week|0:0;const acc=typeof G!=='undefined'&&G?Math.max(0,+G.acc||0):0;const paused=!!(typeof G!=='undefined'&&G&&G.started&&!G.homeChosen&&!G.clockOn);return {week,acc,weekMs,wall:wall==null?Date.now():wall,paused};}
function ypRescaleClockRecords(from,to){if(!(from>0)||!(to>0)||from===to||typeof ypScaleGameMs!=='function')return;const store=ypReadStock();let changed=false;(store.rentals||[]).forEach(r=>{['appliedGameMs','approveGameMs'].forEach(key=>{if(Number.isFinite(+r[key])){r[key]=ypScaleGameMs(r[key],from,to);changed=true;}});});if(changed)ypWriteStock(store);const hist=ypReadHistory();let marked=false;(hist.events||[]).forEach(ev=>{if(!Number.isFinite(+ev.gameMs))return;ev.gameMs=ypScaleGameMs(ev.gameMs,from,to);const parts=String(ev.key||'').split('|');if(parts.length>=3)ev.key=parts[0]+'|'+parts[1]+'|'+ev.gameMs;marked=true;});if(marked){try{localStorage.setItem(YP_HIST_KEY,JSON.stringify(hist));}catch(e){}}}
if(window.__ypClockFrom){ypRescaleClockRecords(window.__ypClockFrom,CFG.weekMs);delete window.__ypClockFrom;}
try{ypSyncSample();}catch(e){}
function ypReadHistory(){try{const o=JSON.parse(localStorage.getItem(YP_HIST_KEY)||'null');if(!o||o.version!==1||!Array.isArray(o.events))return {version:1,events:[]};let changed=false;o.events=o.events.filter(e=>e&&e.key&&Number.isFinite(+e.gameMs)).map(e=>{if(e.kind!=='withdrawn')return e;changed=true;return Object.assign({},e,{kind:'cancelled',text:'Cancelled',reason:e.reason||'Another application was accepted'});});if(changed)localStorage.setItem(YP_HIST_KEY,JSON.stringify(o));return o;}catch(e){return {version:1,events:[]};}}
function ypRecordHistory(events){if(!events||!events.length)return ypReadHistory();const next=ypMergeHistory(ypReadHistory(),events);localStorage.setItem(YP_HIST_KEY,JSON.stringify(next));return next;}
function ypNotice(events){if(!events||!events.length||typeof notify!=='function'||typeof G==='undefined'||!G)return;let posted=false;const confirmed=events.filter(ev=>ev&&ev.kind==='confirmed');const declined=events.filter(ev=>ev&&ev.kind==='declined');confirmed.forEach(ev=>{notify('info','Your rental application was accepted. The four-week bond and two weeks rent in advance were paid and the tenancy has started.',null,true);const n=G.notifs&&G.notifs[0];if(n){n.ypRental=ev.propertyId;n.ypKind='confirmed';if(Number.isFinite(+ev.at))n.t=+ev.at;}posted=true;});declined.forEach(ev=>{notify('info','Your rental application was declined. Nothing was charged.',null,true);const n=G.notifs&&G.notifs[0];if(n){n.ypRental=ev.propertyId;n.ypKind='declined';if(Number.isFinite(+ev.at))n.t=+ev.at;}posted=true;});if(posted&&typeof save==='function')save();}
let ypActivating=false;function ypSyncSample(clock){const now=clock||ypReadClock();const refreshed=ypRefreshSample(ypReadStock(),now);if(refreshed.released&&typeof G!=='undefined'&&G)G.cash+=refreshed.released;if(refreshed.changed)ypWriteStock(refreshed.store);if(refreshed.events&&refreshed.events.length){ypRecordHistory(refreshed.events);ypNotice(refreshed.events);}if(ypActivating)return ypReadStock();const activated=ypAutoActivateTenancy(ypReadStock(),now);if(!activated.ok)return ypReadStock();ypActivating=true;try{if(typeof G!=='undefined'&&G)G.cash=activated.cash;ypWriteStock(activated.store);const rental=(activated.store.rentals||[]).find(r=>r.status==='active'&&r.bondCharged);if(typeof ypBeginConfirmedTenancy==='function')ypBeginConfirmedTenancy(rental);const startWall=rental&&+rental.approveAt||0;const lag=startWall?Math.max(0,Date.now()-startWall):0;if(lag>=1000&&typeof advance==='function')advance(lag);ypRecordHistory(activated.events);ypNotice(activated.events);const cleaned=ypRefreshSample(ypReadStock(),now);if(cleaned.released&&typeof G!=='undefined'&&G)G.cash+=cleaned.released;if(cleaned.changed)ypWriteStock(cleaned.store);if(cleaned.events&&cleaned.events.length){ypRecordHistory(cleaned.events);ypNotice(cleaned.events);}if(typeof save==='function')save();if(typeof hud==='function')hud();if(typeof ypSyncHeader==='function')ypSyncHeader();return ypReadStock();}finally{ypActivating=false;}}
function ypShortText(result){const parts=[];if(result.short&&result.short.includes('bond'))parts.push('The bond and two weeks rent in advance come to '+ypMoneyText(result.bond)+' and the bank has '+ypMoneyText(result.bank)+'.');if(result.short&&result.short.includes('left'))parts.push('Left after this rent is '+ypMoneyText(result.left)+' a week.');return (parts.join(' ')||'Confirmation was not completed.')+' Nothing was charged. The other applications are unchanged.';}
function ypOpenApplyReview(id){ypExclusive('yp-apply-review');const rental=(ypReadStock().rentals||[]).find(r=>r.id===id);if(!rental||rental.status!=='available'||!ypHasCode(rental)){ypOpenRentalDetail(id);return;}ypEnsureSuburbName(rental);let panel=document.getElementById('yp-apply-review');if(panel)panel.remove();document.getElementById('yp-rent-detail')?.remove();panel=document.createElement('div');panel.id='yp-apply-review';panel.dataset.ypId=id;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','yp-review-title');const card=document.createElement('div');card.className='card yp-listing';const head=document.createElement('div');head.className='hwh';const kicker=document.createElement('p');kicker.className='yp-kicker';kicker.textContent='Rental application';const h=document.createElement('h2');h.id='yp-review-title';h.textContent='Your Application';head.append(kicker,h);ypHeaderDismiss(head,()=>panel.remove());card.appendChild(head);const picture=ypRentPicture(rental.weeklyRent,null);const appliedMs=ypGameMs(ypReadClock());const appliedWall=Date.now();const flow=ypFlow([{label:'Property',hint:'Game property',value:rental.n?'Sample rental '+rental.n:(rental.id||'Sample rental')},{label:'Location',hint:'Suburb',value:ypReviewLocation(rental),id:'yp-review-location'},{label:'Weekly rent',hint:'Paid each game week',value:ypMoneyText(picture.rent)||''},{label:'Four-week bond',hint:'Paid when approved',value:ypMoneyText(picture.bond)||''},{label:'Rent in advance',hint:'Two weeks, paid when approved',value:ypMoneyText(picture.advance)||''},{label:'Application Date',hint:'Date and time',value:ypRealClockLabel(appliedWall)},{label:'Tenancy Length',hint:'Lease term',value:ypTenancyLengthLabel()}]);card.appendChild(flow);const wait=document.createElement('h3');wait.id='yp-review-wait';wait.textContent='Waiting Period';const note=document.createElement('p');note.id='yp-review-note';note.className='yp-limit';note.textContent='After confirming your application, you will be notified as soon as possible of the outcome. If approved, we will move you in for free. Best of luck!';const go=document.createElement('button');go.type='button';go.className='hwb';go.id='yp-review-confirm';go.textContent='Confirm application';let sent=false;go.addEventListener('click',()=>{if(sent)return;sent=true;go.disabled=true;const result=ypSubmitApply(id,appliedMs);if(result&&result.ok)return;sent=false;go.disabled=false;let err=card.querySelector('#yp-review-error');if(!err){err=document.createElement('p');err.id='yp-review-error';card.insertBefore(err,go);}err.textContent=result&&result.reason==='already'?'This rental already has an application. Nothing was charged.':'This application could not be sent. Nothing was charged.';});const cancel=document.createElement('button');cancel.type='button';cancel.className='hwx';cancel.id='yp-review-cancel';cancel.textContent='Cancel';cancel.addEventListener('click',()=>panel.remove());card.append(wait,note,go,cancel);panel.appendChild(card);document.body.appendChild(panel);}
function ypSubmitApply(id,appliedMs){ypSyncSample(ypReadClock());const clock=ypClockAt(appliedMs);const result=ypApplySample(ypReadStock(),id,clock);if(!result.ok)return result;ypWriteStock(result.store);ypRecordHistory(result.events);if(typeof save==='function')save();ypShowPropertyHistory(id);return result;}
function ypSubmitCancel(id){const result=ypCancelSample(ypReadStock(),id);if(result.ok)ypWriteStock(result.store);ypOpenRentalDetail(id);}
function ypSubmitConfirm(id){const clock=ypReadClock();const player=ypReadPlayerMoney();const cash=typeof G!=='undefined'&&G?+G.cash:NaN;const week=typeof G!=='undefined'&&G?G.week|0:0;const result=ypConfirmSample(ypReadStock(),id,clock,player,cash,week);if(!result.ok){ypOpenRentalDetail(id,result.reason==='short'?ypShortText(result):result.reason==='expired'?'The test approval expired. Nothing was charged.':result.reason==='already-active'?'The bond was already paid once.':'');return;}if(typeof G!=='undefined'&&G)G.cash=result.cash;ypWriteStock(result.store);const rental=(result.store.rentals||[]).find(r=>r.id===id);if(typeof ypBeginConfirmedTenancy==='function')ypBeginConfirmedTenancy(rental);ypRecordHistory(result.events);if(typeof save==='function')save();if(typeof hud==='function')hud();if(typeof ypSyncHeader==='function')ypSyncHeader();ypOpenRentalDetail(id,'This tenancy is confirmed. Other pending rental applications were cancelled. Nothing extra was charged.');}
function ypSettleSampleWeek(board){if(typeof G==='undefined'||!G)return;const result=ypChargeSampleWeek(ypReadStock(),G.week|0);if(!result.charged)return;const covered=!!(G.homeChosen&&G.lease&&!G.lease.broken);if(!covered){if(board)G.cash+=board;G.cash-=result.charged;}ypWriteStock(result.store);if(typeof save==='function')save();if(typeof hud==='function')hud();}
function ypOpenRentalDetail(id,note){ypExclusive('yp-rent-detail');clearInterval(ypAppTimer);const clock=ypReadClock();const rental=ypSyncSample(clock).rentals.find(r=>r.id===id);if(!rental){ypOpenMissingOffer(id);return;}ypEnsureSuburbName(rental);const d=ypRentalDetail(rental,clock);d.listing.history=ypHistoryFor(ypReadHistory(),id);if((rental.status==='active'||rental.status==='approved')&&!d.listing.history.some(e=>e.kind==='accepted'||e.kind==='confirmed')){const at=Number.isFinite(+rental.confirmedAt)?+rental.confirmedAt:(Number.isFinite(+rental.approveAt)?+rental.approveAt:null);const ev=ypHistoryEvent(id,rental.status==='active'?'confirmed':'accepted',ypGameMs(clock),null,at);if(ev)d.listing.history=d.listing.history.concat([ev]);}let panel=document.getElementById('yp-rent-detail');if(panel)panel.remove();panel=document.createElement('div');panel.id='yp-rent-detail';panel.dataset.ypId=id;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','yp-listing-title');const card=document.createElement('div');ypMountListing(card,d.listing);ypHeaderDismiss(card.querySelector('.hwh'),()=>{clearInterval(ypAppTimer);panel.remove();});if(rental.status==='withdrawn'){const gone=document.createElement('p');gone.className='yp-status';gone.textContent='This application was withdrawn because another rental was confirmed. Nothing was charged. History is read only.';card.appendChild(gone);}if(note){const warn=document.createElement('p');warn.className='yp-status';warn.id='yp-short';warn.textContent=note;card.appendChild(warn);}if(d.listing.action&&rental.status!=='withdrawn'){const apply=document.createElement('button');apply.type='button';apply.className='hwb';apply.id='yp-rent-apply';apply.textContent=d.listing.action.label;apply.disabled=!!d.listing.action.disabled;apply.addEventListener('click',()=>{if(d.listing.action.act==='apply')ypOpenApplyReview(id);});card.appendChild(apply);}if(rental.status==='application-pending'||rental.status==='approved'){const cancel=document.createElement('button');cancel.type='button';cancel.className='hwx';cancel.id='yp-rent-cancel';cancel.textContent='Cancel test application';cancel.addEventListener('click',()=>ypSubmitCancel(id));card.appendChild(cancel);}const back=document.createElement('button');back.type='button';back.className='hwx';back.textContent='Back';back.addEventListener('click',()=>{clearInterval(ypAppTimer);panel.remove();});card.appendChild(back);panel.appendChild(card);document.body.appendChild(panel);if(rental.status==='application-pending'||rental.status==='approved'){ypAppTimer=setInterval(()=>{if(!document.getElementById('yp-rent-detail')){clearInterval(ypAppTimer);return;}const before=rental.status;const cur=ypSyncSample(ypReadClock()).rentals.find(r=>r.id===id);if(!cur||cur.status!==before)ypOpenRentalDetail(id);},1000);}}
function ypOpenMissingOffer(id){ypExclusive('yp-rent-detail');let panel=document.getElementById('yp-rent-detail');if(panel)panel.remove();panel=document.createElement('div');panel.id='yp-rent-detail';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Application');const card=document.createElement('div');card.className='card yp-listing';const head=document.createElement('div');head.className='hwh';const h=document.createElement('h2');h.textContent='Application';head.appendChild(h);ypHeaderDismiss(head,()=>panel.remove());const copy=document.createElement('p');copy.className='yp-limit';copy.textContent=id?'This application is no longer open. Nothing was charged.':'That notice does not match a current rental application.';const back=document.createElement('button');back.type='button';back.className='hwx';back.textContent='Back';back.addEventListener('click',()=>panel.remove());card.append(head,copy,back);panel.appendChild(card);document.body.appendChild(panel);}
function ypOfferStatus(status){return { 'application-pending':'Pending','approved':'Approved','active':'Tenancy confirmed','withdrawn':'Withdrawn','declined':'Declined','expired':'Expired','cancelled':'Cancelled' }[status]||status;}
function ypHistoryCardStatus(ev,rental){const kind=ev&&ev.kind||'';const status=rental&&rental.status||'';let label='';if(kind==='cancelled'||status==='cancelled')label='Cancelled';else if(kind==='expired')label='Expired';else if(kind==='declined')label='Declined';else if(kind==='withdrawn')label='Withdrawn';else if(kind==='confirmed')label='Tenancy confirmed';else if(kind==='accepted')label='Approved';else if(kind==='applied'&&(!status||status==='available'||status==='application-pending'))label='Pending';else label=ypOfferStatus(status)||'';label=String(label).trim();if(!label)return '';return label.charAt(0).toUpperCase()+label.slice(1);}
function ypPendingOfferRows(store){return (store&&store.rentals||[]).filter(r=>r&&r.status==='application-pending');}
function ypOpenPendingOffers(){
 ypExclusive('yp-pending');
 ypUseHome();
 ypSyncSample(ypReadClock());
 let panel=document.getElementById('yp-pending');
 if(panel)panel.remove();
 panel=document.createElement('div');
 panel.id='yp-pending';
 panel.setAttribute('role','dialog');
 panel.setAttribute('aria-labelledby','yp-pending-title');
 const card=document.createElement('div');
 card.className='card';
 const shut=()=>{panel.remove();ypUseHome();};
 const head=ypCardHeader({title:'Pending Offers',titleId:'yp-pending-title',onClose:shut});
 card.appendChild(head);
 const rows=ypPendingOfferRows(ypReadStock());
 if(!rows.length){
  const empty=document.createElement('p');
  empty.id='yp-pending-empty';
  empty.textContent='You have no pending offers';
  card.appendChild(empty);
 }else{
  const note=document.createElement('p');
  note.textContent='These are your rental applications. They stay here when the map search changes. The six-week bond is paid when an application is accepted.';
  card.appendChild(note);
 }
 rows.forEach(r=>{
  const btn=document.createElement('button');
  btn.type='button';
  btn.className='yp-rent-row';
  btn.dataset.id=r.id;
  const t=document.createElement('span');
  t.className='yp-row-title';
  t.textContent=(r.placeLabel||r.id);
  const s=document.createElement('span');
  s.className='yp-row-meta';
  s.textContent=ypOfferStatus(r.status);
  btn.append(t,s);
  btn.addEventListener('click',()=>{panel.remove();ypOpenRentalDetail(r.id);});
  card.appendChild(btn);
 });
 const hist=document.createElement('button');
 hist.type='button';
 hist.className='btn buy';
 hist.id='yp-open-history';
 hist.textContent='Property History';
 hist.addEventListener('click',()=>{panel.remove();ypOpenPropertyHistory();});
 card.append(hist);
 panel.appendChild(card);
 document.body.appendChild(panel);
}
function ypSavedTenancyLabel(){const lease=typeof G!=='undefined'&&G?G.lease:null;const fromLease=lease?+lease.months:NaN;const fromStatus=typeof G!=='undefined'&&G?+G.statusLease:NaN;const months=(fromLease===3||fromLease===6||fromLease===12)?fromLease:((fromStatus===3||fromStatus===6||fromStatus===12)?fromStatus:0);return months?months+' months':'';}
function ypFlow(rows){const flow=document.createElement('dl');flow.className='yp-flow';(rows||[]).forEach(item=>{if(!item||item.value==null||item.value==='')return;const row=document.createElement('div');row.dataset.label=item.label||'';const dt=document.createElement('dt');dt.textContent=item.label||'';if(item.hint){const hint=document.createElement('span');hint.className='yp-hint';hint.textContent=item.hint;dt.appendChild(hint);}const dd=document.createElement('dd');if(item.id)dd.id=item.id;if(item.onClick){const a=document.createElement('a');a.href='#';a.className='yp-link';a.textContent=String(item.value);if(item.codeFor)a.dataset.ypCode=item.codeFor;a.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();item.onClick();});dd.appendChild(a);}else{dd.textContent=String(item.value);if(item.codeFor)dd.dataset.ypCode=item.codeFor;}if(item.neg)dd.classList.add('yp-neg');row.append(dt,dd);flow.appendChild(row);});return flow;}
function ypLeaseWeeksLeft(){const L=typeof G!=='undefined'&&G?G.lease:null;if(!L||L.broken||L.m2m||!Number.isFinite(+L.end)||L.end<=G.week)return null;return L.end-G.week;}
function ypLivingFacts(){if(typeof G==='undefined'||!G||typeof housing!=='function')return {status:'',time:null};const h=housing();if(h==='home')return {status:'Property owner',time:null};if(h==='family'){const home=G.famHome;if(home&&home.room)return {status:'Room Sharing',time:null};if(home)return {status:typeof boardWk==='function'&&boardWk()>0?'Boarding':'Living with family or friends',time:null};return {status:'',time:null};}if(G.homeChosen&&G.lease&&!G.lease.broken)return {status:'Renting',time:ypLeaseWeeksLeft()};if(G.homeChosen)return {status:'Renting',time:null};if(G.clockOn)return {status:'Boarding',time:null};if(G.statusPick==='rent')return {status:'Renting',time:null};return {status:'',time:null};}
function ypAwayRows(weeks,cashDelta,ledger){const n=weeks|0;const live=ypLivingFacts();const rows=[{label:'Game weeks passed',value:String(n),id:'yp-away-weeks'}];const income=ledger&&Number.isFinite(+ledger.income)?+ledger.income:null;const expense=ledger&&Number.isFinite(+ledger.expense)?+ledger.expense:0;if(income!=null)rows.push({label:'Income received',value:fmt(income),neg:income<0,id:'yp-away-income'});if(Number.isFinite(+cashDelta)&&(income==null||expense!==0||Math.round(+cashDelta)!==Math.round(income)))rows.push({label:'Extra savings',value:fmt(+cashDelta),neg:+cashDelta<0,id:'yp-away-cash'});if(typeof bank==='function'){const power=bank().power;if(Number.isFinite(+power))rows.push({label:'Borrowing power',value:fmt(power),id:'yp-away-power'});}if(live.status)rows.push({label:'Living status',value:live.status,id:'yp-away-status'});if(live.time!=null)rows.push({label:'Time left',value:live.time+(live.time===1?' week':' weeks'),id:'yp-away-time'});return rows;}
function ypShowAwayCard(weeks,cashDelta,ledger){const n=weeks|0;if(!(n>0)||!Number.isFinite(+cashDelta))return;ypExclusive('yp-away');const old=document.getElementById('yp-away');if(old)old.remove();const panel=document.createElement('div');panel.id='yp-away';panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','yp-away-title');const card=document.createElement('div');card.className='card yp-listing';const shut=()=>{panel.remove();ypUseHome();};const head=ypCardHeader({title:'While you were away',titleId:'yp-away-title',id:'yp-away-x',onClose:shut});const close=document.createElement('button');close.type='button';close.className='yp-close';close.id='yp-away-close';close.textContent='Close';close.addEventListener('click',shut);card.append(head,ypFlow(ypAwayRows(n,cashDelta,ledger)),close);panel.appendChild(card);document.body.appendChild(panel);ypUseHome();}
function ypCardHeader(opts){opts=opts||{};const head=document.createElement('header');head.className='yp-card-head';const titles=document.createElement('div');titles.className='yp-card-titles';if(opts.kicker){const eye=document.createElement('p');eye.className='yp-kicker';eye.textContent=opts.kicker;titles.appendChild(eye);}const h=document.createElement('h2');if(opts.titleId)h.id=opts.titleId;h.textContent=opts.title||'';titles.appendChild(h);const btn=document.createElement('button');btn.type='button';btn.className='yp-x';if(opts.id)btn.id=opts.id;btn.setAttribute('aria-label','Close');btn.textContent='\u2715';btn.addEventListener('click',event=>{if(event){event.preventDefault();event.stopPropagation();}if(opts.onClose)opts.onClose(event);});head.append(titles,btn);return head;}
function ypHeaderDismiss(head,onClose,id){if(!head||head.querySelector('.yp-x'))return;const kicker=head.querySelector('.yp-kicker');const titleEl=head.querySelector('h2,h3');const fresh=ypCardHeader({title:titleEl?titleEl.textContent:(head.textContent||''),kicker:kicker?kicker.textContent:'',onClose,id,titleId:titleEl&&titleEl.id});head.className=fresh.className;head.replaceChildren(...fresh.childNodes);}
let ypSoloLock=0;
function ypDialogNodes(){const ids=['yp-history','yp-history-detail','yp-living','yp-apply-review','yp-rent-detail','yp-rent-list','yp-pending','yp-soon','yp-where','yp-prop','yp-property-menu','yp-section-menu','listings','hwov','yp-away','yp-start-fresh'];const nodes=[];ids.forEach(id=>{const el=document.getElementById(id);if(el)nodes.push(el);});const sheet=document.getElementById('sheet');if(sheet&&sheet.classList.contains('open'))nodes.push(sheet);const drawer=document.getElementById('drawer');if(drawer&&drawer.classList.contains('open'))nodes.push(drawer);return nodes;}
function ypHideDialog(el){if(!el)return;if(el.id==='sheet'){const ui=ypGameUI();if(ui&&ui.close)ui.close();return;}if(el.id==='drawer'){const ui=ypGameUI();if(ui&&ui.menu)ui.menu(false);return;}if(el.id==='listings'&&typeof listClose==='function'){listClose();return;}if(el.id==='yp-property-menu'||el.id==='yp-section-menu')document.documentElement.classList.remove('yp-menu-open');if(el.id==='yp-rent-detail')clearInterval(ypAppTimer);if(el.parentNode)el.remove();}
function ypExclusive(keepId){if(ypSoloLock)return;ypSoloLock=1;try{ypDialogNodes().forEach(el=>{if(el.id!==keepId)ypHideDialog(el);});}finally{ypSoloLock=0;}}
function ypOpenDialogs(){return ypDialogNodes().filter(el=>{if(el.hidden)return false;const s=getComputedStyle(el);if(s.display==='none'||s.visibility==='hidden')return false;const r=el.getBoundingClientRect();return r.width>2&&r.height>2;}).map(el=>el.id);}
function ypPlainClose(btn){if(!btn)return;btn.classList.add('yp-x');btn.textContent='\u2715';btn.setAttribute('aria-label','Close');}
function ypArmDrawer(){const pane=document.querySelector('#drawer .pane');if(!pane||pane.querySelector('.yp-card-head'))return;pane.prepend(ypCardHeader({title:'Menu',onClose:()=>{const ui=ypGameUI();if(ui&&ui.menu)ui.menu(false);}}));}
function ypArmListings(){const panel=document.getElementById('listings');if(!panel||panel.querySelector('.yp-card-head'))return;panel.prepend(ypCardHeader({title:'Listings',id:'yp-listings-x',onClose:()=>{if(typeof listClose==='function')listClose();}}));}
function ypArmHwov(){const card=document.querySelector('#hwov .hwc');if(!card||card.querySelector('.yp-card-head'))return;const titleEl=card.querySelector('h3');const head=ypCardHeader({title:titleEl?titleEl.textContent:'',onClose:()=>{if(document.getElementById('hwov')&&document.getElementById('hwov').classList.contains('hwrun')&&typeof hwClose==='function')hwClose();else{const next=document.getElementById('hw_next');if(next)next.click();else if(typeof lsClose==='function')lsClose();}}});if(titleEl)titleEl.remove();card.prepend(head);}
/* Permanent property codes, the same for every player: official Queensland locality prefix + number, from data/codes (rules and CC BY 4.0 source in data/codes/localities.json).
   A rental or history entry maps to its building through its footprint id. Codes load per shard (first two hex digits of the ypb id); shown codes refresh when a shard arrives. */
const ypCodeShards=new Map();let ypCodeLocalities=null;
const YP_SUBURB_CREDIT='<a href="https://www.data.qld.gov.au/dataset/locality-boundaries-queensland">Suburbs: Locality boundaries © State of Queensland, CC BY 4.0</a>';
function ypCodeBuilding(id){id=String(id||'');if(id.startsWith('ypb-'))return id;const r=(ypReadStock().rentals||[]).find(x=>x&&x.id===id);return r&&String(r.footprintId||'').startsWith('ypb-')?String(r.footprintId):'';}
function ypCodeShard(name){if(!ypCodeShards.has(name))ypCodeShards.set(name,fetch('data/codes/'+name+'.json').then(r=>{if(!r.ok)throw new Error(r.status);return r.json();}).then(o=>{ypCodeShards.set(name,o);if(name==='localities')ypCodeLocalities=o.prefixes||{};document.dispatchEvent(new Event('yp-codes'));},()=>{ypCodeShards.set(name,{c:{},prefixes:{}});}));return ypCodeShards.get(name);}
function ypOfficialSuburb(id){const code=ypPublicCode(id);if(!/^[A-Z]{3}-\d{4}$/.test(code))return '';if(!ypCodeLocalities){ypCodeShard('localities');return '';}const loc=ypCodeLocalities[code.slice(0,3)];return loc?loc.locality:'';}
document.addEventListener('yp-codes',()=>{document.querySelectorAll('[data-yp-code]').forEach(el=>{el.textContent=ypPublicCode(el.dataset.ypCode);});if(typeof ypRefreshSuburbText==='function')ypRefreshSuburbText();});
try{localStorage.removeItem((window.__ypPreviewNs||'yp.')+'publicCodes');}catch(e){}/* old per-device numbering, replaced by data/codes */
ypCodeShard('localities');try{(ypReadStock().rentals||[]).forEach(r=>ypPublicCode(r.id));}catch(e){}/* warm the codes a player is most likely to see */
function ypGoToProperty(r){['yp-living','yp-history','yp-history-detail'].forEach(id=>{const el=document.getElementById(id);if(el)el.remove();});const v={lon:+r.lon,lat:+r.lat,zoom:18};window.__ypMapView=v;ypOpenListingMap('rent');const go=()=>{if(!ypMap)return;try{ypMap.stop();ypMap.jumpTo({center:[v.lon,v.lat],zoom:v.zoom});}catch(e){}};[300,900,1800].forEach(ms=>setTimeout(go,ms));const id=r.footprintId||r.id;const mark=async()=>{if(!id||typeof window.__ygSelect!=='function')return;let feature=null;const parts=window.__ygParts;if(parts)feature=(parts.adopted.features||[]).find(f=>f.properties&&f.properties.gameId===id)||null;if(!feature){try{if(!ypFeedManifest)ypFeedManifest=await (await fetch('data/chunk-manifest.json')).json();const k=ypFeedManifest.chunks.find(k=>v.lon>=k.bbox[0]&&v.lon<=k.bbox[2]&&v.lat>=k.bbox[1]&&v.lat<=k.bbox[3]);if(k)feature=((await ypFeedChunk(k.id)).features||[]).find(f=>f.properties&&f.properties.gameId===id)||null;}catch(e){}}if(feature)window.__ygSelect(feature);};mark();[300,900,1800,2500].forEach(ms=>setTimeout(mark,ms));}
function ypPublicCode(id){const g=ypCodeBuilding(id);if(!g)return 'No code';const shard=ypCodeShards.get(g.slice(4,6));if(shard&&!(shard instanceof Promise))return shard.c&&shard.c[g]||'No code';ypCodeShard(g.slice(4,6));return '…';}
function ypRentalRecordRows(ev, rental){
 const bond=rental&&Number.isFinite(+rental.weeklyRent)?Math.round(+rental.weeklyRent)*4:NaN;
 const rows=[
  {label:'Event',hint:'Recorded action',value:ev&&ev.text||''},
  {label:'Date',hint:'Date and time',value:ev?ypEventClockLabel(ev):''},
  {label:'Reason',hint:'Why this was recorded',value:ev&&ev.reason||''},
  {label:'Property ID',hint:'Property code',value:ypPublicCode((ev&&ev.propertyId)||(rental&&rental.id)||''),codeFor:(ev&&ev.propertyId)||(rental&&rental.id)||'',onClick:rental&&Number.isFinite(+rental.lon)&&Number.isFinite(+rental.lat)?()=>ypGoToProperty(rental):null}
 ];
 if(rental) rows.push(
  {label:'Location',hint:'Suburb',value:ypDisplaySuburb(rental)},
  {label:'Weekly rent',hint:'Paid each game week',value:ypMoneyText(rental.weeklyRent)||''},
  {label:'Four-week bond',hint:'Bond on this rental',value:ypMoneyText(bond)||''},{label:'Rent in advance',hint:'Two weeks, paid at move-in',value:ypMoneyText(Number.isFinite(bond)?bond/2:NaN)||''},
  {label:'Tenancy length',hint:'Lease term',value:ypSavedTenancyLabel()},
  {label:'Status',hint:'Application status',value:ypHistoryCardStatus(ev,rental)||''}
 );
 return rows;
}
function ypLeaseEndLabel(){
 const L=typeof G!=='undefined'&&G?G.lease:null;
 if(!L||L.broken) return '';
 if(L.m2m) return 'Month to month';
 const end=L.end|0;
 if(!(end>=0)) return '';
 return gdate(end);
}
function ypMountRecordCard(panel, opts){
 opts=opts||{};
 const card=document.createElement('div');
 card.className='card yp-listing';
 const head=document.createElement('div');
 head.className='hwh';
 const kicker=document.createElement('p');
 kicker.className='yp-kicker';
 kicker.textContent=opts.kicker||'';
 const h=document.createElement('h2');
 h.id=opts.titleId||'yp-history-detail-title';
 h.textContent=opts.title||'History';
 if(opts.kicker) head.append(kicker,h); else head.append(h);
 card.appendChild(head);
 card.appendChild(ypFlow(opts.rows||[]));
 const shut=event=>{if(event){event.preventDefault();event.stopPropagation();}panel.remove();if(opts.onClose)opts.onClose();};
 ypHeaderDismiss(head,shut,opts.closeId);
 const close=document.createElement('button');
 close.type='button';
 close.className='yp-close';
 if(opts.closeBtnId) close.id=opts.closeBtnId;
 close.textContent='Close';
 close.addEventListener('click',shut);
 card.appendChild(close);
 panel.appendChild(card);
 return card;
}
function ypOpenHistoryDetail(ev){
 ypExclusive('yp-history-detail');
 ypUseHome();
 const old=document.getElementById('yp-history-detail');
 if(old) old.remove();
 const rental=(ypReadStock().rentals||[]).find(r=>r&&r.id===ev.propertyId)||null;
 const panel=document.createElement('div');
 panel.id='yp-history-detail';
 panel.setAttribute('role','dialog');
 panel.setAttribute('aria-labelledby','yp-history-detail-title');
 ypMountRecordCard(panel,{kicker:'Property history',title:ev.text||'History',titleId:'yp-history-detail-title',closeId:'yp-history-detail-x',closeBtnId:'yp-history-detail-close',rows:ypRentalRecordRows(ev,rental),onClose:()=>ypOpenPropertyHistory()});
 document.body.appendChild(panel);
}
function ypOpenLivingArrangement(onMap){
 ypExclusive('yp-living');
 if(!onMap) ypUseHome();
 const old=document.getElementById('yp-living');
 if(old) old.remove();
 const rental=(typeof ypActiveTenancy==='function'?ypActiveTenancy():null)||(ypReadStock().rentals||[]).find(r=>r&&r.status==='active'&&r.bondCharged)||null;
 const events=rental?ypHistoryFor(ypReadHistory(),rental.id):[];
 const confirmed=[...events].reverse().find(e=>e.kind==='confirmed')||null;
 const ev=confirmed||(rental?{text:'Tenancy confirmed',kind:'confirmed',gameMs:((typeof G!=='undefined'&&G&&G.lease?G.lease.start:rental.startWeek)||0)*ypWeekMs(),propertyId:rental.id}:null);
 const rows=rental?ypRentalRecordRows(ev,rental):[{label:'Status',hint:'Current home',value:(()=>{const s=typeof ypLivingFacts==='function'?ypLivingFacts().status:'';return s&&s!=='Renting'?s:'Currently homeless';})()}];
 if(rental&&rows[0]&&rows[0].label==='Event'){const s=typeof ypLivingFacts==='function'?ypLivingFacts().status:'';const map={'Property owner':'Living in own home','Room Sharing':'Room sharing'};rows[0]={label:'Arrangement',hint:'How you live now',value:map[s]||s||'Renting'};}
 const ends=ypLeaseEndLabel();
 if(ends) rows.push({label:'Lease ends',hint:'Renew lease or vacate',value:ends});
 const panel=document.createElement('div');
 panel.id='yp-living';
 panel.setAttribute('role','dialog');
 panel.setAttribute('aria-labelledby','yp-living-title');
 ypMountRecordCard(panel,{title:'Current Living Arrangement',titleId:'yp-living-title',closeId:'yp-living-x',closeBtnId:'yp-living-close',rows,onClose:()=>{if(!onMap)ypUseHome();}});
 document.body.appendChild(panel);
}
function ypOpenPropertyHistory(){ypExclusive('yp-history');ypUseHome();let panel=document.getElementById('yp-history');if(panel)panel.remove();document.getElementById('yp-history-detail')?.remove();panel=document.createElement('div');panel.id='yp-history';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Property History');const card=document.createElement('div');card.className='card';const head=document.createElement('div');head.className='hwh';const h=document.createElement('h2');h.textContent='Property History';head.appendChild(h);const note=document.createElement('p');note.textContent='Read only. Local preview records for this save. Opening a row does not charge or reopen an offer.';card.append(head,note);const events=ypMergeHistory(ypReadHistory(),[]).events;if(!events.length){const empty=document.createElement('p');empty.id='yp-history-empty';empty.textContent='No recorded rental events yet.';card.appendChild(empty);}events.forEach(ev=>{const btn=document.createElement('button');btn.type='button';btn.className='yp-rent-row';btn.dataset.key=ev.key;const t=document.createElement('span');t.className='yp-row-title';t.textContent=ev.text;const s=document.createElement('span');s.className='yp-row-meta';s.textContent=ypDisplaySuburb((ypReadStock().rentals||[]).find(r=>r.id===ev.propertyId));const when=document.createElement('span');when.className='yp-row-price';when.textContent=ypEventClockLabel(ev);btn.append(t,s,when);btn.addEventListener('click',()=>ypOpenHistoryDetail(ev));card.appendChild(btn);});const shut=event=>{if(event){event.preventDefault();event.stopPropagation();}panel.remove();document.getElementById('yp-history-detail')?.remove();ypMarkNav(document.getElementById('minebtn'));ypUseHome();};ypHeaderDismiss(head,shut,'yp-history-x');const close=document.createElement('button');close.type='button';close.className='yp-close';close.id='yp-history-close';close.textContent='Close';close.addEventListener('click',shut);card.appendChild(close);panel.appendChild(card);document.body.appendChild(panel);}
function ypShowPropertyHistory(propertyId){ypUseHome();clearInterval(ypAppTimer);['yp-apply-review','yp-rent-detail','yp-rent-list','yp-pending','yp-property-menu','yp-section-menu','yp-history-detail','yp-living','yp-where'].forEach(key=>{const el=document.getElementById(key);if(el)el.remove();});document.documentElement.classList.remove('yp-menu-open');ypMarkNav(document.getElementById('minebtn'));ypOpenPropertyHistory();if(!propertyId)return;const row=[...document.querySelectorAll('#yp-history .yp-rent-row')].reverse().find(b=>String(b.dataset.key||'').startsWith(propertyId+'|applied|'));if(row&&row.scrollIntoView)row.scrollIntoView({block:'nearest'});}
function ypGameUI(){return typeof UI!=='undefined'?UI:null;}
function ypCloseSheets(){if(typeof picker==='function')picker(false);const ui=ypGameUI();if(ui&&ui.menu)ui.menu(false);if(ui&&ui.el)ui.el.classList.remove('open');document.body.classList.remove('sheetopen');}
function ypMarkNav(button){if(!button)return;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b===button));}
function ypNavButton(label){return [...document.querySelectorAll('nav button')].find(b=>(b.getAttribute('aria-label')||'')===label)||null;}
function ypPlaceNavMenu(card,anchor){if(!card||!anchor)return;const margin=8,gap=10;card.style.left='0px';card.style.top='0px';const width=card.offsetWidth,height=card.offsetHeight;const ar=anchor.getBoundingClientRect();const nav=document.querySelector('nav');const navTop=nav?nav.getBoundingClientRect().top:window.innerHeight-78;let left=ar.left+ar.width/2-width/2;left=Math.max(margin,Math.min(left,window.innerWidth-width-margin));let top=navTop-height-gap;if(top<margin)top=margin;card.style.left=Math.round(left)+'px';card.style.top=Math.round(top)+'px';const notch=card.querySelector('.yp-notch');if(notch){const center=ar.left+ar.width/2-left;notch.style.left=Math.round(Math.max(16,Math.min(center-notch.offsetWidth/2,width-16-notch.offsetWidth)))+'px';}}
function ypOffsetFreshNote(){const note=document.getElementById('yp-fresh-note');const header=document.querySelector('header');if(!note||!header)return;const h=Math.ceil(note.getBoundingClientRect().height);if(h<8)return;const gap=h+14;header.style.setProperty('top','calc(var(--sat) + '+gap+'px)','important');const chosen=document.getElementById('yp-chosen-note');if(chosen)chosen.style.setProperty('top','calc(var(--sat) + '+(gap+56)+'px)');ypPlaceTopNotices();}
function ypPlaceTopNotices(){const toast=document.getElementById('toast');if(!toast)return;toast.style.setProperty('left','50%','important');toast.style.setProperty('right','auto','important');toast.style.setProperty('transform','translateX(-50%)','important');}
function ypWatchTopNotices(){if(window.__ypNoticeWatch)return;window.__ypNoticeWatch=1;const bump=()=>ypPlaceTopNotices();new MutationObserver(bump).observe(document.body,{childList:true});const el=document.getElementById('toast');if(el)new MutationObserver(bump).observe(el,{attributes:true,attributeFilter:['class']});const orig=window.toast;if(typeof orig==='function'&&!orig.__ypLift){const wrapped=function(){const result=orig.apply(this,arguments);ypPlaceTopNotices();return result;};wrapped.__ypLift=1;window.toast=wrapped;}}
function ypWatchSheetHome(){if(window.__ypSheetHome)return;window.__ypSheetHome=1;let was=document.body.classList.contains('sheetopen');new MutationObserver(()=>{const on=document.body.classList.contains('sheetopen');if(was&&!on&&!ypOpeningMap)ypUseHome();was=on;}).observe(document.body,{attributes:true,attributeFilter:['class']});}
let ypTilesHold=false;
function ypRememberMap(){if(!ypMap||typeof ypMap.getCenter!=='function')return;try{const c=ypMap.getCenter();if(!Number.isFinite(+c.lng)||!Number.isFinite(+c.lat))return;window.__ypMapView={lon:+Number(c.lng).toFixed(6),lat:+Number(c.lat).toFixed(6),zoom:+Number(ypMap.getZoom()).toFixed(2)};if(typeof ypSaveCentre==='function')ypSaveCentre();}catch(e){}}
function ypAbortMapRequests(){const map=ypMap;if(!map)return;try{if(typeof map.stop==='function')map.stop();}catch(e){}const mgr=map._requestManager;const bags=mgr?[mgr._requests,mgr.requests]:[];bags.forEach(bag=>{if(!bag)return;const list=Array.isArray(bag)?bag:(bag instanceof Map?[...bag.values()]:Object.values(bag));list.forEach(req=>{try{if(!req)return;if(typeof req.cancel==='function')req.cancel();if(typeof req.abort==='function')req.abort();if(req.controller&&typeof req.controller.abort==='function')req.controller.abort();}catch(e){}});});const caches=map.style&&map.style.sourceCaches;if(!caches)return;Object.values(caches).forEach(cache=>{try{if(ypTilesHold){if(typeof cache.pause==='function')cache.pause();}else if(typeof cache.resume==='function')cache.resume();}catch(e){}});}
function ypUseHome(){ypRememberMap();ypTilesHold=true;ypAbortMapRequests();document.documentElement.classList.add('yp-home');document.documentElement.classList.remove('yp-map-on');}
let ypMapGate=null;
function ypEnsureMap(){if(ypMapGate)return ypMapGate;const started=typeof ypEnterRealMap==='function'?ypEnterRealMap():null;ypMapGate=started&&typeof started.then==='function'?started:Promise.resolve();return ypMapGate;}
let ypOpeningMap=false;
if(window.__ypAway){const away=window.__ypAway;delete window.__ypAway;ypShowAwayCard(away.n,away.cash,away);}
function ypUseMap(){ypOpeningMap=true;ypTilesHold=false;document.documentElement.classList.remove('yp-home');document.documentElement.classList.add('yp-map-on');const resume=()=>{ypAbortMapRequests();if(!ypMap)return;try{const view=window.__ypMapView;if(view&&Number.isFinite(+view.lon)&&Number.isFinite(+view.lat))ypMap.jumpTo({center:[+view.lon,+view.lat],zoom:Number.isFinite(+view.zoom)?+view.zoom:ypMap.getZoom()});if(typeof ypMap.resize==='function')ypMap.resize();}catch(e){}};const done=()=>{ypOpeningMap=false;return resume();};return ypEnsureMap().then(done,done);}
function ypNormalizeSheet(){const sheet=document.getElementById('sheet'),body=document.getElementById('sheetBody');if(!sheet||!body)return;const old=body.querySelector('h2');if(!old)return;const title=old.textContent.replace(/\s+/g,' ').trim();const head=ypCardHeader({title,id:'yp-sheet-x',onClose:()=>{const ui=ypGameUI();if(ui&&ui.close)ui.close();}});old.remove();const prev=sheet.querySelector(':scope > .yp-card-head');if(prev)prev.replaceWith(head);else sheet.insertBefore(head,body);}
function ypFitSheet(){const sheet=document.querySelector('.sheet.open');if(!sheet)return;const header=document.querySelector('header'),nav=document.querySelector('nav'),gap=12;const headerBottom=header?header.getBoundingClientRect().bottom:72;const navTop=nav?nav.getBoundingClientRect().top:window.innerHeight-84;const max=Math.max(160,Math.floor(Math.min(window.innerHeight-2*(headerBottom+gap),2*(navTop-gap)-window.innerHeight)));sheet.style.maxHeight=max+'px';}
function ypFitGameSheets(){const ui=ypGameUI();if(!ui||ui.__ypFit||typeof ui.open!=='function')return;ui.__ypFit=1;const origOpen=ui.open;ui.open=function(){ypExclusive('sheet');const result=origOpen.apply(this,arguments);ypNormalizeSheet();ypFitSheet();return result;};const origMenu=ui.menu;if(typeof origMenu==='function')ui.menu=function(show){if(show!==false)ypExclusive('drawer');const result=origMenu.apply(this,arguments);if(show!==false)ypArmDrawer();return result;};}
function ypWrapHomeScreens(){const ui=ypGameUI();if(!ui||ui.__ypHome)return;ui.__ypHome=1;['mine','money','lenders','lead','profile','income','expenses'].forEach(name=>{const orig=ui[name];if(typeof orig!=='function')return;ui[name]=function(){ypUseHome();return orig.apply(this,arguments);};});}
function ypOpenComingSoon(title){ypExclusive('yp-soon');ypUseHome();['yp-property-menu','yp-section-menu','yp-soon'].forEach(id=>{const el=document.getElementById(id);if(el)el.remove();});document.documentElement.classList.remove('yp-menu-open');const panel=document.createElement('div');panel.id='yp-soon';panel.setAttribute('role','dialog');panel.setAttribute('aria-label',title);const card=document.createElement('div');card.className='card';const head=document.createElement('div');head.className='hwh';const h=document.createElement('h2');h.textContent=title;head.appendChild(h);const shut=()=>{panel.remove();ypUseHome();};ypHeaderDismiss(head,shut);const note=document.createElement('p');note.textContent='Coming soon';const back=document.createElement('button');back.type='button';back.className='hwx';back.textContent='Back';back.addEventListener('click',shut);card.append(head,note,back);panel.appendChild(card);document.body.appendChild(panel);}
function ypOpenNavMenu(title,items,anchor){const menuId=title==='Property'?'yp-property-menu':'yp-section-menu';ypExclusive(menuId);['yp-property-menu','yp-section-menu','yp-soon'].forEach(id=>{const el=document.getElementById(id);if(el)el.remove();});const panel=document.createElement('div');panel.id=menuId;panel.dataset.section=title;panel.setAttribute('role','dialog');panel.setAttribute('aria-label',title);const shut=()=>{panel.remove();document.documentElement.classList.remove('yp-menu-open');if(!ypOpeningMap)ypUseHome();};panel.addEventListener('click',event=>{if(event.target===panel)shut();});const card=document.createElement('div');card.className='card';card.addEventListener('click',event=>event.stopPropagation());card.appendChild(ypCardHeader({title,onClose:shut}));items.forEach(item=>{const btn=document.createElement('button');btn.type='button';btn.className='yp-menu-item';btn.dataset.label=item.label;btn.textContent=item.label;if(item.id)btn.id=item.id;btn.addEventListener('click',()=>{shut();if(item.run)item.run();else ypOpenComingSoon(item.label);});card.appendChild(btn);});const notch=document.createElement('i');notch.className='yp-notch';notch.setAttribute('aria-hidden','true');card.appendChild(notch);panel.appendChild(card);document.body.appendChild(panel);document.documentElement.classList.add('yp-menu-open');const tabBtn=anchor||ypNavButton(title);ypPlaceNavMenu(card,tabBtn);ypMarkNav(tabBtn);return panel;}
function ypOpenPropertyOptions(anchor){ypOpenNavMenu('Property',[{label:'Property Owned',id:'yp-prop-owned',run:()=>{const ui=ypGameUI();if(ui&&ui.mine)ui.mine();else ypOpenComingSoon('Property Owned');}},{label:'Living Arrangements',id:'yp-prop-living',run:ypOpenLivingArrangement},{label:'Pending Offers',id:'yp-pending-offers',run:ypOpenPendingOffers},{label:'Property History',id:'yp-property-history-open',run:()=>ypShowPropertyHistory()}],anchor);}
function ypOpenRealitySnap(){ypExclusive('yp-living');ypUseHome();['yp-living','yp-property-menu','yp-section-menu','yp-soon'].forEach(id=>{const el=document.getElementById(id);if(el)el.remove();});document.documentElement.classList.remove('yp-menu-open');const f=n=>typeof fmt==='function'?fmt(n):'$'+Math.round(n).toLocaleString();let gross=0,tax=0,expMo=0,debtMo=0,power=0,rep=0,netMo=0,outMo=0,set=false;try{const i=INC();set=!!i.set;gross=ownGross(i);tax=taxNet(gross)+medicare(gross);expMo=i.exp||0;debtMo=i.debt||0;netMo=(gross-tax)/12;outMo=Math.max(hemMo(gross),expMo)+debtMo;const ar=CFG.rateIP+BANK.buffer,n=BANK.termY*12,surplus=netMo-outMo,svc=Math.max(0,surplus*annuity(ar,n)),dti=Math.max(0,BANK.dti*gross);power=Math.floor(Math.min(svc,dti)/1000)*1000;rep=power>0?power/annuity(CFG.rateIP,n):0;}catch(e){}const wk=gross/52,twk=tax/52,take=wk-twk,livWk=expMo*12/52,debtWk=debtMo*12/52,left=take-livWk-debtWk,leftMo=netMo-outMo;const rows=[{label:'Your salary',hint:'Salary band you chose, can edit!',value:f(gross)+' p.a.'},{label:'Pay',hint:'Each week, before tax',value:f(wk)},{label:'Tax and Medicare',hint:'Taken out each week',value:'-'+f(twk)},{label:'Take-home pay',hint:'Each week, after tax',value:f(take)},{label:'Living costs',hint:'Your own expenses, '+f(expMo)+' a month',value:'-'+f(livWk)}];if(debtMo>0)rows.push({label:'Other debts',hint:'Your own repayments, '+f(debtMo)+' a month',value:'-'+f(debtWk)});rows.push({label:'Left each week',hint:'What you would have spare',value:f(left)},{label:'Monthly income',hint:'After tax',value:f(netMo)},{label:'Monthly expenses',hint:'The bank uses the higher of yours and its minimum',value:f(outMo)},{label:'Left over',hint:'Each month',value:f(leftMo)},{label:'You could borrow about',hint:'Repayments '+f(rep)+'/mo',value:f(power)});try{if(typeof bank==='function'){const gp=bank().power,d=gp-power;rows.push({label:'Game borrowing power',hint:(()=>{const k=n=>Math.round(n/1000).toLocaleString()+'k',sal=typeof GAME_SALARY!=='undefined'?GAME_SALARY:100000;return (d===0?'Same':'$'+k(Math.abs(d))+(d>0?' more':' less'))+', @'+k(sal)+' salary';})(),value:f(gp)});}}catch(e){}const panel=document.createElement('div');panel.id='yp-living';panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','yp-rsnap-title');ypMountRecordCard(panel,{title:'Reality Snap',titleId:'yp-rsnap-title',closeId:'yp-rsnap-x',closeBtnId:'yp-rsnap-close',rows,onClose:()=>ypUseHome()});document.body.appendChild(panel);}
function ypOpenIncomeExpenses(){ypExclusive('yp-living');ypUseHome();['yp-living','yp-property-menu','yp-section-menu'].forEach(id=>{const el=document.getElementById(id);if(el)el.remove();});document.documentElement.classList.remove('yp-menu-open');const f=n=>typeof fmt==='function'?fmt(n):'$'+Math.round(n).toLocaleString();const gross=typeof GAME_SALARY!=='undefined'?GAME_SALARY:100000;const wk=gross/52;let tax=0,liv=0,rent=0,h='',chosen=true;try{tax=(taxNet(gross)+medicare(gross))/52;liv=livingMo()*12/52;rent=myRentWk();h=housing();chosen=!!G.homeChosen;}catch(e){}let active=null;try{active=(typeof ypActiveTenancy==='function'?ypActiveTenancy():null)||(ypReadStock().rentals||[]).find(r=>r&&r.status==='active'&&r.bondCharged)||null;}catch(e){}const covered=chosen&&h!=='family'&&h!=='home';if(active&&!covered)rent=Math.round(+active.weeklyRent||0);const renting=!!active||covered;const take=wk-tax,left=take-liv-rent;const rentLabel=renting?'Rent':h==='home'?'Rent':'Board';const rentHint=renting?'Your weekly rent':h==='home'?'You own your home':h==='family'?'Room share board, set by the owner':(rent>0?'No home yet, so you pay board':'No home chosen yet');const rows=[{label:'Game Salary',hint:'Before tax, the same for everyone',value:f(gross)+' p.a.'},{label:'Pay',hint:'Each week, before tax',value:f(wk)},{label:'Tax and Medicare',hint:'Taken out each week',value:'-'+f(tax)},{label:'Take-home pay',hint:'Each week, after tax',value:f(take)},{label:'Living costs',hint:'The same for everyone, '+f(typeof GAME_EXP_MO!=='undefined'?GAME_EXP_MO:400*52/12)+' a month',value:'-'+f(liv)},{label:rentLabel,hint:rentHint,value:rent>0?'-'+f(rent):f(0)},{label:'Left each week',hint:'Goes into your bank',value:f(left)}];const panel=document.createElement('div');panel.id='yp-living';panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','yp-incexp-title');ypMountRecordCard(panel,{title:'Game Budget',titleId:'yp-incexp-title',closeId:'yp-incexp-x',closeBtnId:'yp-incexp-close',rows,onClose:()=>ypUseHome()});document.body.appendChild(panel);}
function ypOpenFinancesMenu(anchor){ypOpenNavMenu('Finances',[{label:'Game Budget',run:ypOpenIncomeExpenses},{label:'Game Borrowing Power',run:()=>{const ui=ypGameUI();if(ui&&ui.lenders)ui.lenders();else ypOpenComingSoon('Game Borrowing Power');}},{label:'Reality Snap',run:ypOpenRealitySnap}],anchor);}
function ypOpenListingMap(kind){ypExclusive(null);ypOpeningMap=true;ypCloseSheets();['yp-property-menu','yp-section-menu','yp-soon','yp-history','yp-pending','yp-rent-detail','yp-rent-list','yp-prop'].forEach(id=>{const el=document.getElementById(id);if(el)el.remove();});document.documentElement.classList.remove('yp-menu-open');ypMarkNav(ypNavButton('Listings'));const open=()=>{ypLoadCentre();if(ypMap){try{if(window.__ypMapView&&Number.isFinite(+window.__ypMapView.lon))ypMap.jumpTo({center:[+window.__ypMapView.lon,+window.__ypMapView.lat],zoom:Number.isFinite(+window.__ypMapView.zoom)?+window.__ypMapView.zoom:ypMap.getZoom()});else ypCentreChosen();if(ypMap.resize)ypMap.resize();}catch(e){}}if(kind==='rent'&&window.__ypListCentre){ypApplyPlacePins();ypSyncRentalMarkers();}else if(!window.__ypListCentre)ypShowWherePopup();};ypUseMap().then(open,open);}
function ypOpenListingsMenu(anchor){ypOpenNavMenu('Listings',[{label:'For Sale',run:()=>ypOpenListingMap('sale')},{label:'Auctions',run:()=>ypOpenListingMap('auction')},{label:'For Rent',id:'yp-cat-rent',run:()=>ypOpenListingMap('rent')},{label:'Room Share',run:()=>ypOpenListingMap('room')},{label:'Boarding',run:()=>ypOpenListingMap('family')}],anchor||ypNavButton('Listings'));}
function ypOpenLeaderboardMenu(anchor){ypOpenNavMenu('Leaderboard',[{label:'Global Rankings',run:()=>{const ui=ypGameUI();if(ui&&ui.lead)ui.lead();else ypOpenComingSoon('Global Rankings');}}],anchor);}
function ypDropPrefixed(store,prefix){if(!store)return;const keys=[];for(let i=0;i<store.length;i++)keys.push(store.key(i));keys.forEach(key=>{if(key&&key.indexOf(prefix)===0)store.removeItem(key);});}
function ypStartFresh(){window.NOSAVE=1;try{NOSAVE=1;}catch(e){}window.onbeforeunload=null;const prefix=window.__ypPreviewNs||'yppreview-406b69525cf5-test.';const frame=document.createElement('iframe');frame.hidden=true;document.documentElement.appendChild(frame);try{const win=frame.contentWindow;ypDropPrefixed(win&&win.localStorage,prefix);ypDropPrefixed(win&&win.sessionStorage,prefix);}finally{frame.remove();}try{localStorage.clear();}catch(e){}const idb=window.indexedDB&&indexedDB.databases?indexedDB.databases().then(list=>(list||[]).filter(db=>db&&db.name&&db.name.indexOf(prefix)===0)):Promise.resolve([]);const cachesGone=window.caches&&caches.keys?caches.keys().then(names=>Promise.all(names.filter(name=>name.indexOf(prefix)===0).map(name=>caches.delete(name)))):Promise.resolve();const workers=navigator.serviceWorker&&navigator.serviceWorker.getRegistrations?navigator.serviceWorker.getRegistrations().then(regs=>Promise.all(regs.filter(reg=>(reg.scope||'').indexOf('/preview-406b69525cf5-test/')!==-1).map(reg=>reg.unregister()))):Promise.resolve();return Promise.all([idb.then(list=>Promise.all(list.map(db=>new Promise(resolve=>{const req=indexedDB.deleteDatabase(db.name);req.onsuccess=req.onerror=req.onblocked=()=>resolve();})))),cachesGone,workers]).then(ypGoFresh,ypGoFresh);}
function ypGoFresh(){location.replace(location.pathname);}
function ypOpenStartFresh(){ypExclusive('yp-start-fresh');const old=document.getElementById('yp-start-fresh');if(old)old.remove();const panel=document.createElement('div');panel.id='yp-start-fresh';panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','yp-start-fresh-title');const card=document.createElement('div');card.className='card';const shut=()=>{panel.remove();ypUseHome();};const head=ypCardHeader({title:'Start fresh',titleId:'yp-start-fresh-title',id:'yp-start-fresh-x',onClose:shut});const copy=document.createElement('p');copy.id='yp-start-fresh-copy';copy.textContent='This deletes your saved game on this device and starts again from the beginning.';const go=document.createElement('button');go.type='button';go.className='yp-danger';go.id='yp-start-fresh-go';go.textContent='Delete and start fresh';go.addEventListener('click',()=>{go.disabled=true;ypStartFresh();});const cancel=document.createElement('button');cancel.type='button';cancel.className='yp-cancel';cancel.id='yp-start-fresh-cancel';cancel.textContent='Cancel';cancel.addEventListener('click',shut);card.append(head,copy,go,cancel);panel.appendChild(card);document.body.appendChild(panel);ypUseHome();}
function ypOpenSettingsMenu(anchor){ypOpenNavMenu('Settings',[{label:'Profile',run:()=>{const ui=ypGameUI();if(ui&&ui.profile)ui.profile();else ypOpenComingSoon('Profile');}},{label:'Income',run:()=>{const ui=ypGameUI();if(ui&&ui.income)ui.income();else ypOpenComingSoon('Income');}},{label:'Expenses',run:()=>{const ui=ypGameUI();if(ui&&ui.expenses)ui.expenses('profile');else ypOpenComingSoon('Expenses');}},{label:'Budget'},{label:ypTestClockOn()?'Test option: fast clock on':'Test option: fast clock',id:'yp-settings-clock',run:()=>ypSetTestClock(!ypTestClockOn())},{label:'Start fresh',id:'yp-settings-fresh',run:ypOpenStartFresh}],anchor);}
function ypInstallBottomNav(){const nav=document.querySelector('nav');if(!nav||nav.dataset.ypNav)return;const by=v=>nav.querySelector('button[data-v="'+v+'"]');const specs=[{btn:by('mine'),label:'Property',open:ypOpenPropertyOptions},{btn:by('sale'),label:'Finances',open:ypOpenFinancesMenu},{btn:by('map'),label:'Listings',open:ypOpenListingsMenu},{btn:by('shop'),label:'Leaderboard',open:ypOpenLeaderboardMenu},{btn:by('profile'),label:'Settings',open:ypOpenSettingsMenu}];if(specs.some(s=>!s.btn))return;nav.dataset.ypNav='1';specs.forEach(spec=>{spec.btn.onclick=event=>{if(event)event.preventDefault();const open=document.getElementById('yp-property-menu')||document.getElementById('yp-section-menu');if(open&&open.dataset.section===spec.label){open.remove();document.documentElement.classList.remove('yp-menu-open');ypUseHome();return;}ypCloseSheets();spec.open(spec.btn);};});}


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
  const response=await fetch('config.json',{cache:'no-store'});
  if(!response.ok)throw Error('config');
  const body=await response.json();
  key=typeof body.key==='string'?body.key.trim():'';
  geoapifyKey=typeof body.geoapifyKey==='string'?body.geoapifyKey.trim():'';
  if(!key||key==='MAPTILER_KEY')key='';
  if(!geoapifyKey||geoapifyKey==='GEOAPIFY_KEY')geoapifyKey='';
 }catch{key='';geoapifyKey='';}
 ypGeoKey=geoapifyKey;
 ypHasTiles=!!key;
 ypWireWhere();
 const tiles=ypHasTiles;
 if(!tiles)ypStatusPanel('Map tiles need a key on this computer, so the basemap imagery stays empty. The old map is not used.');
 try{await ypLoadMapLibre();}catch(e){ypStatusPanel('The map library did not load. The old map is not used.');return;}
 if(!window.maplibregl){ypStatusPanel('The map library did not load. The old map is not used.');return;}
 ypRecord=ypReadSelection();
 const box=document.getElementById('ypbasemap');
 const blank={version:8,sources:{},layers:[{id:'bg',type:'background',paint:{'background-color':'#d7e0ea'}}]};
 const savedView=window.__ypMapView;ypMap=new maplibregl.Map({container:box,style:tiles?'https://api.maptiler.com/maps/base-v4/style.json':blank,center:savedView&&Number.isFinite(+savedView.lon)?[+savedView.lon,+savedView.lat]:(window.__ypListCentre&&Number.isFinite(+window.__ypListCentre.lon)?[+window.__ypListCentre.lon,+window.__ypListCentre.lat]:null)||(window.__ypPlace&&window.__ypPlace.center)||ypRecord?.coordinate||YP_DEMO,zoom:savedView&&Number.isFinite(+savedView.zoom)?+savedView.zoom:((window.__ypListCentre||window.__ypPlace)?13:12),maxZoom:20,minZoom:3,maxPitch:0,renderWorldCopies:false,attributionControl:false,transformRequest(url){if(ypTilesHold&&/maptiler\.com|openstreetmap\.org/i.test(String(url)))return {url:'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'};const u=new URL(url,location.href);if(tiles&&u.hostname==='api.maptiler.com'){u.searchParams.set('key',key);return {url:u.href};}return {url};}});
 window.__ypMap=ypMap;
 ypMap.addControl(new maplibregl.NavigationControl({showCompass:false}));
 ypMap.addControl(new maplibregl.AttributionControl({compact:false,customAttribution:(tiles?'<a href="https://www.maptiler.com/copyright/">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>':'Sample pins only. Basemap tiles were not loaded.')+' '+YP_SUBURB_CREDIT}));
 ypMap.on('error',()=>{if(ypMapFailed)return;ypMapFailed=true;ypFoot('Map resource error (details suppressed). Check the key, allowed origins, quota or network, then reload. No buildings were invented.');});
 const applyLabels=()=>ypApplyLabelPolicy(ypMap);
 ypMap.on('style.load',applyLabels);
 ypMap.on('load',()=>{
  if(ypTilesHold)ypAbortMapRequests();
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
  ypMap.addSource('yp-rentals',{type:'geojson',data:ypEmpty(),cluster:true,clusterRadius:48,clusterMaxZoom:13});
  ypMap.addLayer({id:'yp-rental-cluster',type:'circle',source:'yp-rentals',filter:['has','point_count'],paint:{'circle-color':'#0a3a8c','circle-radius':18,'circle-opacity':.9}});
  const glyphStyle=ypMap.getStyle()||{};
  if(glyphStyle.glyphs){const sample=(glyphStyle.layers||[]).find(l=>l.layout&&l.layout['text-font']);const textFont=sample?sample.layout['text-font']:['Open Sans Regular'];ypMap.addLayer({id:'yp-rental-count',type:'symbol',source:'yp-rentals',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-size':12,'text-font':textFont},paint:{'text-color':'#fff'}});}
  const pinBlue=getComputedStyle(document.documentElement).getPropertyValue('--navy2').trim();
  const pinShade=getComputedStyle(document.documentElement).getPropertyValue('--navy').trim();
  const pinRadius=['interpolate',['linear'],['zoom'],15,9,17,5];
  ypMap.addLayer({id:'yp-rental-shadow',type:'circle',source:'yp-rentals',filter:['!',['has','point_count']],paint:{'circle-color':pinShade,'circle-radius':['interpolate',['linear'],['zoom'],15,12,17,7],'circle-blur':0.45,'circle-opacity':0.28,'circle-translate':[0,1]}});
  ypMap.addLayer({id:'yp-rental-point',type:'circle',source:'yp-rentals',filter:['!',['has','point_count']],paint:{'circle-color':pinBlue,'circle-radius':pinRadius,'circle-stroke-width':2,'circle-stroke-color':'#fff'}});
  ypMap.addSource('yp-listing-homes',{type:'geojson',data:ypEmpty()});
  ypMap.addLayer({id:'yp-listing-fill',type:'fill',source:'yp-listing-homes',minzoom:15,paint:{'fill-color':pinBlue,'fill-opacity':0.92}});
  ypMap.addLayer({id:'yp-listing-line',type:'line',source:'yp-listing-homes',minzoom:15,paint:{'line-color':'#fff','line-width':2}});
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
 let ypTouchStart=null;
 ypMap.on('touchstart',e=>{const p=e.point;ypTouchStart=p?{x:p.x,y:p.y}:null;});
 ypMap.on('touchend',e=>{if(!ypTouchStart||!e.point)return;const dx=e.point.x-ypTouchStart.x,dy=e.point.y-ypTouchStart.y;ypTouchStart=null;if(dx*dx+dy*dy>64)return;ypOpenListingTap(e);});
 ypMap.on('moveend',()=>{if(!ypReady)return;try{const c=ypMap.getCenter();window.__ypMapView={lon:+Number(c.lng).toFixed(6),lat:+Number(c.lat).toFixed(6),zoom:+ypMap.getZoom()};ypSaveCentre();}catch(e){}ypSyncRentalMarkers();});
 ypMap.on('idle',()=>{if(ypReady)ypRematch();});
 ypMap.on('click',e=>{
  if(ypOpenListingTap(e))return;
  if(window.__ygHandlesMapClick)return;
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
let ypStartHandoff=false;
function ypInstallHandoff(){
 if(window.__ypHandoff)return;window.__ypHandoff=1;
 if(typeof listOpen==='function'){const orig=listOpen;window.listOpen=function(){if(ypStartHandoff)return;ypExclusive('listings');const result=orig.apply(this,arguments);ypArmListings();return result;};}
 if(typeof hwSummary==='function'){const orig=hwSummary;window.hwSummary=function(){if(ypStartHandoff)return;return orig.apply(this,arguments);};}
 if(typeof statusDone==='function'){const orig=statusDone;window.statusDone=function(kind){ypStartHandoff=true;let result;try{result=orig.apply(this,arguments);}finally{ypStartHandoff=false;}ypInstallBottomNav();if(kind==='rent')ypOpenListingMap('rent');return result;};}
 if(ypGameUI()&&typeof UI.sale==='function')UI.sale=function(){ypOpenListingsMenu();};
}
function ypShowWherePopup(){
 ypExclusive('yp-where');
 if(document.getElementById('yp-where'))return;
 const wrap=document.createElement('div');wrap.id='yp-where';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-labelledby','yp-where-title');
 const card=document.createElement('div');card.className='card';
 const head=document.createElement('div');head.className='hwh';
 const title=document.createElement('h2');title.id='yp-where-title';title.textContent='Choose location';
 head.appendChild(title);ypHeaderDismiss(head,ypCloseWhere);
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
 if(typeof G!=='undefined'&&G&&!G.homeChosen)G.placeName=label;
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
function ypOpenListingsChoice(){ypExclusive('yp-prop');
 ypCloseWhere();
 document.getElementById('yp-rent-list')?.remove();
 document.getElementById('yp-rent-detail')?.remove();
 let panel=document.getElementById('yp-prop');if(panel)panel.remove();
 panel=document.createElement('div');panel.id='yp-prop';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Listings');
 const card=document.createElement('div');card.className='card';
 const head=document.createElement('div');head.className='hwh';
 const title=document.createElement('h2');title.textContent='Listings';head.appendChild(title);ypHeaderDismiss(head,()=>panel.remove());
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
 const title=document.createElement('h2');title.textContent=titles[kind];head.appendChild(title);ypHeaderDismiss(head,ypOpenListingsChoice);
 const copy=document.createElement('p');copy.id='yp-prop-note';copy.textContent=ypPlaceLine()+' '+empty[kind];
 const back=document.createElement('button');back.type='button';back.id='yp-cat-back';back.className='hwx';back.textContent='Back';
 back.addEventListener('click',ypOpenListingsChoice);
 card.append(head,copy,back);
}
if(typeof weekTick==='function'&&!weekTick.__ypRent){const origWeek=weekTick;const wrapped=function(){const board=typeof G!=='undefined'&&G&&G.clockOn&&!G.homeChosen&&!(G.lease&&G.lease.id)&&typeof NOHOME_BOARD==='number'?NOHOME_BOARD:0;const out=origWeek.apply(this,arguments);try{ypSettleSampleWeek(board);}catch(e){}return out;};wrapped.__ypRent=1;weekTick=wrapped;}
if(typeof openNotif==='function'&&!openNotif.__yp){const origNotif=openNotif;const wrappedNotif=function(i){const n=G.notifs&&G.notifs[i];if(n&&n.ypRental){n.read=true;if(typeof save==='function')save();if(typeof badge==='function')badge();const other=document.getElementById('yp-where')||document.getElementById('yp-prop');if(!other)ypOpenRentalDetail(n.ypRental);return;}return origNotif.apply(this,arguments);};wrappedNotif.__yp=1;openNotif=wrappedNotif;}
ypInstallBottomNav();
window.ypChooseTown=ypChooseTown;
window.ypSearchArea=ypSearchArea;
window.ypEnterRealMap=ypEnterRealMap;
window.ypDistanceM=ypDistanceM;
window.ypDestination=ypDestination;
window.ypOpenRentalDetail=ypOpenRentalDetail;

/* Bottom nav: a tab is only highlighted while its menu, card or listing map is open */
function ypOverlayOpen(){if(document.body&&document.body.classList.contains('sheetopen'))return true;const open=['yp-history','yp-history-detail','yp-living','yp-apply-review','yp-rent-detail','yp-rent-list','yp-pending','yp-soon','yp-where','yp-prop','yp-property-menu','yp-section-menu','listings','hwov','yp-away','yp-start-fresh'].some(i=>{const e=document.getElementById(i);return e&&e.getClientRects().length>0;});return open||!!document.querySelector('.sheet.open');}
function ypSyncNav(){if(!document.documentElement.classList.contains('yp-home')||ypOverlayOpen())return;document.querySelectorAll('nav button.on').forEach(b=>b.classList.remove('on'));}
/* Home feed: one running event stream, newest first by game time. Each event is a property listed for sale or sold, on Overture overlay ids (ypb...) with type-based game estimates.
   Events persist in the test save (yp.homeFeed.v1). Real game events call ypFeedEvent(); seeded sample events (sample:true) fill each game day until real ones exist. Dummy sponsored slots every 4 rows. */
const YP_FEED_KEY='yp.homeFeed.v1';
const YP_FEED_ADS=[{name:'Coralwood Home Loans',line:'Local mortgage broker. Compare home loans in one chat.',tag:'Finance',icon:'$'},{name:'Lanternbark Pest Spraying',line:'Termite and general pest spraying for local homes.',tag:'Pest control',icon:'✱'}];
const YP_FEED_TYPES={home:'Residential',trade:'Commercial',other:'Other building'};
const YP_FEED_FALLBACK={lon:152.348,lat:-24.8665};/* centre of the registry snapshot's requested bbox */
let ypFeedManifest=null,ypFeedSeeding=false;const ypFeedChunks=new Map();
function ypFeedRead(){try{const o=JSON.parse(localStorage.getItem(YP_FEED_KEY)||'null');if(o&&o.version===1&&Array.isArray(o.events)&&Array.isArray(o.seeded))return o;}catch(e){}return {version:1,events:[],seeded:[]};}
function ypFeedWrite(o){o.events.sort((a,b)=>b.gameMs-a.gameMs);o.events.length=Math.min(o.events.length,200);o.seeded=o.seeded.slice(-30);/* keeps the newest 200 events */try{localStorage.setItem(YP_FEED_KEY,JSON.stringify(o));}catch(e){}}
function ypFeedNow(){const c=ypReadClock();return {ms:ypGameMs(c),dayMs:c.weekMs/7};}
/* Add one event and show it at once. ev: {kind:'listed'|'sold', id:'ypb-...', price, tone, area, lon, lat, gameMs?, by?, sample?} */
function ypFeedEvent(ev){if(!ev||!ev.id||(ev.kind!=='listed'&&ev.kind!=='sold'))return;const o=ypFeedRead();const gameMs=Number.isFinite(+ev.gameMs)?+ev.gameMs:ypFeedNow().ms;const key=ev.key||ev.kind+'|'+ev.id+'|'+gameMs;if(o.events.some(e=>e.key===key))return;o.events.push({...ev,key,gameMs,sample:!!ev.sample});ypFeedWrite(o);const feed=document.getElementById('yp-feed');if(feed)feed.dataset.key='';ypSyncFeed();}
window.ypFeedEvent=ypFeedEvent;
function ypFeedCentre(){const home=typeof ypActiveTenancy==='function'?ypActiveTenancy():null;if(home&&Number.isFinite(+home.lon)&&Number.isFinite(+home.lat))return {lon:+home.lon,lat:+home.lat};if(typeof ypLoadCentre==='function')ypLoadCentre();let cam=null;try{cam=JSON.parse(localStorage.getItem('yp.camera.v1')||'null');}catch(e){}const c=[window.__ypPlace,window.__ypListCentre,window.__ypMapView,cam].find(o=>o&&Number.isFinite(+o.lon)&&Number.isFinite(+o.lat))||YP_FEED_FALLBACK;return {lon:+c.lon,lat:+c.lat};}
async function ypFeedChunk(id){if(!ypFeedChunks.has(id))ypFeedChunks.set(id,await (await fetch('data/chunks/'+id+'.json')).json());return ypFeedChunks.get(id);}
async function ypFeedNear(c){if(!ypFeedManifest)ypFeedManifest=await (await fetch('data/chunk-manifest.json')).json();const gap=k=>Math.max(0,k.bbox[0]-c.lon,c.lon-k.bbox[2])+Math.max(0,k.bbox[1]-c.lat,c.lat-k.bbox[3]);const near=ypFeedManifest.chunks.filter(k=>gap(k)<0.02).sort((x,y)=>gap(x)-gap(y)).slice(0,4);const out=[];for(const k of near){((await ypFeedChunk(k.id)).features||[]).forEach(f=>{const p=f.properties||{};if(!p.adopted||p.eligible!==true||!Number.isInteger(p.estimate)||!YP_FEED_TYPES[p.tone]||!p.gameId)return;const ring=ypOuterRings(f.geometry)[0];const pt=ring&&ypFootprintPoint(ring);if(pt)out.push({id:p.gameId,tone:p.tone,estimate:p.estimate,area:Math.round(ypRingAreaM2(ring)),lon:+pt.lon.toFixed(6),lat:+pt.lat.toFixed(6),d:ypDistanceM(c.lon,c.lat,pt.lon,pt.lat)});});if(out.filter(x=>x.d<3000).length>=40)break;}return out.sort((x,y)=>x.d-y.d||(x.id<y.id?-1:1)).slice(0,120);}
/* Dummy sample events for testing: eight per game day (four sales, four listings) at fixed game times, for the last 7 game days, so the feed has about 50 rows. They only appear once their game time has passed. A property is never used twice. They do not change game ownership. */
const YP_FEED_SLOTS=['sold','listed','listed','sold','listed','sold','sold','listed'];
async function ypFeedSeed(){const now=ypFeedNow(),day=Math.floor(now.ms/now.dayMs);const o=ypFeedRead();const days=[];for(let d=day-6;d<=day;d++)if(!o.seeded.includes(d))days.push(d);if(!days.length||ypFeedSeeding)return false;ypFeedSeeding=true;try{const rented=new Set((ypReadStock().rentals||[]).map(r=>r.footprintId).filter(Boolean));const pool=(await ypFeedNear(ypFeedCentre())).filter(x=>!rented.has(x.id));const fresh=ypFeedRead();const used=new Set(fresh.events.map(e=>e.id));days.forEach(d=>{if(fresh.seeded.includes(d))return;YP_FEED_SLOTS.forEach((kind,k)=>{const pick=pool.filter(x=>!used.has(x.id)).sort((a,b)=>hash(a.id+'|'+kind+'|'+d+'|'+k)-hash(b.id+'|'+kind+'|'+d+'|'+k))[0];if(!pick)return;used.add(pick.id);const h=hash(pick.id+'|ypat|'+d);const price=kind==='sold'?Math.round(pick.estimate*(.95+.08*h)/1000)*1000:pick.estimate;const gameMs=Math.round((d+(k+h)/YP_FEED_SLOTS.length)*now.dayMs);fresh.events.push({key:'sample|'+kind+'|'+pick.id+'|'+d,kind,id:pick.id,price,tone:pick.tone,area:pick.area,lon:pick.lon,lat:pick.lat,gameMs,sample:true});});fresh.seeded.push(d);});ypFeedWrite(fresh);return true;}catch(e){return false;}finally{ypFeedSeeding=false;}}
function ypFeedIcon(tone){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',{home:'M12 3 2 12h3v8h5v-5h4v5h5v-8h3z',trade:'M3 4h18l1 5c0 1.7-1.3 3-3 3s-3-1.3-3-3c0 1.7-1.3 3-3 3s-3-1.3-3-3c0 1.7-1.3 3-3 3s-3-1.3-3-3l1-5zm2 9.5V20h14v-6.5c-.6.3-1.3.5-2 .5v4H7v-4c-.7 0-1.4-.2-2-.5z',other:'M4 21V5l8-3 8 3v16h-6v-5h-4v5zm4-13v2h2V8zm6 0v2h2V8zm-6 4v2h2v-2zm6 0v2h2v-2z'}[YP_FEED_TYPES[tone]?tone:'other']);svg.appendChild(path);return svg;}
function ypFeedRow(ev){const row=document.createElement('div');row.className='yp-feed-row';row.setAttribute('role','button');row.tabIndex=0;row.dataset.id=ev.id;const pic=document.createElement('span');pic.className='yp-feed-pic';const badge=document.createElement('span');badge.className='yp-feed-badge yp-feed-badge--'+(ev.kind==='sold'?'sold':'sale');badge.textContent=ev.kind==='sold'?'SOLD':'FOR SALE';pic.append(ypFeedIcon(ev.tone),badge);const info=document.createElement('span');info.className='yp-feed-info';const when=document.createElement('span');when.className='yp-feed-tag';when.textContent=ypEventClockLabel({gameMs:ev.gameMs});const price=document.createElement('span');price.className='yp-feed-price';price.textContent=fmt(ev.price);const meta=document.createElement('span');meta.className='yp-feed-meta';meta.textContent=[YP_FEED_TYPES[ev.tone]||'Building',ev.area?Number(ev.area).toLocaleString()+' m²':'',ev.by?'Bought by '+ev.by:'',ev.sample?'Game sample':''].filter(Boolean).join(' · ');const id=document.createElement('span');id.className='yp-feed-id';const code=document.createElement('a');code.href='#';code.className='yp-link';code.textContent=ypPublicCode(ev.id);code.dataset.ypCode=ev.id;code.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();ypGoToProperty(ev);});id.appendChild(code);info.append(when,price,meta,id);row.append(pic,info);row.addEventListener('click',()=>ypGoToProperty(ev));row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();ypGoToProperty(ev);}});return row;}
function ypFeedAd(ad){const row=document.createElement('button');row.type='button';row.className='yp-feed-row yp-feed-ad';const pic=document.createElement('span');pic.className='yp-feed-pic';pic.textContent=ad.icon;const info=document.createElement('span');info.className='yp-feed-info';const tag=document.createElement('span');tag.className='yp-feed-tag';tag.textContent='Sponsored · '+ad.tag;const name=document.createElement('span');name.className='yp-feed-price';name.textContent=ad.name;const line=document.createElement('span');line.className='yp-feed-meta';line.textContent=ad.line;info.append(tag,name,line);row.append(pic,info);row.addEventListener('click',()=>{if(typeof toast==='function')toast('Ad placeholder');});return row;}
function ypRenderFeed(){ypFeedSeed().then(added=>{if(added)ypSyncFeed();});const now=ypFeedNow().ms;const events=ypFeedRead().events.filter(e=>e.gameMs<=now).slice(0,60);let feed=document.getElementById('yp-feed');const key=events.map(e=>e.key).join(',');if(feed&&feed.dataset.key===key)return;if(!feed){feed=document.createElement('div');feed.id='yp-feed';feed.setAttribute('aria-label','Home feed');document.body.appendChild(feed);}feed.dataset.key=key;const card=document.createElement('section');card.className='yp-feed-card';events.forEach((ev,i)=>{card.appendChild(ypFeedRow(ev));if((i+1)%4===0)card.appendChild(ypFeedAd(YP_FEED_ADS[((i+1)/4-1)%YP_FEED_ADS.length]));});feed.replaceChildren(...(events.length?[card]:[]));}
function ypSyncFeed(){const show=document.documentElement.classList.contains('yp-home')&&!document.getElementById('flow');if(show)ypRenderFeed();const feed=document.getElementById('yp-feed');if(feed)feed.hidden=!show||!feed.childElementCount;}
(function(){let t=0;const run=()=>{clearTimeout(t);t=setTimeout(()=>{ypSyncNav();ypSyncFeed();},60);};const go=()=>{new MutationObserver(run).observe(document.body,{childList:true,subtree:false,attributes:true,attributeFilter:['class']});new MutationObserver(run).observe(document.documentElement,{attributes:true,attributeFilter:['class']});document.addEventListener('click',run,true);setInterval(run,5000);run();};if(document.body)go();else document.addEventListener('DOMContentLoaded',go);})();
