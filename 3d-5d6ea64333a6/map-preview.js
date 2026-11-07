// Your Plot map preview. Verbatim tested helpers from auction-v3-1, then a game-owned selection adapter.
// Not a live release. No auction, valuation, address lookup, or c1 lot binding.
const pilotSuggest=(()=>{
const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const label=p=>[p.name||p.street||p.suburb||p.city||p.postcode,p.suburb,p.city,p.postcode,p.state,p.country].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ');
function areas(data,country,postcode){return (data.results||[]).filter(p=>['city','suburb','district','postcode'].includes(p.result_type)&&p.place_id&&!p.housenumber&&(!postcode||(p.postcode===postcode&&p.country_code==='au'))&&(!country||norm(p.country)===norm(country))).map(p=>({...p,label:label(p)}));}
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

function ypLocateView(lon,lat,accuracy){
 if(!Number.isFinite(lon)||!Number.isFinite(lat)||Math.abs(lon)>180||Math.abs(lat)>90)return null;
 const known=Number.isFinite(accuracy)&&accuracy>=0;
 const meters=known?Math.max(accuracy,8):600;
 const dLat=meters/110540,dLon=meters/(111320*Math.max(.2,Math.cos(lat*Math.PI/180)));
 return {center:[lon,lat],accuracy:known?accuracy:null,maxZoom:17,bounds:[[lon-dLon,lat-dLat],[lon+dLon,lat+dLat]],showCircle:known,meters:known?accuracy:null};
}
function ypAccuracyRing(lon,lat,meters){
 const ring=[],steps=32,dLat=meters/110540,dLon=meters/(111320*Math.max(.2,Math.cos(lat*Math.PI/180)));
 for(let i=0;i<=steps;i++){const b=2*Math.PI*i/steps;ring.push([lon+dLon*Math.sin(b),lat+dLat*Math.cos(b)]);}
 return ring;
}
function ypLocateError(code){return code===1?'denied':code===3?'timeout':'unavailable';}
function ypLocateMessage(status,view){
 const metres=view&&Number.isFinite(view.accuracy)?Math.round(view.accuracy):null;
 const rough=metres==null?'No accuracy was provided, so this is only a rough area.':'The shaded circle is about '+metres+' metres across.';
 const text={
  locating:'Finding this device. Nothing is saved.',
  found:'Map moved to this device. '+rough+' This is not an address, a house, or a game property. Loading this view requests map tiles from the map provider.',
  denied:'Location permission was denied. No further request was sent. Search for a town or suburb, or tap My Location again.',
  timeout:'Location timed out. No further request was sent. Search for a town or suburb, or tap My Location again.',
  unavailable:'Location is unavailable. Search for a town or suburb, or tap My Location again.',
  unsupported:'This browser cannot share location. Search for a town or suburb instead.',
  insecure:'This page is not a secure context, so location was not requested. Search for a town or suburb instead.'
 };
 return text[status]||text.unavailable;
}
function ypLocateSession(geo,isSecure){
 let generation=0,busy=false,closed=false;
 return {
  tap(done){
   if(closed)return {accepted:false,status:'closed'};
   if(busy)return {accepted:false,status:'locating'};
   if(!isSecure){done&&done({status:'insecure'});return {accepted:false,status:'insecure'};}
   if(!geo||typeof geo.getCurrentPosition!=='function'){done&&done({status:'unsupported'});return {accepted:false,status:'unsupported'};}
   const token=++generation;busy=true;let settled=false;
   const finish=payload=>{if(settled)return;settled=true;busy=false;if(closed||token!==generation)return;done&&done(payload);};
   try{geo.getCurrentPosition(pos=>{const c=pos&&pos.coords,view=c&&ypLocateView(c.longitude,c.latitude,c.accuracy);finish(view?{status:'found',view}:{status:'unavailable'});},err=>finish({status:ypLocateError(err&&err.code)}),{enableHighAccuracy:true,timeout:12000,maximumAge:0});}
   catch{finish({status:'unsupported'});}
   return {accepted:true,status:'locating'};
  },
  cancel(){generation++;busy=false;},
  close(){closed=true;generation++;busy=false;}
 };
}
// END TESTABLE LOCATE

/* Preview map adapter. Runs in the game page after the existing scripts. It does not change intro copy, finance, or c1 lot records. */
const YP_LIMIT='This highlight is one basemap footprint only. It is not a Your Plot lot, it has no game owner, and it has no game price. The saved id is a new UUID plus the click coordinate, not a vendor id and not a stable property identity.';
const YP_GAMELOT='This listing is an existing Coralwood game record. It is not a building on the basemap, so the camera was not moved and no real owner or price was created.';
const YP_STORE='yp.mapsel.v1';
const YP_DEMO=[152.348238,-24.865295];
const YP_CSS=`body.ypbasemap #rsearch{display:block;z-index:12;max-height:46vh;overflow:auto;background:rgba(255,255,255,.96);border-radius:14px;padding:8px 10px 10px;box-shadow:0 8px 24px rgba(11,37,69,.16)}
body.ypbasemap #rsq,body.ypbasemap #yp-country,body.ypbasemap #yp-street{display:block;width:100%;box-sizing:border-box;margin:6px 0 0}
body.sheetopen #rsearch{opacity:0;pointer-events:none}
#yp-search-note,#yp-geo-attr{font-size:11px;color:#3d4d63;line-height:1.35;margin:6px 0}
#yp-search-status{font-weight:600;font-size:13px;margin:6px 0;color:#14213d}
#yp-area-suggestions button,#yp-street-suggestions button{display:block;width:100%;text-align:left;background:#fff;border:1px solid #c5ced8;border-radius:8px;margin:4px 0;padding:8px;font:500 14px Inter,system-ui,sans-serif}
#yp-area-suggestions button[aria-selected=true],#yp-street-suggestions button[aria-selected=true]{background:#d8eafb}
#yp-foot{position:absolute;left:12px;right:68px;bottom:calc(78px + var(--sab));z-index:8;background:#fff;border-left:3px solid #b8410a;padding:8px 10px;border-radius:10px;font:500 12px/1.35 Inter,system-ui,sans-serif;color:#14213d;box-shadow:0 6px 16px rgba(11,37,69,.16)}
body.sheetopen #yp-foot{display:none}
#ypbasemap{position:absolute;inset:0;z-index:2;background:#e7eef5}
#yp-map-status{position:absolute;left:12px;right:76px;top:52%;z-index:4;background:#fff;color:#14213d;border-radius:14px;padding:12px;font:600 13px/1.4 Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(11,37,69,.18)}
#yp-logo{position:absolute;left:8px;bottom:6px;z-index:3}
#yp-logo img{width:88px;background:#ffffffc9;display:block}
html.yp-preview #w3dc,html.yp-preview #map canvas#w3dc,body.ypbasemap #w3dc{display:none!important;visibility:hidden!important;pointer-events:none!important}
body.ypbasemap #map .maplibregl-ctrl-attrib{font-size:10px;max-width:70vw}
#yp-locate{position:absolute;left:12px;bottom:calc(230px + var(--sab));z-index:11;min-width:44px;min-height:44px;padding:12px 16px;border:1px solid #9aa8b8;border-radius:12px;background:#fff;color:#14213d;font:700 15px/1.2 Inter,system-ui,sans-serif;box-shadow:0 6px 16px rgba(11,37,69,.16)}
#yp-locate:focus{outline:3px solid #0a3a8c;outline-offset:3px}
#yp-locate:focus-visible{outline:3px solid #0a3a8c;outline-offset:3px}
#yp-locate:disabled{opacity:.72}
#yp-locate-note,#yp-locate-status{position:absolute;left:12px;right:76px;z-index:11;margin:0;background:rgba(255,255,255,.96);color:#14213d;border-radius:10px;padding:8px 10px;font:500 12px/1.35 Inter,system-ui,sans-serif}
#yp-locate-note{bottom:calc(286px + var(--sab))}
#yp-locate-status{bottom:calc(348px + var(--sab))}
#yp-where{position:fixed;left:0;right:0;bottom:0;z-index:80;display:flex;justify-content:center;pointer-events:none;padding:12px 12px calc(92px + var(--sab))}
#yp-where .card{pointer-events:auto;width:min(420px,100%);max-height:46vh;overflow:auto;background:#fff;color:#14213d;border-radius:16px;padding:14px;box-shadow:0 12px 40px rgba(11,37,69,.28)}
#yp-where h2{margin:0 0 6px;font-size:18px}
#yp-where p,#yp-where-status{margin:6px 0;font-size:13px;line-height:1.35}
#yp-where input{display:block;width:100%;box-sizing:border-box;margin:8px 0;padding:10px;font:500 16px Inter,system-ui,sans-serif}
#yp-where button,#yp-properties,#yp-prop button{min-width:44px;min-height:44px;margin:4px 4px 0 0;padding:10px 14px;border-radius:12px;border:1px solid #9aa8b8;background:#fff;font:700 15px/1.2 Inter,system-ui,sans-serif}
#yp-where button:focus,#yp-where button:focus-visible,#yp-properties:focus,#yp-properties:focus-visible,#yp-prop button:focus,#yp-prop button:focus-visible{outline:3px solid #0a3a8c;outline-offset:3px}
#yp-where-suggestions button{display:block;width:100%;text-align:left}
#yp-properties{position:absolute;left:12px;bottom:calc(150px + var(--sab));z-index:46}
#yp-prop{position:fixed;inset:0;z-index:90;background:rgba(11,37,69,.35);display:flex;align-items:flex-end;justify-content:center;padding:12px 12px calc(92px + var(--sab))}
#yp-prop .card{width:min(420px,100%);background:#fff;color:#14213d;border-radius:16px;padding:14px}`;

(function ypBoot(){
 if(window.__ypMapBoot)return;window.__ypMapBoot=1;
 document.documentElement.classList.add('yp-preview');
 window.__ypBlockAutoLists=true;
 const prevBoot=window.W3D_BOOT;
 window.W3D_BOOT=function(){try{prevBoot&&prevBoot();}catch(e){console.error(e);}if(window.G&&G.started)ypEnterRealMap();};
 const prevStart=window.startView;
 if(typeof prevStart==='function')window.startView=function(){const r=prevStart.apply(this,arguments);ypEnterRealMap();return r;};
 if(window.W3D&&W3D.ready&&window.G&&G.started)ypEnterRealMap();
 ypInstallHandoff();
})();

function ypFoot(extra){const el=document.getElementById('yp-foot');if(!el)return;el.textContent=extra?extra+' '+YP_LIMIT:YP_LIMIT;}
function ypReadSelection(){try{return ypSelection(JSON.parse(localStorage.getItem(YP_STORE)||'null'));}catch{return null;}}
function ypWriteSelection(record){const body=ypPersistable(record);if(!body)return false;try{localStorage.setItem(YP_STORE,JSON.stringify(body));return true;}catch{return false;}}
function ypGameLotNote(){try{toast(YP_GAMELOT);}catch(e){ypFoot(YP_GAMELOT);}}

let ypMap,ypReady=false,ypRecord=null,ypBuildingLayers=[],ypHighlightSignature='',ypGeoKey='',ypMapFailed=false,ypEntered=false,ypLocateCtrl=null;
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
 if(window.maplibregl)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  if(!document.getElementById('yp-maplibre-css')){const css=document.createElement('link');css.id='yp-maplibre-css';css.rel='stylesheet';css.href='https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.css';document.head.appendChild(css);}
  const s=document.createElement('script');s.src='https://unpkg.com/maplibre-gl@5.6.2/dist/maplibre-gl.js';s.onload=()=>window.maplibregl?resolve():reject(new Error('library'));s.onerror=()=>reject(new Error('library'));document.head.appendChild(s);
 });
}
function ypMountChrome(){
 if(!document.getElementById('yp-preview-css')){const st=document.createElement('style');st.id='yp-preview-css';st.textContent=YP_CSS;document.head.appendChild(st);}
 document.body.classList.add('ypbasemap');
 const host=document.getElementById('map');
 let box=document.getElementById('ypbasemap');
 if(!box&&host){box=document.createElement('div');box.id='ypbasemap';host.appendChild(box);}
 if(!document.getElementById('yp-foot')){const foot=document.createElement('div');foot.id='yp-foot';foot.setAttribute('role','status');host.appendChild(foot);}
 if(host&&!document.getElementById('yp-properties')){const b=document.createElement('button');b.type='button';b.id='yp-properties';b.textContent='Properties';b.addEventListener('click',ypOpenPropChoice);host.appendChild(b);} 
}
function ypStatusPanel(text){const box=document.getElementById('ypbasemap');if(!box)return;let el=document.getElementById('yp-map-status');if(!el){el=document.createElement('div');el.id='yp-map-status';box.appendChild(el);}el.textContent=text;}
function ypClearStatusPanel(){const el=document.getElementById('yp-map-status');if(el)el.remove();}
function ypClearAccuracy(){const src=ypMap&&ypMap.getSource&&ypMap.getSource('yp-accuracy');if(src)src.setData(ypEmpty());}
function ypCancelLocate(){if(ypLocateCtrl)ypLocateCtrl.cancel();ypClearAccuracy();}
function ypApplyLocate(outcome){
 const status=document.getElementById('yp-locate-status');
 if(status)status.textContent=ypLocateMessage(outcome.status,outcome.view);
 if(outcome.status!=='found'||!outcome.view||!ypMap)return;
 if(outcome.view.showCircle){const src=ypMap.getSource('yp-accuracy');if(src)src.setData({type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[ypAccuracyRing(outcome.view.center[0],outcome.view.center[1],Math.max(outcome.view.accuracy,8))]}}]});}
 ypMap.fitBounds(outcome.view.bounds,{padding:48,maxZoom:outcome.view.maxZoom,animate:true});
}
function ypMountLocate(){
 if(document.getElementById('yp-locate'))return;
 const host=document.getElementById('map');if(!host)return;
 const btn=document.createElement('button');btn.type='button';btn.id='yp-locate';btn.textContent='My Location';btn.setAttribute('aria-describedby','yp-locate-note');
 const note=document.createElement('p');note.id='yp-locate-note';note.textContent='One tap asks this browser for this device. The map provider still receives the view it loads. This is not an address.';
 const status=document.createElement('p');status.id='yp-locate-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
 host.append(btn,note,status);
 const secure=window.isSecureContext===true;
 ypLocateCtrl=ypLocateSession(secure&&navigator.geolocation?navigator.geolocation:null,secure);
 btn.addEventListener('click',()=>{
  const res=ypLocateCtrl.tap(outcome=>{btn.disabled=false;btn.removeAttribute('aria-busy');ypApplyLocate(outcome);});
  if(res.accepted){btn.disabled=true;btn.setAttribute('aria-busy','true');status.textContent=ypLocateMessage('locating');}
 });
 window.addEventListener('pagehide',()=>{if(ypLocateCtrl)ypLocateCtrl.close();},{once:true});
}

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
 const note=document.createElement('p');note.id='yp-search-note';note.textContent='After 3 characters and a short pause, the town, suburb or postcode and the street text are sent to Geoapify. Choosing a suggestion is deliberate. This is not anonymous: Geoapify receives the partial text and the connection. Search does not ask for device location. My Location does, only when you tap it, and the map provider receives the view it loads. Searches are not saved. MapTiler supplies the basemap. A postcode result is only the provider’s partial list, not every suburb.';
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
 ypMountChrome();
 ypMountLocate();
 ypFoot('Preview camera starts at a public Bundaberg demo point (Regional Art Gallery) until you search or select. That point is not your game home and not a property record.');
 ypPatchCamera();
 const ui=ypMountSearch();
 let key='',geoapifyKey='';
 try{
  const response=await fetch('/runtime-config',{cache:'no-store'});
  if(!response.ok)throw Error('config');
  const body=await response.json();
  key=typeof body.key==='string'?body.key:'';
  geoapifyKey=typeof body.geoapifyKey==='string'?body.geoapifyKey:'';
 }catch{key='';geoapifyKey='';}
 ypGeoKey=geoapifyKey;
 if(ui)ypWireSearch(ui,geoapifyKey);
 ypWireWhere();
 if(!key){ypStatusPanel('Map key missing. The localhost preview server must inject MAPTILER_TEST_API_KEY. No tiles were requested and no buildings were invented.');ypFoot('Map key missing. Basemap not loaded.');return;}
 try{await ypLoadMapLibre();}catch{ypStatusPanel('Map library unavailable. Check internet access, then reload. No buildings were invented.');return;}
 if(!window.maplibregl){ypStatusPanel('Map library unavailable. Check internet access, then reload. No buildings were invented.');return;}
 ypRecord=ypReadSelection();
 const box=document.getElementById('ypbasemap');
 ypMap=new maplibregl.Map({container:box,style:'https://api.maptiler.com/maps/base-v4/style.json',center:(window.__ypPlace&&window.__ypPlace.center)||ypRecord?.coordinate||YP_DEMO,zoom:window.__ypPlace?12:18,maxZoom:20,minZoom:12,maxPitch:0,renderWorldCopies:false,attributionControl:false,transformRequest(url){const u=new URL(url,location.href);if(u.hostname==='api.maptiler.com'){u.searchParams.set('key',key);return {url:u.href};}return {url};}});
 window.__ypMap=ypMap;
 ypMap.addControl(new maplibregl.NavigationControl({showCompass:false}));
 ypMap.addControl(new maplibregl.AttributionControl({compact:false,customAttribution:'<a href="https://www.maptiler.com/copyright/">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>'}));
 ypMap.on('error',()=>{if(ypMapFailed)return;ypMapFailed=true;ypFoot('Map resource error (details suppressed). Check the key, allowed origins, quota or network, then reload. No buildings were invented.');});
 ypMap.on('load',()=>{
  ypClearStatusPanel();
  const layers=ypMap.getStyle().layers||[];
  for(const layer of layers){const label=`${layer.id} ${layer['source-layer']||''}`;if(/housenumber|house.?number|poi|point.?of.?interest/i.test(label)){try{ypMap.setLayoutProperty(layer.id,'visibility','none');}catch(e){}}}
  ypBuildingLayers=layers.filter(l=>['fill','fill-extrusion'].includes(l.type)&&/building/i.test(l['source-layer']||l.id)&&l.layout?.visibility!=='none').map(l=>l.id);
  ypMap.addSource('yp-highlight',{type:'geojson',data:ypEmpty()});
  const before=layers.find(l=>l.type==='symbol')?.id;
  ypMap.addLayer({id:'yp-highlight-fill',type:'fill',source:'yp-highlight',paint:{'fill-color':'#f8a51b','fill-opacity':0.6}},before);
  ypMap.addLayer({id:'yp-highlight-line',type:'line',source:'yp-highlight',paint:{'line-color':'#b65b00','line-width':3}},before);
  ypMap.addSource('yp-accuracy',{type:'geojson',data:ypEmpty()});
  ypMap.addLayer({id:'yp-accuracy-fill',type:'fill',source:'yp-accuracy',paint:{'fill-color':'#0a3a8c','fill-opacity':.15}});
  ypMap.addLayer({id:'yp-accuracy-line',type:'line',source:'yp-accuracy',paint:{'line-color':'#0a3a8c','line-width':2}});
  if(!document.getElementById('yp-logo')){const logo=document.createElement('a');logo.id='yp-logo';logo.href='https://www.maptiler.com/';logo.target='_blank';logo.rel='noopener';const img=document.createElement('img');img.src='https://api.maptiler.com/resources/logo.svg';img.alt='MapTiler logo';logo.appendChild(img);box.appendChild(logo);}
  ypReady=true;
  ypFoot(ypBuildingLayers.length?'Basemap loaded. Tap inside one building. House-number and place-of-interest labels are hidden where the style names them. Street names stay.':'Basemap loaded, but no building polygon layer was found. Nothing was invented.');
  ypRematch();
 });
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
 function chooseStreet(item){cancel();ypCancelLocate();street.value=item.street;if(!ypReady||!ypMap){msg('Map is not ready; choose the street again after it loads.');return;}ypMap.jumpTo({center:item.center,zoom:17});msg('Moved to '+item.label+'. Choose a building yourself.');}
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
 if(window.UI&&typeof UI.sale==='function')UI.sale=function(){ypOpenPropChoice();};
 const mapBtn=document.querySelector('nav button[data-v="map"]');
 if(mapBtn)mapBtn.addEventListener('click',()=>{ypCloseAutoOverlays();document.getElementById('yp-prop')?.remove();document.documentElement.classList.add('yp-preview');});
}
function ypShowWherePopup(){
 if(document.getElementById('yp-where'))return;
 const wrap=document.createElement('div');wrap.id='yp-where';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-label','Choose a town or suburb');
 const card=document.createElement('div');card.className='card';
 const title=document.createElement('h2');title.textContent='Choose a town or suburb';
 const copy=document.createElement('p');copy.textContent='The new map is already open behind this. Type a town or suburb, or use My Location. GPS is not required. This does not open listings.';
 const input=document.createElement('input');input.id='yp-where-town';input.maxLength=100;input.autocomplete='off';input.placeholder='Town or suburb';input.setAttribute('aria-label','Town or suburb');input.setAttribute('role','combobox');input.setAttribute('aria-controls','yp-where-suggestions');input.setAttribute('aria-expanded','false');
 const suggestions=document.createElement('div');suggestions.id='yp-where-suggestions';suggestions.setAttribute('role','listbox');
 const status=document.createElement('p');status.id='yp-where-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent='The old 3D town is not the map. No listings are opened from this step.';
 const locate=document.createElement('button');locate.type='button';locate.id='yp-where-locate';locate.textContent='My Location';
 const close=document.createElement('button');close.type='button';close.id='yp-where-close';close.textContent='Close';
 close.addEventListener('click',ypCloseWhere);
 locate.addEventListener('click',()=>{
  if(!ypLocateCtrl)ypMountLocate();
  if(!ypLocateCtrl){status.textContent='Location is unavailable. Search for a town or suburb instead.';return;}
  const res=ypLocateCtrl.tap(outcome=>{locate.disabled=false;locate.removeAttribute('aria-busy');const live=document.getElementById('yp-where-status');if(live)live.textContent=ypLocateMessage(outcome.status,outcome.view);ypApplyLocate(outcome);if(outcome.status==='found')ypCloseWhere();});
  if(res.accepted){locate.disabled=true;locate.setAttribute('aria-busy','true');status.textContent=ypLocateMessage('locating');}
  else if(res.status&&res.status!=='locating')status.textContent=ypLocateMessage(res.status);
 });
 card.append(title,copy,input,suggestions,status,locate,close);
 wrap.appendChild(card);
 document.body.appendChild(wrap);
 ypWireWhere();
}
function ypCloseWhere(){const el=document.getElementById('yp-where');if(el)el.remove();}
function ypWireWhere(){
 const input=document.getElementById('yp-where-town'),box=document.getElementById('yp-where-suggestions'),status=document.getElementById('yp-where-status');
 if(!input||input.dataset.wired)return;input.dataset.wired='1';
 let timer=0,items=[],active=-1;const gate=pilotSuggest.gate();
 input.addEventListener('input',()=>{clearTimeout(timer);gate.next();box.replaceChildren();items=[];active=-1;input.setAttribute('aria-expanded','false');
  const text=input.value.trim();
  let params;try{params=autocompleteQuery('area',text,null,'Australia');}catch(e){status.textContent=e.message;return;}
  if(!ypGeoKey){status.textContent='Search key missing. No town request was sent. Use My Location or Close. The old map stays hidden.';return;}
  const token=gate.next();
  timer=setTimeout(async()=>{status.textContent='Finding towns and suburbs…';try{
   const url=geocodeUrl(params,ypGeoKey);
   const response=await fetch(url.href,{...YP_MAP_REQUEST,signal:token.signal});
   if(!response.ok||!gate.current(token.version))throw Error('bad');
   items=pilotSuggest.areas(await response.json(),'Australia',/^\d{4}$/.test(text)?text:null);
   box.replaceChildren();
   items.forEach((item,i)=>{const b=document.createElement('button');b.type='button';b.id='yp-where-opt-'+i;b.setAttribute('role','option');b.textContent=item.label;b.addEventListener('click',()=>ypChooseTown(item));box.appendChild(b);});
   input.setAttribute('aria-expanded',items.length?'true':'false');
   status.textContent=items.length?'Choose a town or suburb. None is selected automatically.':'No matching town or suburb. Nothing was invented.';
  }catch{if(gate.current(token.version))status.textContent='Town suggestions are unavailable. The old map was not opened.';}},450);
 });
}
function ypChooseTown(item){
 ypCancelLocate();
 const center=Number.isFinite(item.lon)&&Number.isFinite(item.lat)?[item.lon,item.lat]:null;
 window.__ypPlace={label:item.label||item.name||'Chosen place',center};
 const status=document.getElementById('yp-where-status');
 if(!center){if(status)status.textContent='That suggestion has no map position. Listings were not opened.';return;}
 if(ypMap){ypMap.jumpTo({center,zoom:12});}
 else if(status)status.textContent='Place noted: '+window.__ypPlace.label+'. The basemap has no key, so the camera was not moved. The old 3D map stays hidden and no listings were opened.';
 if(ypMap)ypCloseWhere();
}
function ypOpenPropChoice(){
 ypCloseWhere();
 let panel=document.getElementById('yp-prop');if(panel)panel.remove();
 panel=document.createElement('div');panel.id='yp-prop';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Properties');
 const card=document.createElement('div');card.className='card';
 const title=document.createElement('h2');title.textContent='Properties';
 const copy=document.createElement('p');copy.textContent='Choose a list. Nothing here is stock in the town on the map. Fictional Coralwood lots are not local listings, and this preview has no auctions.';
 const rent=document.createElement('button');rent.type='button';rent.id='yp-prop-rent';rent.textContent='For rent';
 const sale=document.createElement('button');sale.type='button';sale.id='yp-prop-sale';sale.textContent='For sale';
 const auction=document.createElement('button');auction.type='button';auction.id='yp-prop-auction';auction.textContent='Auctions';
 const back=document.createElement('button');back.type='button';back.id='yp-prop-back';back.textContent='Back to map';
 rent.addEventListener('click',()=>ypShowPropSection('rent'));
 sale.addEventListener('click',()=>ypShowPropSection('sale'));
 auction.addEventListener('click',()=>ypShowPropSection('auction'));
 back.addEventListener('click',()=>panel.remove());
 card.append(title,copy,rent,sale,auction,back);panel.appendChild(card);document.body.appendChild(panel);
}
function ypShowPropSection(kind){
 const panel=document.getElementById('yp-prop');if(!panel)return;
 const place=window.__ypPlace&&window.__ypPlace.label?window.__ypPlace.label:'the place on the map';
 const text=kind==='auction'
  ?'Auctions are not part of this map preview. None were created for '+place+'.'
  :'No '+(kind==='sale'?'for-sale':'for-rent')+' records are available for '+place+'. Fictional Coralwood lots are not listings in that town.';
 const card=panel.querySelector('.card');
 card.replaceChildren();
 const title=document.createElement('h2');title.textContent=kind==='auction'?'Auctions':kind==='sale'?'For sale':'For rent';
 const copy=document.createElement('p');copy.id='yp-prop-note';copy.textContent=text;
 const back=document.createElement('button');back.type='button';back.id='yp-prop-back';back.textContent='Back to map';
 back.addEventListener('click',()=>panel.remove());
 card.append(title,copy,back);
}
window.ypChooseTown=ypChooseTown;
window.ypEnterRealMap=ypEnterRealMap;
