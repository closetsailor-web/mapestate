/* Your Plot Car Yard. Test-folder listings, intro, and owned vehicles. */
const YP_CAR_CATALOG=[{"id":"mitsara-magnara-2004","brand":"Mitsara","model":"Magnara","year":2004,"price":3000,"image":"assets/cars/mitsara_magnara_2004.webp"},{"id":"hyandar-excara-1998","brand":"Hyandar","model":"Excara","year":1998,"price":3600,"image":"assets/cars/hyandar_excara_1998.webp"},{"id":"jeprel-xaren-1996","brand":"Jeprel","model":"Xaren","year":1996,"price":4900,"image":"assets/cars/jeprel_xaren_1996.webp"},{"id":"hendrick-corsair-2008","brand":"Hendrick","model":"Corsair","year":2008,"price":6800,"image":"assets/cars/hendrick_corsair_2008.webp"},{"id":"fortis-falcara-2010","brand":"Fortis","model":"Falcara","year":2010,"price":7500,"image":"assets/cars/fortis_falcara_2010.webp"},{"id":"hendrick-rodeara-2007","brand":"Hendrick","model":"Rodeara","year":2007,"price":8400,"image":"assets/cars/hendrick_rodeara_2007.webp"},{"id":"nakano-pulsara-2016","brand":"Nakano","model":"Pulsara","year":2016,"price":8600,"image":"assets/cars/nakano_pulsara_2016.webp"},{"id":"hendrick-astrara-2017","brand":"Hendrick","model":"Astrara","year":2017,"price":8600,"image":"assets/cars/hendrick_astrara_2017.webp"},{"id":"hendrick-kingsward-1974","brand":"Hendrick","model":"Kingsward","year":1974,"price":11300,"image":"assets/cars/hendrick_kingsward_1974.webp"},{"id":"fortis-territara-2014","brand":"Fortis","model":"Territara","year":2014,"price":12400,"image":"assets/cars/fortis_territara_2014.webp"},{"id":"mitsara-lancara-2016","brand":"Mitsara","model":"Lancara","year":2016,"price":12400,"image":"assets/cars/mitsara_lancara_2016.webp"},{"id":"fortis-focara-2018","brand":"Fortis","model":"Focara","year":2018,"price":17800,"image":"assets/cars/fortis_focara_2018.webp"},{"id":"volkren-beetara-2016","brand":"Volkren","model":"Beetara","year":2016,"price":18600,"image":"assets/cars/volkren_beetara_2016.webp"},{"id":"mazara-treva-2023","brand":"Mazara","model":"Treva","year":2023,"price":19500,"image":"assets/cars/mazara_treva_2023.webp"},{"id":"tovara-corella-2023","brand":"Tovara","model":"Corella","year":2023,"price":24500,"image":"assets/cars/tovara_corella_2023.webp"},{"id":"hyandar-iren-2023","brand":"Hyandar","model":"Iren","year":2023,"price":24700,"image":"assets/cars/hyandar_iren_2023.webp"},{"id":"volkren-golfara-2023","brand":"Volkren","model":"Golfara","year":2023,"price":25000,"image":"assets/cars/volkren_golfara_2023.webp"},{"id":"mitsara-pajara-2016","brand":"Mitsara","model":"Pajara","year":2016,"price":25100,"image":"assets/cars/mitsara_pajara_2016.webp"},{"id":"nakano-xtrara-2023","brand":"Nakano","model":"Xtrara","year":2023,"price":25100,"image":"assets/cars/nakano_xtrara_2023.webp"},{"id":"tovara-camrel-2023","brand":"Tovara","model":"Camrel","year":2023,"price":26100,"image":"assets/cars/tovara_camrel_2023.webp"},{"id":"subaren-forestara-2023","brand":"Subaren","model":"Forestara","year":2023,"price":26500,"image":"assets/cars/subaren_forestara_2023.webp"},{"id":"mazara-cexa-2023","brand":"Mazara","model":"Cexa","year":2023,"price":26900,"image":"assets/cars/mazara_cexa_2023.webp"},{"id":"honaris-cervara-2023","brand":"Honaris","model":"Cervara","year":2023,"price":28300,"image":"assets/cars/honaris_cervara_2023.webp"},{"id":"mitsara-outlandara-2023","brand":"Mitsara","model":"Outlandara","year":2023,"price":28300,"image":"assets/cars/mitsara_outlandara_2023.webp"},{"id":"chryton-valiara-1971","brand":"Chryton","model":"Valiara","year":1971,"price":29700,"image":"assets/cars/chryton_valiara_1971.webp"},{"id":"honaris-civara-2023","brand":"Honaris","model":"Civara","year":2023,"price":31900,"image":"assets/cars/honaris_civara_2023.webp"},{"id":"honaris-accoren-2023","brand":"Honaris","model":"Accoren","year":2023,"price":34400,"image":"assets/cars/honaris_accoren_2023.webp"},{"id":"mitsara-tritara-2023","brand":"Mitsara","model":"Tritara","year":2023,"price":34400,"image":"assets/cars/mitsara_tritara_2023.webp"},{"id":"tovara-ravara-2023","brand":"Tovara","model":"Ravara","year":2023,"price":35600,"image":"assets/cars/tovara_ravara_2023.webp"},{"id":"tesara-yera-2023","brand":"Tesara","model":"Yera","year":2023,"price":39300,"image":"assets/cars/tesara_yera_2023.webp"},{"id":"nakano-navira-2023","brand":"Nakano","model":"Navira","year":2023,"price":40100,"image":"assets/cars/nakano_navira_2023.webp"},{"id":"fortis-rangara-2023","brand":"Fortis","model":"Rangara","year":2023,"price":41100,"image":"assets/cars/fortis_rangara_2023.webp"},{"id":"tovara-klugara-2023","brand":"Tovara","model":"Klugara","year":2023,"price":44700,"image":"assets/cars/tovara_klugara_2023.webp"},{"id":"jeprel-grandara-2023","brand":"Jeprel","model":"Grandara","year":2023,"price":45000,"image":"assets/cars/jeprel_grandara_2023.webp"},{"id":"isura-demara-2023","brand":"Isura","model":"Demara","year":2023,"price":50300,"image":"assets/cars/isura_demara_2023.webp"},{"id":"jeprel-wrangara-2023","brand":"Jeprel","model":"Wrangara","year":2023,"price":58300,"image":"assets/cars/jeprel_wrangara_2023.webp"},{"id":"tovara-hilara-2023","brand":"Tovara","model":"Hilara","year":2023,"price":58800,"image":"assets/cars/tovara_hilara_2023.webp"},{"id":"tovara-pradara-2023","brand":"Tovara","model":"Pradara","year":2023,"price":61100,"image":"assets/cars/tovara_pradara_2023.webp"},{"id":"fortis-mustara-2023","brand":"Fortis","model":"Mustara","year":2023,"price":62000,"image":"assets/cars/fortis_mustara_2023.webp"},{"id":"hendrick-torena-1974","brand":"Hendrick","model":"Torena","year":1974,"price":70200,"image":"assets/cars/hendrick_torena_1974.webp"},{"id":"nakano-patrola-2023","brand":"Nakano","model":"Patrola","year":2023,"price":73700,"image":"assets/cars/nakano_patrola_2023.webp"},{"id":"fortis-feron-2023","brand":"Fortis","model":"Feron","year":2023,"price":89300,"image":"assets/cars/fortis_feron_2023.webp"},{"id":"tovara-landcruvar-2023","brand":"Tovara","model":"LandCruvar","year":2023,"price":89500,"image":"assets/cars/tovara_landcruvar_2023.webp"},{"id":"ramar-pickup-2023","brand":"Ramar","model":"Pickup","year":2023,"price":97200,"image":"assets/cars/ramar_pickup_2023.webp"},{"id":"colton-camaren-2019","brand":"Colton","model":"Camaren","year":2019,"price":98400,"image":"assets/cars/colton_camaren_2019.webp"},{"id":"colton-silveran-2023","brand":"Colton","model":"Silveran","year":2023,"price":107500,"image":"assets/cars/colton_silveran_2023.webp"}];
const YP_CAR_INTRO_AT=4.3;
const YP_CAR_VIDEO='assets/salesman-v5.mp4';
const YP_CAR_POSTER='assets/salesman-v5.webp';

function ypCarCatalog(){return YP_CAR_CATALOG.slice();}
function ypCarMoney(amount){if(typeof ypNetMoney==='function')return ypNetMoney(amount);const n=Math.max(0,Math.round(Number(amount)||0));return '$'+String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',');}
function ypCarTitle(car){if(!car)return '';return String(car.year||'')+' '+String(car.brand||'')+' '+String(car.model||'');}
/* dates98: retry a car photo that fails to load (twice, cache-busted), then show a clean grey placeholder with the car name. */
function ypCarPlaceholder(title){const t=String(title||'Car').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const svg='<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="#e3e7ee"/><text x="400" y="285" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="60" font-weight="700" fill="#5a6780">'+t+'</text><text x="400" y="355" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="38" fill="#8a94a6">Photo unavailable</text></svg>';return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);}
function ypCarImg(img,car,src,prev){if(!img)return img;const base=String(src||(car&&car.image)||'');let tries=0;img.dataset.ypCarSrc=base;const mood=(base&&/assets\/cars\//.test(base)&&car&&car.id&&typeof ypSkyMoodKey==='function')?ypSkyMoodKey('car:'+car.id,prev):'';const shown=(mood&&typeof ypSkySrc==='function')?ypSkySrc(base,mood):base;if(mood)img.dataset.sky=mood;img.addEventListener('error',function onErr(e){if(shown!==base&&!img.dataset.skyFallback){img.dataset.skyFallback='1';if(e&&e.stopImmediatePropagation)e.stopImmediatePropagation();img.src=base;return;}if(img.dataset.ypCarFailed)return;if(tries<2&&base){tries++;const n=tries;setTimeout(()=>{img.src=base+(base.indexOf('?')<0?'?':'&')+'r='+n;},400*n);return;}img.dataset.ypCarFailed='1';img.removeEventListener('error',onErr);img.classList.add('yp-car-ph');img.src=ypCarPlaceholder(ypCarTitle(car));});img.src=shown;return img;}
function ypCarById(id){id=String(id||'');return YP_CAR_CATALOG.find(c=>c&&c.id===id)||null;}
function ypCarEnsureState(){if(typeof G==='undefined'||!G)return;if(!Array.isArray(G.vehicles))G.vehicles=[];}
function ypCarIsPending(v){return !!(v&&(v.status==='handover-pending'||v.handedOver===0||v.handedOver==='0'));}
function ypCarIsHandedOver(v){return !!(v&&!ypCarIsPending(v));}
function ypCarOwned(){ypCarEnsureState();if(typeof G==='undefined'||!G)return [];return (G.vehicles||[]).filter(ypCarIsHandedOver);}
function ypCarPendingList(){ypCarEnsureState();if(typeof G==='undefined'||!G)return [];return (G.vehicles||[]).filter(ypCarIsPending);}
function ypCarOwnedIds(){return new Set((G&&G.vehicles||[]).filter(Boolean).map(v=>String(v.id||'')).filter(Boolean));}
function ypCarYardStock(){const held=ypCarOwnedIds();return YP_CAR_CATALOG.filter(c=>c&&!held.has(c.id));}
/* dates100: weekly running costs (QLD). Rego about $900 a year for a 4-cylinder car. Comprehensive insurance about 3% of the car's value a year, at least $10 a week.
   Fuel $50 a week for your main car; you can only drive one car at a time, so each extra car costs $15 a week (occasional use). */
const YP_CAR_REGO_WK=17,YP_CAR_INS_RATE=0.03,YP_CAR_INS_MIN_WK=10,YP_CAR_FUEL_WK=50,YP_CAR_FUEL_EXTRA_WK=15;
function ypCarRunningCosts(car,extra){const value=Math.max(0,Math.round(+((car&&car.price)||0)));const rego=YP_CAR_REGO_WK;const insurance=Math.max(YP_CAR_INS_MIN_WK,Math.round(value*YP_CAR_INS_RATE/52));const fuel=extra?YP_CAR_FUEL_EXTRA_WK:YP_CAR_FUEL_WK;return {rego,insurance,fuel,total:rego+insurance+fuel};}
function ypCarRunningList(){return ypCarOwned().map((v,i)=>Object.assign({car:v},ypCarRunningCosts(v,i>0)));}
function ypCarRunningWk(){return ypCarRunningList().reduce((t,c)=>t+c.total,0);}
function ypCarRunningText(c){return 'Rego '+ypCarMoney(c.rego)+', Insurance '+ypCarMoney(c.insurance)+', Fuel '+ypCarMoney(c.fuel);}
function ypCarRunningNote(car,idPrefix){const c=ypCarRunningCosts(car,ypCarOwned().length>0);const wrap=document.createElement('div');wrap.className='yp-car-running';wrap.id=idPrefix+'-running';const h=document.createElement('p');h.className='yp-car-running-total';h.innerHTML='Running Costs <b>'+ypCarMoney(c.total)+' a week</b>';const d=document.createElement('p');d.className='yp-car-running-parts';d.textContent=ypCarRunningText(c)+(ypCarOwned().length>0?' (extra car, less fuel)':'');wrap.append(h,d);return wrap;}
function ypVehicleAssetsTotal(){return ypCarOwned().reduce((sum,v)=>sum+Math.max(0,Math.round(+v.price||0)),0);}
function ypCarYardSeen(){return !!(typeof G!=='undefined'&&G&&G.carYardSeen);}
function ypMarkCarYardSeen(){if(typeof G==='undefined'||!G||G.carYardSeen)return;G.carYardSeen=1;if(typeof save==='function')save();}

function ypCarYardStyle(){
  if(document.getElementById('yp-car-yard-style'))return;
  const s=document.createElement('style');
  s.id='yp-car-yard-style';
  s.textContent=`
#yp-car-yard-intro,#yp-car-yard,#yp-car-detail,#yp-car-bought,#yp-car-pay,#yp-car-finance{position:fixed;left:0;right:0;top:calc(var(--sat, 0px) + 88px);bottom:calc(var(--sab, 0px) + 86px);width:auto;height:auto;max-height:none;z-index:28;display:flex;align-items:stretch;justify-content:stretch;overflow:hidden;overscroll-behavior:none;touch-action:pan-y;padding:0 10px;background:transparent;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#14213d;box-sizing:border-box}
#yp-car-finance-facts{margin:12px 0 0}#yp-car-finance-facts .yp-flow{margin:0 0 10px}#yp-car-finance-price{margin:0 0 8px;font:500 15px/1.3 Inter,system-ui,sans-serif;color:#14213d}#yp-car-finance-price b{font-weight:800;color:#0b2545}
.yp-car-running{margin:10px 0 0;padding:10px 12px;border-radius:12px;background:#f4f7fb}.yp-car-running p{margin:0;text-align:left}.yp-car-running-total{font:500 15px/1.3 Inter,system-ui,sans-serif;color:#14213d}.yp-car-running-total b{font-weight:700}.yp-car-running-parts{margin-top:2px!important;font:400 13px/1.35 Inter,system-ui,sans-serif;color:#5a6780}
#yp-car-yard-intro .card,#yp-car-yard .card,#yp-car-detail .card,#yp-car-bought .card,#yp-car-pay .card,#yp-car-finance .card{background:#fff;border-radius:24px;width:100%;max-width:none;padding:0 16px 16px;text-align:left;box-shadow:0 10px 24px rgba(11,37,69,.18);max-height:none;height:100%;min-height:0;overflow:hidden;margin:0;display:flex;flex-direction:column;box-sizing:border-box}
#yp-car-yard-intro .yp-card-head,#yp-car-yard .yp-card-head,#yp-car-detail .yp-card-head,#yp-car-bought .yp-card-head,#yp-car-pay .yp-card-head,#yp-car-finance .yp-card-head{min-height:48px;height:48px;box-sizing:border-box;flex:none;margin-left:-16px;margin-right:-16px;width:calc(100% + 32px);max-width:none;margin-bottom:0}
#yp-car-yard-intro .yp-card-head h2,#yp-car-yard .yp-card-head h2,#yp-car-detail .yp-card-head h2,#yp-car-bought .yp-card-head h2,#yp-car-pay .yp-card-head h2,#yp-car-finance .yp-card-head h2{font:700 16px/1.15 Inter,system-ui,sans-serif}
#yp-car-intro-body{position:relative;flex:1 1 auto;min-height:0;display:flex;align-items:stretch;justify-content:stretch;background:#0b2545;margin:0 -16px -16px;overflow:hidden}
#yp-car-salesman{display:block;width:100%;height:100%;max-height:none;object-fit:cover;object-position:center center;background:#0b2545;vertical-align:middle}
#yp-car-view-listings{position:absolute;top:14px;right:12px;z-index:3;appearance:none;-webkit-appearance:none;border:0;cursor:pointer;background:#fff;color:#0b2545;font:700 13px/1.2 Inter,system-ui,sans-serif;padding:10px 14px;border-radius:18px 18px 6px 18px;box-shadow:0 8px 20px rgba(11,37,69,.28);max-width:70%;text-align:center}
#yp-car-view-listings:not(.on){display:none}
#yp-car-view-listings:before{content:"";position:absolute;top:-6px;right:16px;width:12px;height:12px;background:#fff;transform:rotate(45deg);border-radius:2px;box-shadow:-2px -2px 6px rgba(11,37,69,.06)}
#yp-car-tap-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:4;appearance:none;-webkit-appearance:none;border:0;cursor:pointer;background:#ff8a33;color:#fff;font:800 15px/1.2 Inter,system-ui,sans-serif;padding:12px 18px;border-radius:999px;box-shadow:0 10px 24px rgba(11,37,69,.3)}
#yp-car-tap-play:not(.on){display:none}
#yp-car-yard .yp-step-body,#yp-car-detail .yp-step-body,#yp-car-bought .yp-step-body,#yp-car-pay .yp-step-body,#yp-car-finance .yp-step-body{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:12px 0 8px}
#yp-car-yard .yp-step-body::-webkit-scrollbar,#yp-car-detail .yp-step-body::-webkit-scrollbar,#yp-car-bought .yp-step-body::-webkit-scrollbar,#yp-car-pay .yp-step-body::-webkit-scrollbar,#yp-car-finance .yp-step-body::-webkit-scrollbar{display:none;width:0;height:0}
#yp-car-yard .yp-step-foot,#yp-car-detail .yp-step-foot,#yp-car-bought .yp-step-foot,#yp-car-pay .yp-step-foot,#yp-car-finance .yp-step-foot{flex:none;background:#fff;padding-top:8px;position:relative;z-index:2}
#yp-car-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
#yp-car-grid .yp-car-card{appearance:none;-webkit-appearance:none;display:flex;flex-direction:column;align-items:stretch;margin:0;padding:0;border:1px solid rgba(20,33,61,.08);border-radius:16px;background:#fff;box-shadow:0 6px 16px rgba(11,37,69,.06);overflow:hidden;cursor:pointer;text-align:left;color:#14213d;font:inherit}
#yp-car-grid .yp-car-card img{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;background:#e8edf4}
#yp-car-grid .yp-car-meta{padding:8px 8px 10px}
#yp-car-grid .yp-car-name{margin:0 0 4px;font:700 13px/1.25 Inter,system-ui,sans-serif;color:#14213d}
#yp-car-grid .yp-car-price{margin:0;font:800 16px/1.2 Inter,system-ui,sans-serif;color:#0b2545}
#yp-car-empty{margin:8px 4px;font:500 15px/1.35 Inter,system-ui,sans-serif;color:#5a6780}
#yp-car-detail-photo,#yp-car-bought-photo{display:block;width:100%;border-radius:16px;aspect-ratio:4/3;object-fit:cover;background:#e8edf4;margin:0 0 12px}
#yp-car-detail .yp-flow-subhead,#yp-car-bought .yp-flow-subhead,#yp-car-pay .yp-flow-subhead,#yp-car-finance .yp-flow-subhead{margin:0 0 8px;padding:0;font:800 16px/1.2 Inter,system-ui,sans-serif;color:#0b2545;letter-spacing:0;text-transform:none;text-align:left}
#yp-car-detail .yp-car-copy,#yp-car-bought .yp-car-copy,#yp-car-pay .yp-car-copy,#yp-car-finance .yp-car-copy,#yp-car-need{margin:0 0 10px;font:500 15px/1.4 Inter,system-ui,sans-serif;color:#14213d}
#yp-car-need{color:#9b2c2c}
#yp-car-detail .yp-step-foot .hwb,#yp-car-bought .yp-step-foot .hwb,#yp-car-pay .yp-step-foot .hwb,#yp-car-finance .yp-step-foot .hwb,#yp-car-detail .yp-step-foot .hwx,#yp-car-pay .yp-step-foot .hwx,#yp-car-finance .yp-step-foot .hwx{appearance:none;-webkit-appearance:none;display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;height:48px;box-sizing:border-box;margin-top:8px;border-radius:999px;font:700 16px Inter,system-ui,sans-serif;cursor:pointer;padding:0 16px}
#yp-car-detail .yp-step-foot .hwb,#yp-car-bought .yp-step-foot .hwb,#yp-car-pay .yp-step-foot .hwb,#yp-car-finance .yp-step-foot .hwb{border:0;background:#f26b1d;color:#fff}
#yp-car-detail .yp-step-foot .hwx,#yp-car-pay .yp-step-foot .hwx,#yp-car-finance .yp-step-foot .hwx{border:2px solid #0a3a8c;background:#fff;color:#0a3a8c}
.yp-vehicle-list{display:flex;flex-direction:column;gap:8px;margin:0 0 8px}
.yp-vehicle-row{display:flex;align-items:center;gap:10px;padding:0;margin:0}
.yp-vehicle-row img{width:64px;height:48px;object-fit:cover;border-radius:10px;background:#e8edf4;flex:none}
.yp-vehicle-row .yp-car-name{margin:0;font:700 14px/1.25 Inter,system-ui,sans-serif;color:#14213d}
.yp-vehicle-row .yp-car-price{margin:2px 0 0;font:800 15px/1.2 Inter,system-ui,sans-serif;color:#0b2545}

#yp-car-pay .yp-step-body,#yp-car-finance .yp-step-body{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:12px 0 8px}
#yp-car-pay .yp-step-body::-webkit-scrollbar,#yp-car-finance .yp-step-body::-webkit-scrollbar{display:none;width:0;height:0}
#yp-car-pay .yp-step-foot,#yp-car-finance .yp-step-foot{flex:none;background:#fff;padding-top:8px;position:relative;z-index:2}
#yp-car-pay .yp-step-foot .hwb,#yp-car-pay .yp-step-foot .hwx,#yp-car-finance .yp-step-foot .hwb,#yp-car-finance .yp-step-foot .hwx{appearance:none;-webkit-appearance:none;display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;height:48px;box-sizing:border-box;margin-top:8px;border-radius:999px;font:700 16px Inter,system-ui,sans-serif;cursor:pointer;padding:0 16px}
#yp-car-pay .yp-step-foot .hwb,#yp-car-finance .yp-step-foot .hwb{border:0;background:#f26b1d;color:#fff}
#yp-car-pay .yp-step-foot .hwx,#yp-car-finance .yp-step-foot .hwx{border:2px solid #0a3a8c;background:#fff;color:#0a3a8c}
.yp-car-cash-only{margin:4px 0 0;font:700 11px/1.2 Inter,system-ui,sans-serif;color:#9b2c2c}
#yp-car-detail .yp-car-cash-only,#yp-car-pay .yp-car-cash-only{margin:0 0 8px;font:700 13px/1.3 Inter,system-ui,sans-serif;color:#9b2c2c}
#yp-car-old-note,#yp-car-pay-need,#yp-car-finance-need{margin:0 0 10px;font:500 15px/1.4 Inter,system-ui,sans-serif;color:#14213d}
#yp-car-pay-need,#yp-car-finance-need{color:#9b2c2c}
.yp-car-label{margin:10px 0 6px;padding:0;font:800 16px/1.2 Inter,system-ui,sans-serif;color:#0b2545;letter-spacing:0;text-transform:none;text-align:left}
.yp-car-value{margin:0 0 8px;font:500 15px/1.35 Inter,system-ui,sans-serif;color:#14213d}
#yp-car-finance-repay{font:800 16px/1.3 Inter,system-ui,sans-serif;color:#0b2545}
.yp-car-picks{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 8px}
.yp-car-picks button{appearance:none;-webkit-appearance:none;border:2px solid #0a3a8c;background:#fff;color:#0a3a8c;border-radius:999px;min-height:36px;padding:0 12px;font:700 13px Inter,system-ui,sans-serif;cursor:pointer}
.yp-car-picks button.on{background:#f26b1d;border-color:#f26b1d;color:#fff}
`;

  document.head.appendChild(s);
}

function ypCarPanel(id,title,opts){
  opts=opts||{};
  ypCarYardStyle();
  if(typeof ypExclusive==='function')ypExclusive(id);
  const old=document.getElementById(id);
  if(old)old.remove();
  const panel=document.createElement('div');
  panel.id=id;
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-labelledby',id+'-title');
  const card=document.createElement('div');
  card.className='card';
  const shut=()=>{
    if(opts.onClose)opts.onClose();
    panel.remove();
    if(typeof ypUseHome==='function')ypUseHome();
  };
  const headOpts={title:title,titleId:id+'-title'};
  if(opts.close!==false){headOpts.id=id+'-x';headOpts.onClose=shut;}
  if(typeof ypCardHeader==='function')card.appendChild(ypCardHeader(headOpts));
  panel.appendChild(card);
  document.body.appendChild(panel);
  return {panel,card,shut};
}

function ypCarFootButton(label,cls,onClick,id){
  const btn=document.createElement('button');
  btn.type='button';
  btn.className=cls;
  if(id)btn.id=id;
  btn.textContent=label;
  btn.addEventListener('click',event=>{if(event){event.preventDefault();event.stopPropagation();}onClick();});
  return btn;
}


const YP_CAR_RATE=0.09;
const YP_CAR_TERMS=[3,5,7];
const YP_CAR_MIN_DEPOSIT=0.10;
const YP_CAR_MAX_AGE_AT_END=15;

function ypCarGameYear(){
  try{
    const week=(typeof G!=='undefined'&&G)?(G.week|0):0;
    if(typeof ypWallAt==='function'&&typeof CFG!=='undefined'&&CFG&&CFG.weekMs){
      const at=new Date(ypWallAt(week*CFG.weekMs));
      const y=at.getFullYear();
      if(Number.isFinite(y)&&y>1900)return y;
    }
  }catch(e){}
  return new Date().getFullYear();
}
function ypCarAgeAtEnd(car,termYears){
  return ypCarGameYear()-Math.round(+((car&&car.year)||0))+Math.round(+termYears||0);
}
function ypCarFinanceTerms(car){
  return YP_CAR_TERMS.filter(term=>ypCarAgeAtEnd(car,term)<=YP_CAR_MAX_AGE_AT_END);
}
function ypCarIsCashOnly(car){return ypCarFinanceTerms(car).length===0;}
function ypCarDefaultTerm(car){
  const terms=ypCarFinanceTerms(car);
  if(terms.indexOf(5)>=0)return 5;
  return terms[0]||0;
}
function ypCarWeeklyRepay(principal,years,rate){
  principal=Math.max(0,Math.round(+principal||0));
  years=Math.round(+years||0);
  rate=(rate==null)?YP_CAR_RATE:+rate;
  const n=years*52;
  if(!(principal>0)||!(n>0))return 0;
  const r=rate/52;
  if(!(r>0))return Math.round(principal/n);
  return Math.round(principal*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1));
}
function ypCarWeeklyInterest(balance,rate){
  rate=(rate==null)?YP_CAR_RATE:+rate;
  return Math.round(Math.max(0,Math.round(+balance||0))*rate/52);
}
function ypCarLoanDueThisWeek(L){
  if(!L||!(Math.round(+L.balance||0)>0))return 0;
  const balance=Math.max(0,Math.round(+L.balance||0));
  const due=balance+ypCarWeeklyInterest(balance,L.rate);
  return Math.min(Math.max(0,Math.round(+L.repayWk||0)),due);
}
function ypCarAmortize(principal,years,rate){
  principal=Math.max(0,Math.round(+principal||0));
  years=Math.round(+years||0);
  rate=(rate==null)?YP_CAR_RATE:+rate;
  const repayWk=ypCarWeeklyRepay(principal,years,rate);
  let balance=principal,paid=0,weeks=0,lastPay=0;
  const cap=Math.max(1,years*52)+104;
  for(let i=0;i<cap&&balance>0;i++){
    const interest=ypCarWeeklyInterest(balance,rate);
    const due=balance+interest;
    const pay=Math.min(repayWk,due);
    balance=Math.max(0,due-pay);
    paid+=pay;lastPay=pay;weeks++;
  }
  return {repayWk,weeks,totalPaid:paid,totalInterest:Math.max(0,paid-principal),lastPay,paidOff:balance===0,balance};
}
function ypCarDepositAmount(price,percent){
  price=Math.max(0,Math.round(+price||0));
  const min=Math.max(1,Math.ceil(price*YP_CAR_MIN_DEPOSIT-1e-9));
  let dep=Math.round(price*(Math.round(+percent||0)/100));
  if(dep<min)dep=min;
  if(dep>=price)dep=Math.max(min,price-1);
  return dep;
}
function ypCarFinanceQuote(car,percent,years){
  const price=Math.max(0,Math.round(+((car&&car.price)||0)));
  const terms=ypCarFinanceTerms(car);
  if(!terms.length)return {ok:false,cashOnly:true,price:price};
  if(terms.indexOf(years)<0)years=ypCarDefaultTerm(car);
  const deposit=ypCarDepositAmount(price,percent);
  const loan=Math.max(0,price-deposit);
  const repayWk=ypCarWeeklyRepay(loan,years);
  const amort=ypCarAmortize(loan,years);
  const run=ypCarRunningCosts(car,ypCarOwned().length>0);
  return {ok:true,cashOnly:false,price,percent:Math.round(+percent||0),deposit,loan,years,rate:YP_CAR_RATE,repayWk,
    weeks:amort.weeks,totalPaid:amort.totalPaid,totalInterest:amort.totalInterest,lastPay:amort.lastPay,
    fees:0,dealer:price,dueNow:deposit,running:run};
}
function ypCarActiveLoans(){
  return ypCarOwned().filter(v=>v&&v.loan&&Math.round(+v.loan.balance||0)>0);
}
function ypCarLoanBalance(){
  return ypCarActiveLoans().reduce((sum,v)=>sum+Math.max(0,Math.round(+v.loan.balance||0)),0);
}
function ypCarLoanRepayWk(){
  return ypCarActiveLoans().reduce((sum,v)=>sum+ypCarLoanDueThisWeek(v.loan),0);
}
function ypCarWeekLeft(){
  if(typeof ypAffordWeek==='function'){
    const a=ypAffordWeek();
    return a&&Number.isFinite(+a.leftMgr)?+a.leftMgr:0;
  }
  return 0;
}
function ypCarBankCash(){return (typeof G!=='undefined'&&G)?Math.max(0,Math.round(+G.cash||0)):0;}
function ypCarPublicCode(id){
  if(!id)return '';
  try{
    const raw=typeof ypPropertyIdCode==='function'?ypPropertyIdCode(id):(typeof ypPublicCode==='function'?ypPublicCode(id):'');
    const c=String(raw||'').trim();
    if(!c||c==='No code'||c==='…'||c.startsWith('ypb-')||/^yp-[0-9a-f]{8}-/i.test(c))return '';
    return c;
  }catch(e){return '';}
}
function ypCarPlaceLabel(recOrId){
  const rec=(recOrId&&typeof recOrId==='object')?recOrId:null;
  const rawId=rec?null:recOrId;
  const bought=rec||(typeof ypBuyFor==='function'&&rawId?ypBuyFor(rawId):null);
  const ids=[bought&&bought.id,bought&&bought.footprintId,bought&&bought.gameId,rawId,recOrId&&recOrId.id].filter(Boolean);
  for(let i=0;i<ids.length;i++){
    const c=ypCarPublicCode(ids[i]);
    if(c)return c;
  }
  return '';
}
function ypCarSettleWeek(rec){
  if(!rec)return NaN;
  try{
    if(typeof ypLoanSettleWeek==='function'){
      const w=ypLoanSettleWeek(rec);
      if(Number.isFinite(+w))return +w|0;
    }
  }catch(e){}
  if(Number.isFinite(+rec.settleWeek))return +rec.settleWeek|0;
  return NaN;
}
function ypCarSettleHint(recOrId){
  const rec=(recOrId&&typeof recOrId==='object')?recOrId:((typeof ypBuyFor==='function'?ypBuyFor(recOrId):null)||{id:recOrId});
  const code=ypCarPlaceLabel(rec);
  const week=ypCarSettleWeek(rec);
  let settle='';
  if(Number.isFinite(week)){
    const lab=typeof ypGameWeekLabel==='function'?ypGameWeekLabel(week):('Week '+(week|0));
    if(lab)settle='Settles '+lab;
  }
  if(code&&settle)return code+' · '+settle;
  return code||settle||'';
}
function ypCarPendingItems(){
  const items=[];
  const push=(row)=>{if(!row||!(Math.round(+row.amount||0)>0)&&row.dir!=='info')return;row.amount=Math.max(0,Math.round(+row.amount||0));items.push(row);};
  try{
    const settling=typeof ypBuySettling==='function'?ypBuySettling():[];
    settling.forEach(b=>{
      const amt=Math.max(0,Math.round(+(typeof ypSettleDue==='function'?ypSettleDue(b):b&&b.atSettle)||0));
      push({kind:'house-settle-out',dir:'out',label:'House settlement to pay',hint:ypCarSettleHint(b),amount:amt});
    });
  }catch(e){}
  try{
    const s=(typeof ypEnsureMarket==='function'?ypEnsureMarket():null)||(typeof G!=='undefined'&&G&&G.ypMarket)||null;
    const sales=s&&s.sales?Object.values(s.sales):[];
    sales.forEach(L=>{
      if(!L||(L.status!=='agreed'&&L.status!=='accepted'))return;
      if(L.status==='accepted'&&!(Number.isFinite(+L.keysWeek)||L.agreed))return;
      const q=typeof ypSellMoney==='function'?ypSellMoney(L.id):null;
      if(!q)return;
      const rec=(typeof ypBuyFor==='function'?ypBuyFor(L.id):null)||L;
      const place=ypCarSettleHint(rec);
      if(q.toBank>0)push({kind:'house-settle-in',dir:'in',label:'House sale settlement to receive',hint:place,amount:q.toBank});
      if(q.shortfall>0)push({kind:'house-settle-out',dir:'out',label:'House sale shortfall to pay',hint:place,amount:q.shortfall});
    });
  }catch(e){}
  try{
    const rentals=((typeof ypReadStock==='function'?ypReadStock():{}).rentals)||[];
    rentals.forEach(r=>{
      if(!r)return;
      if(typeof ypRentalIsStale==='function'&&ypRentalIsStale(r))return;
      const rent=Math.round(+((typeof ypListingWeeklyRent==='function'?ypListingWeeklyRent(r):r.weeklyRent))||0);
      const pic=typeof ypRentPicture==='function'?ypRentPicture(rent):{bond:rent*4,advance:rent*2,upfront:rent*6};
      const place=ypCarPlaceLabel(r.footprintId||r.id);
      if(r.status==='application-pending'){
        push({kind:'rent-apply',dir:'info',label:'Pending rental application',hint:(place?place+'. ':'')+'Bond and two weeks rent in advance are not charged unless you are approved and sign',amount:pic.upfront||0});
      }else if(r.status==='approved'&&!r.bondCharged){
        push({kind:'rent-sign',dir:'out',label:'Rental move-in to pay if you sign',hint:(place?place+'. ':'')+'Four-week bond and two weeks rent in advance',amount:pic.upfront||0});
      }else if(r.status==='active'&&r.bondCharged){
        const bond=Math.round(+(r.bondPaid||r.bond||pic.bond)||0);
        if(bond>0)push({kind:'rent-bond',dir:'info',label:'Bond held by the bond office',hint:(place?place+'. ':'')+'Already paid, held until you leave',amount:bond});
        const adv=Math.round(+(r.advancePaid||r.advance||r.advanceAmt||pic.advance)||0);
        if(adv>0)push({kind:'rent-advance',dir:'info',label:'Rent paid in advance',hint:place,amount:adv});
      }
    });
    const B=typeof ypWeekBudget==='function'?ypWeekBudget():null;
    if(B&&Math.round(+B.extraRent||0)>0)push({kind:'rent-owed',dir:'out',label:'Rent owed',hint:'Outstanding rent that will leave your bank',amount:+B.extraRent});
  }catch(e){}
  try{
    ypCarPendingList().forEach(v=>{
      if(v.pay==='finance'&&!v.cashSettled){
        const dep=Math.round(+((v.quote&&v.quote.deposit)||(v.loan&&v.loan.deposit))||0);
        push({kind:'car-deposit',dir:'out',label:'Car deposit reserved',hint:ypCarTitle(v),amount:dep});
      }
    });
  }catch(e){}
  return items;
}
function ypCarAvailableFunds(){
  const cash=ypCarBankCash();
  const items=ypCarPendingItems();
  let outgoing=0,incoming=0;
  items.forEach(it=>{
    if(it.dir==='out')outgoing+=it.amount;
    else if(it.dir==='in')incoming+=it.amount;
  });
  const spendableNow=cash-outgoing;
  const available=cash-outgoing+incoming;
  return {cash,outgoing,incoming,spendableNow,available,items};
}
function ypCarLoanRows(){
  const rows=[];
  try{
    const B=typeof ypWeekBudget==='function'?ypWeekBudget():{};
    (B.loans||[]).forEach(l=>{
      const amt=Math.max(0,Math.round(+l.rep||0));
      if(amt>0)rows.push({label:'Home loan repayment',hint:ypCarPlaceLabel(l.id),amount:amt,weekly:true});
    });
    if(!(B.loans||[]).length&&Math.round(+B.homeLoans||0)>0)rows.push({label:'Home loan repayment',amount:Math.round(+B.homeLoans||0),weekly:true});
    if(Math.round(+B.invLoans||0)>0)rows.push({label:'Investment loan repayment',amount:Math.round(+B.invLoans||0),weekly:true});
  }catch(e){}
  ypCarActiveLoans().forEach(v=>{
    const due=ypCarLoanDueThisWeek(v.loan);
    if(due>0)rows.push({label:'Car loan repayment',hint:ypCarTitle(v),amount:due,weekly:true});
  });
  return rows;
}
function ypCarFinanceFits(repayWk,extraRun){
  repayWk=Math.max(0,Math.round(+repayWk||0));
  extraRun=Math.max(0,Math.round(+extraRun||0));
  if(typeof ypAffordWeek==='function'){
    const a=ypAffordWeek({carRepay:repayWk,carRun:extraRun});
    return !!(a&&+a.leftMgr>=0);
  }
  return ypCarWeekLeft()>=(repayWk+extraRun);
}
function ypChargeCarLoans(){
  ypCarEnsureState();
  if(typeof G==='undefined'||!G)return 0;
  const week=G.week|0;
  if(G.carLoanChargeWeek===week)return 0;
  let paid=0;
  (G.vehicles||[]).forEach(v=>{
    const L=v&&v.loan;
    if(!L||!(Math.round(+L.balance||0)>0))return;
    const balance=Math.max(0,Math.round(+L.balance||0));
    const interest=Math.round(balance*((+L.rate)||YP_CAR_RATE)/52);
    const due=balance+interest;
    const pay=Math.min(Math.max(0,Math.round(+L.repayWk||0)),due);
    if(pay>0){
      if(!(typeof window!=='undefined'&&window.__ypWeekBudgetCash)) G.cash=(+G.cash||0)-pay;
      paid+=pay;
    }
    L.balance=Math.max(0,due-pay);
    if(L.balance===0)L.paidWeek=week;
  });
  G.carLoanChargeWeek=week;
  if(paid&&!(typeof window!=='undefined'&&window.__ypWeekBudgetCash)&&typeof ypNoteCatch==='function')ypNoteCatch('expense',paid);
  if((paid||true)&&typeof save==='function')save();
  return paid;
}

function ypResumeCarPurchase(){
  ypCarEnsureState();
  const pending=ypCarPendingList()[0];
  if(pending){ypOpenCarHandover(pending);return true;}
  const due=(typeof G!=='undefined'&&G&&G.vehicles||[]).find(v=>ypCarIsHandedOver(v)&&v.congratsSeen!==1&&v.approveAt);
  if(due){ypOpenCarCongrats(due);return true;}
  return false;
}
function ypOpenCarYard(){if(ypResumeCarPurchase())return;ypOpenCarYardIntro();}

function ypOpenCarYardIntro(){
  ypCarYardStyle();
  const goListings=()=>{
    ypMarkCarYardSeen();
    if(typeof ypCancelAgentClip==='function')ypCancelAgentClip();
    const clip=document.getElementById('yp-apply-review');
    if(clip&&clip.classList.contains('yp-clip'))clip.remove();
    const bg=document.getElementById('yp-agent-bg');
    if(bg){try{bg.pause();}catch(e){}}
    ypOpenCarYardListings();
  };
  if(typeof YP_AGENT_CLIPS==='object'&&YP_AGENT_CLIPS&&!YP_AGENT_CLIPS.carYard){
    YP_AGENT_CLIPS.carYard='salesman-v5';
  }
  const play=()=>{
    if(typeof ypClipOnce==='function'){ypClipOnce('carYard',goListings);return;}
    goListings();
  };
  if(typeof ypClipFileReady==='function'){ypClipFileReady('carYard',ok=>{if(ok)play();else goListings();});return;}
  play();
}

function ypOpenCarYardListings(){
  if(ypResumeCarPurchase())return;
  const stock=ypCarYardStock();
  const ui=ypCarPanel('yp-car-yard','Car Yard');
  const body=document.createElement('div');
  body.className='yp-step-body';
  if(!stock.length){
    const empty=document.createElement('p');
    empty.className='yp-car-empty';
    empty.id='yp-car-empty';
    empty.textContent='No Cars For Sale Right Now';
    body.appendChild(empty);
  }else{
    const grid=document.createElement('div');
    grid.id='yp-car-grid';
    let prevSky='';
    stock.forEach(car=>{
      const card=document.createElement('button');
      card.type='button';
      card.className='yp-car-card';
      card.setAttribute('aria-label',ypCarTitle(car)+', '+ypCarMoney(car.price));
      const img=document.createElement('img');
      ypCarImg(img,car,null,prevSky);
      prevSky=img.dataset.sky||prevSky;
      img.alt=ypCarTitle(car);
      const meta=document.createElement('div');
      meta.className='yp-car-meta';
      const name=document.createElement('p');
      name.className='yp-car-name';
      name.textContent=ypCarTitle(car);
      const price=document.createElement('p');
      price.className='yp-car-price';
      price.textContent=ypCarMoney(car.price);
      meta.append(name,price);
      if(ypCarIsCashOnly(car)){
        const note=document.createElement('p');
        note.className='yp-car-cash-only';
        note.textContent='Cash Only';
        meta.appendChild(note);
      }
      card.append(img,meta);
      card.addEventListener('click',()=>{ui.shut();ypOpenCarDetail(car.id);});
      grid.appendChild(card);
    });
    body.appendChild(grid);
  }
  ui.card.appendChild(body);
}

function ypOpenCarDetail(id){
  const car=ypCarById(id);
  if(!car||ypCarOwnedIds().has(car.id)){
    ypOpenCarYardListings();
    return;
  }
  const cashOnly=ypCarIsCashOnly(car);
  const ui=ypCarPanel('yp-car-detail','Car Yard');
  const body=document.createElement('div');
  body.className='yp-step-body';
  const img=document.createElement('img');
  img.id='yp-car-detail-photo';
  ypCarImg(img,car);
  img.alt=ypCarTitle(car);
  const head=document.createElement('h3');
  head.className='yp-flow-subhead';
  head.id='yp-car-detail-name';
  head.textContent=ypCarTitle(car);
  const price=document.createElement('p');
  price.className='yp-car-copy';
  price.id='yp-car-detail-price';
  price.innerHTML='<b>'+ypCarMoney(car.price)+'</b>';
  body.append(img,head,price,ypCarRunningNote(car,'yp-car-detail'));
  if(cashOnly){
    const tag=document.createElement('p');
    tag.className='yp-car-cash-only';
    tag.id='yp-car-detail-cash-only';
    tag.textContent='Cash Only';
    const why=document.createElement('p');
    why.className='yp-car-copy';
    why.id='yp-car-old-note';
    why.textContent="Finance isn't available for cars this old";
    body.append(tag,why);
  }
  const foot=document.createElement('div');
  foot.className='yp-step-foot';
  foot.appendChild(ypCarFootButton('Buy','hwb',()=>{ui.shut();ypOpenCarPay(car.id);},'yp-car-buy'));
  foot.appendChild(ypCarFootButton('Back','hwx',()=>{ui.shut();ypOpenCarYardListings();},'yp-car-detail-back'));
  ui.card.append(body,foot);
}

function ypOpenCarPay(id){
  const car=ypCarById(id);
  if(!car||ypCarOwnedIds().has(car.id)){ypOpenCarYardListings();return;}
  const cashOnly=ypCarIsCashOnly(car);
  const ui=ypCarPanel('yp-car-pay','How Will You Pay',{close:false});
  const body=document.createElement('div');
  body.className='yp-step-body';
  const lead=document.createElement('h3');
  lead.className='yp-flow-subhead';
  lead.id='yp-car-pay-name';
  lead.textContent=ypCarTitle(car);
  const price=document.createElement('p');
  price.className='yp-car-copy';
  price.id='yp-car-pay-price';
  price.innerHTML='<b>'+ypCarMoney(car.price)+'</b>';
  body.append(lead,price,ypCarRunningNote(car,'yp-car-pay'));
  const funds=ypCarAvailableFunds();
  const fundNote=document.createElement('div');
  fundNote.id='yp-car-pay-funds';
  if(typeof ypFlow==='function'){
    const rows=[{label:'In the bank now',value:ypCarMoney(funds.cash),hint:'Includes any inheritance already released into your bank. That money is cash on hand, not a loan.'}];
    if(funds.outgoing>0)rows.push({label:'Pending outgoing',value:ypCarMoney(funds.outgoing),hint:'Reserved for settlements or rentals'});
    if(funds.incoming>0)rows.push({label:'Pending incoming',value:ypCarMoney(funds.incoming)});
    rows.push({label:'Spendable now',value:ypCarMoney(funds.spendableNow),id:'yp-car-pay-spendable',hint:'What can leave your bank today, without spending pending settlement money twice'});
    fundNote.appendChild(ypFlow(rows));
  }
  body.appendChild(fundNote);
  if(cashOnly){
    const tag=document.createElement('p');
    tag.className='yp-car-cash-only';
    tag.id='yp-car-pay-cash-only';
    tag.textContent='Cash Only';
    const why=document.createElement('p');
    why.id='yp-car-old-note';
    why.textContent="Finance isn't available for cars this old";
    body.append(tag,why);
  }
  const need=document.createElement('p');
  need.id='yp-car-pay-need';
  need.hidden=true;
  body.appendChild(need);
  const showNeed=msg=>{need.hidden=false;need.textContent=msg;};
  const foot=document.createElement('div');
  foot.className='yp-step-foot';
  foot.appendChild(ypCarFootButton('Pay Cash','hwb',()=>{
    const result=ypBuyCar(car.id);
    if(!result||!result.ok){showNeed((result&&result.why)||'You do not have enough in the bank to buy this car.');return;}
    ui.shut();
    ypOpenCarHandover(result.car);
  },'yp-car-pay-cash'));
  if(!cashOnly){
    foot.appendChild(ypCarFootButton('Finance','hwb',()=>{ui.shut();ypOpenCarFinance(car.id);},'yp-car-pay-finance'));
  }
  foot.appendChild(ypCarFootButton('Back','hwx',()=>{ui.shut();ypOpenCarDetail(car.id);},'yp-car-pay-back'));
  ui.card.append(body,foot);
}

function ypOpenCarFinance(id){
  const car=ypCarById(id);
  if(!car||ypCarOwnedIds().has(car.id)){ypOpenCarYardListings();return;}
  const terms=ypCarFinanceTerms(car);
  if(!terms.length){ypOpenCarPay(car.id);return;}
  let percent=10;
  let years=ypCarDefaultTerm(car);
  const ui=ypCarPanel('yp-car-finance','Car Finance',{close:false});
  const body=document.createElement('div');
  body.className='yp-step-body';
  const lead=document.createElement('h3');
  lead.className='yp-flow-subhead';
  lead.id='yp-car-finance-name';
  lead.textContent=ypCarTitle(car);
  body.appendChild(lead);
  const addLabel=(text,id)=>{const h=document.createElement('p');h.className='yp-car-label';if(id)h.id=id;h.textContent=text;body.appendChild(h);return h;};
  const priceLine=document.createElement('p');
  priceLine.className='yp-car-copy';
  priceLine.id='yp-car-finance-price';
  priceLine.innerHTML='Price <b>'+ypCarMoney(car.price)+'</b>';
  body.appendChild(priceLine);
  addLabel('Deposit','yp-car-deposit-label');
  const depRow=document.createElement('div');
  depRow.className='yp-car-picks';
  depRow.id='yp-car-deposit-picks';
  const depBtns=[];
  [10,20,30,40,50,60,70,80,90].forEach(pct=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.textContent=pct+'%';
    btn.setAttribute('aria-label','Deposit '+pct+'%');
    btn.addEventListener('click',()=>{percent=pct;paint();});
    depRow.appendChild(btn);
    depBtns.push({pct,btn});
  });
  body.appendChild(depRow);
  const depAmt=document.createElement('p');
  depAmt.className='yp-car-value';
  depAmt.id='yp-car-finance-deposit';
  body.appendChild(depAmt);
  addLabel('Term','yp-car-term-label');
  const termRow=document.createElement('div');
  termRow.className='yp-car-picks';
  termRow.id='yp-car-term-picks';
  const termBtns=[];
  terms.forEach(term=>{
    const btn=document.createElement('button');
    btn.type='button';
    btn.textContent=term+' Years';
    btn.setAttribute('aria-label',term+' Years');
    btn.addEventListener('click',()=>{years=term;paint();});
    termRow.appendChild(btn);
    termBtns.push({term,btn});
  });
  body.appendChild(termRow);
  const facts=document.createElement('div');
  facts.id='yp-car-finance-facts';
  body.appendChild(facts);
  const need=document.createElement('p');
  need.id='yp-car-finance-need';
  need.hidden=true;
  body.appendChild(need);
  const row=(label,value,hint,id)=>{
    const item={label,value};
    if(hint)item.hint=hint;
    if(id)item.id=id;
    return item;
  };
  const paint=()=>{
    const q=ypCarFinanceQuote(car,percent,years);
    depBtns.forEach(b=>b.btn.classList.toggle('on',b.pct===percent));
    termBtns.forEach(b=>b.btn.classList.toggle('on',b.term===years));
    depAmt.textContent=ypCarMoney(q.deposit)+' ('+q.percent+'% of the price)';
    const funds=ypCarAvailableFunds();
    const loans=ypCarLoanRows();
    const run=q.running||ypCarRunningCosts(car,ypCarOwned().length>0);
    const leftover=(typeof ypAffordWeek==='function'?ypAffordWeek({carRepay:q.repayWk,carRun:run.total}):null);
    const factRows=[
      row('Interest rate','9% a year','Fixed for the life of the loan','yp-car-finance-rate'),
      row('Term',q.years+' years','('+q.weeks+' weeks)','yp-car-finance-term'),
      row('Amount borrowed',ypCarMoney(q.loan),'The loan principal','yp-car-finance-borrowed'),
      row('Weekly repayment',ypCarMoney(q.repayWk)+' a week','At 9% a year','yp-car-finance-repay'),
      row('Total repayable',ypCarMoney(q.totalPaid),'All weekly repayments over the term','yp-car-finance-total'),
      row('Total interest',ypCarMoney(q.totalInterest),'Included in the total repayable','yp-car-finance-interest'),
      row('Fees',ypCarMoney(0),'No extra fees','yp-car-finance-fees'),
      row('You pay now',ypCarMoney(q.deposit),'The deposit leaves your bank when the car is handed over','yp-car-finance-due'),
      row('Bank pays the dealer',ypCarMoney(q.loan),'The loan is paid to the dealer at handover','yp-car-finance-dealer'),
      row('Dealer receives',ypCarMoney(q.price),'Deposit plus the loan, the full price','yp-car-finance-settlement'),
      row('Running costs',ypCarMoney(run.total)+' a week',ypCarRunningText(run),'yp-car-finance-running')
    ];
    factRows.push({heading:'Your funds and pending amounts'});
    factRows.push(row('In the bank now',ypCarMoney(funds.cash),'Includes any inheritance already released into your bank. That money is cash on hand, not a loan.','yp-car-finance-bank'));
    if(funds.outgoing>0)factRows.push(row('Pending outgoing',ypCarMoney(funds.outgoing),'Reserved so it cannot be spent twice','yp-car-finance-outgoing'));
    if(funds.incoming>0)factRows.push(row('Pending incoming',ypCarMoney(funds.incoming),'Money still to be received at settlement','yp-car-finance-incoming'));
    factRows.push(row('Available for this deposit',ypCarMoney(funds.available),'Bank balance, less pending outgoing, plus pending incoming','yp-car-finance-available'));
    funds.items.forEach(it=>{
      factRows.push(row(it.label,ypCarMoney(it.amount),it.hint||''));
    });
    if(loans.length){
      factRows.push({heading:'Existing loan repayments'});
      loans.forEach(l=>factRows.push(row(l.label,ypCarMoney(l.amount)+' a week',l.hint||'')));
    }
    if(leftover){
      factRows.push({heading:'Weekly affordability'});
      factRows.push(row('Left each week after this loan and running costs',ypCarMoney(Math.round(+leftover.leftMgr||0)), leftover.leftMgr<0?'This repayment would leave you short each week.':'After rent, living costs, existing loans and this car.','yp-car-finance-left'));
    }
    facts.replaceChildren();
    if(typeof ypFlow==='function')facts.appendChild(ypFlow(factRows));
    else factRows.forEach(r=>{
      if(r.heading){const h=document.createElement('p');h.className='yp-car-label';h.textContent=r.heading;facts.appendChild(h);return;}
      const p=document.createElement('p');p.className='yp-car-value';if(r.id)p.id=r.id;p.textContent=r.label+': '+r.value;facts.appendChild(p);
    });
    need.hidden=true;
  };
  paint();
  const onCodes=()=>{if(document.getElementById('yp-car-finance'))paint();};
  document.addEventListener('yp-codes',onCodes);
  const dropCodes=()=>document.removeEventListener('yp-codes',onCodes);
  const foot=document.createElement('div');
  foot.className='yp-step-foot';
  foot.appendChild(ypCarFootButton('Apply','hwb',()=>{
    dropCodes();
    const result=ypFinanceCar(car.id,percent,years);
    if(!result||!result.ok){need.hidden=false;need.textContent=(result&&result.why)||'This finance could not be approved.';return;}
    ui.shut();
    ypOpenCarHandover(result.car);
  },'yp-car-finance-apply'));
  foot.appendChild(ypCarFootButton('Back','hwx',()=>{dropCodes();ui.shut();ypOpenCarPay(car.id);},'yp-car-finance-back'));
  ui.card.append(body,foot);
}

function ypCarFundsWhy(need,funds,kind){
  funds=funds||ypCarAvailableFunds();
  const have=kind==='cash'?funds.spendableNow:funds.available;
  let why='You need '+ypCarMoney(need)+' '+(kind==='cash'?'spendable now':'available')+' for this purchase, but you have '+ypCarMoney(Math.max(0,have))+'.';
  if(funds.cash>=need&&have<need&&funds.outgoing>0){
    why+=' '+ypCarMoney(funds.outgoing)+' is already committed to pending settlements or rentals, so it cannot be used for this car as well.';
  }
  if(kind!=='cash'&&funds.incoming>0)why+=' Pending incoming of '+ypCarMoney(funds.incoming)+' is included in the amount available.';
  why+=' You have '+ypCarMoney(funds.cash)+' in the bank.';
  return why;
}

function ypBuyCar(id){
  const car=ypCarById(id);
  if(!car)return {ok:false,why:'This car is no longer available.'};
  if(ypCarOwnedIds().has(car.id))return {ok:false,why:'This car is no longer available.'};
  ypCarEnsureState();
  if(typeof G==='undefined'||!G)return {ok:false,why:'Your bank could not be checked right now.'};
  const price=Math.max(0,Math.round(+car.price||0));
  const funds=ypCarAvailableFunds();
  if(funds.spendableNow<price){
    return {ok:false,why:ypCarFundsWhy(price,funds,'cash')};
  }
  G.cash=ypCarBankCash()-price;
  const rec={id:car.id,brand:car.brand,model:car.model,year:car.year,price:price,image:car.image,pay:'cash',status:'handover-pending',handedOver:0,cashSettled:1,boughtWeek:(G.week|0),congratsSeen:0};
  ypSetCarWait(rec);
  G.vehicles.push(rec);
  if(typeof log==='function')log('Paid '+ypCarMoney(price)+' for the '+ypCarTitle(car)+'. Waiting for handover.');
  if(typeof save==='function')save();
  if(typeof hud==='function')hud();
  return {ok:true,car:rec,price:price,cash:G.cash,pending:true};
}

function ypFinanceCar(id,percent,years){
  const car=ypCarById(id);
  if(!car)return {ok:false,why:'This car is no longer available.'};
  if(ypCarOwnedIds().has(car.id))return {ok:false,why:'This car is no longer available.'};
  const q=ypCarFinanceQuote(car,percent,years);
  if(!q||!q.ok)return {ok:false,why:"Finance isn't available for cars this old"};
  ypCarEnsureState();
  if(typeof G==='undefined'||!G)return {ok:false,why:'Your bank could not be checked right now.'};
  const funds=ypCarAvailableFunds();
  if(funds.available<q.deposit){
    return {ok:false,why:ypCarFundsWhy(q.deposit,funds,'finance')};
  }
  const run=q.running&&q.running.total||ypCarRunningCosts(car,ypCarOwned().length>0).total;
  if(!ypCarFinanceFits(q.repayWk,run)){
    const a=typeof ypAffordWeek==='function'?ypAffordWeek({carRepay:q.repayWk,carRun:run}):null;
    const left=a?Math.round(+a.leftMgr||0):Math.round(ypCarWeekLeft());
    if(left<=0)return {ok:false,why:'You have no money left over in your week for this repayment and the running costs.'};
    return {ok:false,why:'You need '+ypCarMoney(q.repayWk+run)+' a week left over for this repayment and running costs, but you would have '+ypCarMoney(left)+' a week left.'};
  }
  const rec={
    id:car.id,brand:car.brand,model:car.model,year:car.year,price:q.price,image:car.image,
    pay:'finance',status:'handover-pending',handedOver:0,cashSettled:0,boughtWeek:(G.week|0),congratsSeen:0,
    quote:q,
    loan:{deposit:q.deposit,principal:q.loan,balance:q.loan,rate:YP_CAR_RATE,termYears:q.years,repayWk:q.repayWk,startWeek:null,totalPaid:q.totalPaid,totalInterest:q.totalInterest}
  };
  ypSetCarWait(rec);
  G.vehicles.push(rec);
  if(typeof log==='function')log('Applied for finance on the '+ypCarTitle(car)+'. Nothing is charged until handover.');
  if(typeof save==='function')save();
  if(typeof hud==='function')hud();
  return {ok:true,car:rec,quote:q,cash:G.cash,pending:true};
}

function ypSetCarWait(rec,clock){
  if(!rec)return rec;
  clock=clock||(typeof ypReadClock==='function'?ypReadClock():{wall:Date.now()});
  const real=typeof YP_RENT_APPLY_REAL_MS==='number'?YP_RENT_APPLY_REAL_MS:30000;
  const wait=typeof ypRentApplyWaitMs==='function'?ypRentApplyWaitMs(clock):real;
  const wall=clock&&clock.wall!=null?+clock.wall:Date.now();
  rec.approveAt=wall+real;
  rec.applyWaitTotalMs=real;
  if(typeof ypGameMs==='function')rec.approveGameMs=ypGameMs(clock)+wait;
  delete rec.pausedAnswerAt;
  return rec;
}

function ypCarMsLeft(rec,clock){
  if(!rec)return 0;
  if(typeof ypAnswerMsLeft==='function')return ypAnswerMsLeft(rec,clock);
  clock=clock||{wall:Date.now()};
  const wall=clock.wall!=null?+clock.wall:Date.now();
  return Math.max(0,(+rec.approveAt||0)-wall);
}

function ypCarCheckItems(rec){
  if(rec&&rec.pay==='cash')return ['Roadworthy Certificate Issued','Car Handed Over'];
  return ['Finance Application Submitted','Credit Check','Finance Approved','Roadworthy Certificate Issued','Car Handed Over'];
}

function ypFinishCarHandover(rec){
  if(!rec||ypCarIsHandedOver(rec))return rec;
  ypCarEnsureState();
  if(typeof G==='undefined'||!G)return rec;
  if(rec.pay==='finance'&&!rec.cashSettled){
    const dep=Math.max(0,Math.round(+((rec.quote&&rec.quote.deposit)||(rec.loan&&rec.loan.deposit))||0));
    const cash=ypCarBankCash();
    if(cash<dep)return rec;
    G.cash=cash-dep;
    rec.cashSettled=1;
    if(rec.loan){
      rec.loan.balance=Math.max(0,Math.round(+rec.loan.principal||0));
      rec.loan.startWeek=(G.week|0);
    }
    if(typeof log==='function')log('Finance approved for the '+ypCarTitle(rec)+'. Deposit '+ypCarMoney(dep)+' taken and the loan paid to the dealer.');
  }
  rec.status='owned';
  rec.handedOver=1;
  rec.handedWeek=(G.week|0);
  rec.boughtWeek=rec.boughtWeek||(G.week|0);
  if(typeof save==='function')save();
  if(typeof hud==='function')hud();
  return rec;
}

function ypSyncCarHandover(){
  ypCarEnsureState();
  if(typeof G==='undefined'||!G)return;
  let changed=false;
  (G.vehicles||[]).forEach(v=>{
    if(!ypCarIsPending(v))return;
    if(ypCarMsLeft(v)>0)return;
    const before=v.handedOver;
    ypFinishCarHandover(v);
    if(ypCarIsHandedOver(v)&&before===0)changed=true;
  });
  const due=(G.vehicles||[]).find(v=>ypCarIsHandedOver(v)&&v.congratsSeen!==1&&(v.pay==='finance'||v.pay==='cash')&&v.approveAt);
  if(due&&due.congratsSeen!==1){
    const open=document.getElementById('yp-apply-review');
    if(open&&open.dataset.ypCarId===due.id)return due;
    if(!open)ypOpenCarCongrats(due);
  }
  return due||null;
}

function ypOpenCarHandover(car){
  if(!car)return;
  if(ypCarIsHandedOver(car)&&car.congratsSeen!==1){ypOpenCarCongrats(car);return;}
  if(ypCarIsHandedOver(car)){ypOpenCarCongrats(car);return;}
  if(typeof ypExclusive==='function')ypExclusive('yp-apply-review');
  if(typeof ypCancelAgentClip==='function')ypCancelAgentClip();
  document.getElementById('yp-apply-review')?.remove();
  const panel=document.createElement('div');
  panel.id='yp-apply-review';
  panel.className='yp-steps yp-car-check';
  panel.dataset.ypCarId=car.id;
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-labelledby','yp-car-check-title');
  const card=document.createElement('div');
  card.className='card yp-listing yp-step';
  const shut=()=>{if(typeof ypAppTimer==='number'&&ypAppTimer)clearInterval(ypAppTimer);panel.remove();};
  if(typeof ypCardHeader==='function')card.appendChild(ypCardHeader({title:car.pay==='cash'?'Car Purchase':'Car Finance',titleId:'yp-car-check-title',id:'yp-car-check-x',onClose:shut}));
  if(car.image){
    const media=document.createElement('div');
    media.className='yp-listing-media';
    const img=document.createElement('img');
    ypCarImg(img,car);
    img.alt=ypCarTitle(car);
    media.appendChild(img);
    card.appendChild(media);
  }
  const name=document.createElement('p');
  name.className='yp-approval';
  name.id='yp-car-check-lead';
  name.textContent=car.pay==='cash'?'The yard is preparing your car.':'The bank is checking your finance.';
  card.appendChild(name);
  const left=document.createElement('p');
  left.className='yp-status';
  left.id='yp-car-check-left';
  card.appendChild(left);
  const meter=document.createElement('div');
  meter.className='yp-meter';
  meter.id='yp-car-check-meter';
  const fill=document.createElement('span');
  meter.appendChild(fill);
  card.appendChild(meter);
  const labels=ypCarCheckItems(car);
  const ul=document.createElement('ul');
  ul.className='yp-checks';
  ul.id='yp-car-checks';
  const items=labels.map(t=>{const li=document.createElement('li');li.textContent=t;ul.appendChild(li);return li;});
  card.appendChild(ul);
  if(typeof ypFlow==='function'){
    const q=car.quote||{};
    const loan=car.loan||{};
    const rows=[{label:'Car',value:ypCarTitle(car)},{label:'Price',value:ypCarMoney(car.price)}];
    if(car.pay==='finance'){
      rows.push({label:'Deposit',value:ypCarMoney(q.deposit||loan.deposit)});
      rows.push({label:'Loan',value:ypCarMoney(q.loan||loan.principal)});
      rows.push({label:'Weekly repayment',value:ypCarMoney(q.repayWk||loan.repayWk)+' a week'});
    }
    card.appendChild(ypFlow(rows));
  }
  const note=document.createElement('p');
  note.className='yp-limit';
  note.id='yp-car-check-note';
  note.textContent=car.pay==='cash'?'The price has already been taken from your bank. The car is not handed over until this finishes.':'Nothing is charged until your finance is approved and the car is handed over.';
  card.appendChild(note);
  const total=Number.isFinite(+car.applyWaitTotalMs)&&+car.applyWaitTotalMs>0?+car.applyWaitTotalMs:30000;
  const draw=()=>{
    const cur=(G.vehicles||[]).find(v=>v&&v.id===car.id)||car;
    if(ypCarIsHandedOver(cur)){
      if(typeof ypAppTimer==='number'&&ypAppTimer)clearInterval(ypAppTimer);
      ypOpenCarCongrats(cur);
      return;
    }
    const ms=ypCarMsLeft(cur);
    const done=Math.min(1,Math.max(0,1-ms/total));
    const waitTxt=(typeof ypCap==='function'&&typeof ypRealLeft==='function')?ypCap(ypRealLeft(ms))+' left.':(Math.ceil(ms/1000)+' seconds left.');
    left.textContent=waitTxt+' '+(cur.pay==='cash'?'The price has already been taken.':'Nothing is charged yet.');
    fill.style.width=Math.max(4,Math.round(done*100))+'%';
    items.forEach((li,i)=>{
      const ready=done>=(i+1)/(items.length+1)||done>=1;
      li.classList.toggle('done',ready);
    });
    if(ms<=0){
      ypFinishCarHandover(cur);
      if(ypCarIsHandedOver(cur)){
        if(typeof ypAppTimer==='number'&&ypAppTimer)clearInterval(ypAppTimer);
        ypOpenCarCongrats(cur);
      }
    }
  };
  draw();
  if(typeof ypAppTimer==='number'&&ypAppTimer)clearInterval(ypAppTimer);
  ypAppTimer=setInterval(()=>{
    if(!panel.isConnected){clearInterval(ypAppTimer);return;}
    const cur=(G.vehicles||[]).find(v=>v&&v.id===car.id)||car;
    draw();
  },200);
  if(typeof ypPinStepFooter==='function')ypPinStepFooter(card);
  panel.appendChild(card);
  document.body.appendChild(panel);
}

function ypOpenCarCongrats(car){
  if(!car)return;
  if(typeof ypExclusive==='function')ypExclusive('yp-apply-review');
  if(typeof ypCancelAgentClip==='function')ypCancelAgentClip();
  document.getElementById('yp-apply-review')?.remove();
  document.getElementById('yp-car-bought')?.remove();
  const panel=document.createElement('div');
  panel.id='yp-apply-review';
  panel.className='yp-steps yp-settle-popup yp-car-congrats';
  panel.dataset.ypCarId=car.id;
  panel.setAttribute('role','dialog');
  panel.setAttribute('aria-labelledby','yp-settle-title');
  const card=document.createElement('div');
  card.className='card yp-listing yp-step';
  const shut=()=>{
    const cur=(typeof G!=='undefined'&&G&&G.vehicles||[]).find(v=>v&&v.id===car.id);
    if(cur)cur.congratsSeen=1;
    if(typeof save==='function')save();
    panel.remove();
  };
  if(typeof ypCardHeader==='function')card.appendChild(ypCardHeader({title:'Congratulations',titleId:'yp-settle-title',id:'yp-car-congrats-x',onClose:shut}));
  else{const h=document.createElement('h2');h.id='yp-settle-title';h.textContent='Congratulations';card.appendChild(h);}
  if(car.image){
    const media=document.createElement('div');
    media.className='yp-listing-media';
    const img=document.createElement('img');
    img.id='yp-car-congrats-photo';
    ypCarImg(img,car);
    img.alt=ypCarTitle(car);
    media.appendChild(img);
    card.appendChild(media);
  }
  const copy=document.createElement('p');
  copy.className='yp-approval';
  copy.id='yp-car-congrats-copy';
  copy.textContent=car.pay==='cash'?'Congratulations, your car has been handed over.':'Congratulations, your finance is approved. And your car has been handed over.';
  card.appendChild(copy);
  const loan=car.loan||{};
  const q=car.quote||{};
  const rows=[{label:'Car',value:ypCarTitle(car)},{label:'Price',value:ypCarMoney(car.price)}];
  if(car.pay==='finance'||loan.principal){
    rows.push({label:'Deposit',value:ypCarMoney(q.deposit||loan.deposit)});
    rows.push({label:'Loan',value:ypCarMoney(q.loan||loan.principal)});
    rows.push({label:'Weekly repayment',value:ypCarMoney(q.repayWk||loan.repayWk)+' a week'});
  }
  if(typeof ypFlow==='function')card.appendChild(ypFlow(rows));
  const btn=document.createElement('button');
  btn.type='button';
  btn.className='hwb';
  btn.id='yp-car-congrats-done';
  btn.textContent='Continue';
  btn.addEventListener('click',()=>{shut();if(typeof ypOpenCarYardListings==='function')ypOpenCarYardListings();});
  card.appendChild(btn);
  if(typeof ypPinStepFooter==='function')ypPinStepFooter(card);
  panel.appendChild(card);
  document.body.appendChild(panel);
  const cur=(typeof G!=='undefined'&&G&&G.vehicles||[]).find(v=>v&&v.id===car.id);
  if(cur){/* leave congratsSeen until Continue so reload can reopen it */}
}

function ypOpenCarBought(car){
  if(!car)return;
  if(ypCarIsPending(car)){ypOpenCarHandover(car);return;}
  ypOpenCarCongrats(car);
}

function ypRenderOwnedVehicles(){
  const cars=ypCarOwned();
  if(!cars.length){
    const empty=document.createElement('div');
    empty.className='fin';
    empty.id='yp-vehicles-empty';
    empty.textContent="You don't own any vehicles yet.";
    return empty;
  }
  const wrap=document.createElement('div');
  wrap.className='yp-vehicle-list';
  wrap.id='yp-vehicles';
  let prevSky='';
  cars.forEach(car=>{
    const row=document.createElement('div');
    row.className='yp-vehicle-row';
    const img=document.createElement('img');
    ypCarImg(img,car,null,prevSky);
    prevSky=img.dataset.sky||prevSky;
    img.alt=ypCarTitle(car);
    const meta=document.createElement('div');
    const name=document.createElement('p');
    name.className='yp-car-name';
    name.textContent=ypCarTitle(car);
    const price=document.createElement('p');
    price.className='yp-car-price';
    price.textContent=ypCarMoney(car.price);
    meta.append(name,price);
    row.append(img,meta);
    wrap.appendChild(row);
  });
  return wrap;
}

if(typeof document!=='undefined'){
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ypCarYardStyle);
  else ypCarYardStyle();
}
