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
function ypCarOwned(){ypCarEnsureState();if(typeof G==='undefined'||!G)return [];return (G.vehicles||[]).filter(Boolean);}
function ypCarOwnedIds(){return new Set(ypCarOwned().map(v=>String(v.id||'')).filter(Boolean));}
function ypCarYardStock(){const owned=ypCarOwnedIds();return YP_CAR_CATALOG.filter(c=>c&&!owned.has(c.id));}
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
#yp-car-yard-intro,#yp-car-yard,#yp-car-detail,#yp-car-bought,#yp-car-pay,#yp-car-finance{position:fixed;left:0;right:0;top:calc(var(--sat, 0px) + 88px);bottom:calc(var(--sab, 0px) + 86px);width:auto;height:auto;max-height:none;z-index:28;display:flex;align-items:stretch;justify-content:stretch;overflow:hidden;overscroll-behavior:none;touch-action:none;padding:0 10px;background:transparent;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#14213d;box-sizing:border-box}
#yp-car-yard-intro .card,#yp-car-yard .card,.yp-car-running{margin:10px 0 0;padding:10px 12px;border-radius:12px;background:#f4f7fb}.yp-car-running p{margin:0;text-align:left}.yp-car-running-total{font:500 15px/1.3 Inter,system-ui,sans-serif;color:#14213d}.yp-car-running-total b{font-weight:700}.yp-car-running-parts{margin-top:2px!important;font:400 13px/1.35 Inter,system-ui,sans-serif;color:#5a6780}
#yp-car-detail .card,#yp-car-bought .card,#yp-car-pay .card,#yp-car-finance .card{background:#fff;border-radius:24px;width:100%;max-width:none;padding:0 16px 16px;text-align:left;box-shadow:0 10px 24px rgba(11,37,69,.18);max-height:none;height:100%;overflow:hidden;margin:0;display:flex;flex-direction:column;box-sizing:border-box}
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
  return {ok:true,cashOnly:false,price,percent:Math.round(+percent||0),deposit,loan,years,rate:YP_CAR_RATE,repayWk};
}
function ypCarActiveLoans(){
  return ypCarOwned().filter(v=>v&&v.loan&&Math.round(+v.loan.balance||0)>0);
}
function ypCarLoanBalance(){
  return ypCarActiveLoans().reduce((sum,v)=>sum+Math.max(0,Math.round(+v.loan.balance||0)),0);
}
function ypCarLoanRepayWk(){
  return ypCarActiveLoans().reduce((sum,v)=>sum+Math.max(0,Math.round(+v.loan.repayWk||0)),0);
}
function ypCarWeekLeft(){
  if(typeof ypAffordWeek==='function'){
    const a=ypAffordWeek();
    return a&&Number.isFinite(+a.leftMgr)?+a.leftMgr:0;
  }
  return 0;
}
function ypCarFinanceFits(repayWk){
  repayWk=Math.max(0,Math.round(+repayWk||0));
  if(typeof ypAffordWeek==='function'){
    const a=ypAffordWeek({carRepay:repayWk});
    return !!(a&&+a.leftMgr>=0);
  }
  return ypCarWeekLeft()>=repayWk;
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

function ypOpenCarYard(){ypOpenCarYardIntro();}

function ypOpenCarYardIntro(){
  ypCarYardStyle();
  let playTimer=0,bubbleTimer=0,shown=false;
  const ui=ypCarPanel('yp-car-yard-intro','Car Yard',{onClose:()=>{
    const v=document.getElementById('yp-car-salesman');
    if(v){try{v.pause();}catch(e){}}
    if(playTimer)clearTimeout(playTimer);
    if(bubbleTimer)clearTimeout(bubbleTimer);
  }});
  const body=document.createElement('div');
  body.id='yp-car-intro-body';
  const video=document.createElement('video');
  video.id='yp-car-salesman';
  video.setAttribute('playsinline','');
  video.setAttribute('webkit-playsinline','');
  video.setAttribute('preload','auto');
  video.setAttribute('poster',YP_CAR_POSTER);
  video.playsInline=true;
  video.preload='auto';
  video.controls=false;
  video.muted=false;
  video.defaultMuted=false;
  video.autoplay=true;
  video.src=YP_CAR_VIDEO;
  video.setAttribute('src',YP_CAR_VIDEO);
  const bubble=document.createElement('button');
  bubble.type='button';
  bubble.id='yp-car-view-listings';
  bubble.textContent='View Listings';
  bubble.setAttribute('aria-label','View Listings');
  const playBtn=document.createElement('button');
  playBtn.type='button';
  playBtn.id='yp-car-tap-play';
  playBtn.textContent='Tap To Play';
  const ready=()=>!!(video.ended||(video.currentTime||0)>=YP_CAR_INTRO_AT);
  const showBubble=()=>{
    if(shown||!ready())return;
    shown=true;
    bubble.classList.add('on');
    ypMarkCarYardSeen();
  };
  const goListings=()=>{
    if(playTimer)clearTimeout(playTimer);
    if(bubbleTimer)clearTimeout(bubbleTimer);
    try{video.pause();}catch(e){}
    ypMarkCarYardSeen();
    ui.shut();
    ypOpenCarYardListings();
  };
  bubble.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();goListings();});
  const armBubble=()=>{
    if(bubbleTimer)clearTimeout(bubbleTimer);
    const now=video.currentTime||0;
    const wait=Math.max(80,Math.round((YP_CAR_INTRO_AT-now)*1000));
    bubbleTimer=setTimeout(()=>{if(ready())showBubble();else armBubble();},wait);
  };
  video.addEventListener('timeupdate',()=>{if(ready())showBubble();});
  video.addEventListener('ended',showBubble);
  video.addEventListener('playing',armBubble);
  video.addEventListener('loadedmetadata',armBubble);
  body.append(video,bubble,playBtn);
  const trySound=()=>{
    video.muted=false;
    video.defaultMuted=false;
    const play=video.play();
    if(play&&play.then)return play.then(()=>{playBtn.classList.remove('on');}).catch(()=>{
      video.muted=true;
      return video.play().then(()=>{playBtn.classList.add('on');}).catch(()=>{playBtn.classList.add('on');});
    });
    playBtn.classList.remove('on');
  };
  playBtn.addEventListener('click',event=>{
    event.preventDefault();
    event.stopPropagation();
    trySound();
  });
  body.addEventListener('click',event=>{
    if(event.target.closest('#yp-car-view-listings')||event.target.closest('#yp-car-tap-play'))return;
    if(ypCarYardSeen())goListings();
  });
  ui.card.appendChild(body);
  playTimer=setTimeout(trySound,0);
  trySound();
  armBubble();
}

function ypOpenCarYardListings(){
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
    ypOpenCarBought(result.car);
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
  addLabel('Rate','yp-car-rate-label');
  const rate=document.createElement('p');
  rate.className='yp-car-value';
  rate.id='yp-car-finance-rate';
  rate.textContent='9% a year';
  body.appendChild(rate);
  addLabel('Amount Borrowed','yp-car-loan-label');
  const borrowed=document.createElement('p');
  borrowed.className='yp-car-value';
  borrowed.id='yp-car-finance-borrowed';
  body.appendChild(borrowed);
  addLabel('Weekly Repayment','yp-car-repay-label');
  const repay=document.createElement('p');
  repay.className='yp-car-value';
  repay.id='yp-car-finance-repay';
  body.appendChild(repay);
  const need=document.createElement('p');
  need.id='yp-car-finance-need';
  need.hidden=true;
  body.appendChild(need);
  const paint=()=>{
    const q=ypCarFinanceQuote(car,percent,years);
    depBtns.forEach(b=>b.btn.classList.toggle('on',b.pct===percent));
    termBtns.forEach(b=>b.btn.classList.toggle('on',b.term===years));
    borrowed.textContent=ypCarMoney(q.loan);
    repay.textContent=ypCarMoney(q.repayWk)+' a week';
    need.hidden=true;
  };
  paint();
  const foot=document.createElement('div');
  foot.className='yp-step-foot';
  foot.appendChild(ypCarFootButton('Apply','hwb',()=>{
    const result=ypFinanceCar(car.id,percent,years);
    if(!result||!result.ok){need.hidden=false;need.textContent=(result&&result.why)||'This finance could not be approved.';return;}
    ui.shut();
    ypOpenCarBought(result.car);
  },'yp-car-finance-apply'));
  foot.appendChild(ypCarFootButton('Back','hwx',()=>{ui.shut();ypOpenCarPay(car.id);},'yp-car-finance-back'));
  ui.card.append(body,foot);
}

function ypBuyCar(id){
  const car=ypCarById(id);
  if(!car)return {ok:false,why:'This car is no longer available.'};
  if(ypCarOwnedIds().has(car.id))return {ok:false,why:'This car is no longer available.'};
  ypCarEnsureState();
  if(typeof G==='undefined'||!G)return {ok:false,why:'Your bank could not be checked right now.'};
  const price=Math.max(0,Math.round(+car.price||0));
  const cash=Math.max(0,Math.round(+G.cash||0));
  if(cash<price){
    return {ok:false,why:'You need '+ypCarMoney(price)+' in the bank to buy this car, but you have '+ypCarMoney(cash)+'.'};
  }
  G.cash=cash-price;
  const rec={id:car.id,brand:car.brand,model:car.model,year:car.year,price:price,image:car.image,boughtWeek:(G.week|0)};
  G.vehicles.push(rec);
  if(typeof log==='function')log('Bought the '+ypCarTitle(car)+' for '+ypCarMoney(price)+'.');
  if(typeof save==='function')save();
  if(typeof hud==='function')hud();
  return {ok:true,car:rec,price:price,cash:G.cash};
}

function ypFinanceCar(id,percent,years){
  const car=ypCarById(id);
  if(!car)return {ok:false,why:'This car is no longer available.'};
  if(ypCarOwnedIds().has(car.id))return {ok:false,why:'This car is no longer available.'};
  const q=ypCarFinanceQuote(car,percent,years);
  if(!q||!q.ok)return {ok:false,why:"Finance isn't available for cars this old"};
  ypCarEnsureState();
  if(typeof G==='undefined'||!G)return {ok:false,why:'Your bank could not be checked right now.'};
  const cash=Math.max(0,Math.round(+G.cash||0));
  if(cash<q.deposit){
    return {ok:false,why:'You need '+ypCarMoney(q.deposit)+' in the bank for the deposit, but you have '+ypCarMoney(cash)+'.'};
  }
  if(!ypCarFinanceFits(q.repayWk)){
    const left=Math.max(0,Math.round(ypCarWeekLeft()));
    if(left<=0)return {ok:false,why:'You have no money left over in your week for this repayment.'};
    return {ok:false,why:'You need '+ypCarMoney(q.repayWk)+' a week left over for this repayment, but you have '+ypCarMoney(left)+' a week left.'};
  }
  G.cash=cash-q.deposit;
  const rec={
    id:car.id,brand:car.brand,model:car.model,year:car.year,price:q.price,image:car.image,boughtWeek:(G.week|0),
    loan:{deposit:q.deposit,principal:q.loan,balance:q.loan,rate:YP_CAR_RATE,termYears:q.years,repayWk:q.repayWk,startWeek:(G.week|0)}
  };
  G.vehicles.push(rec);
  if(typeof log==='function')log('Bought the '+ypCarTitle(car)+' with a '+ypCarMoney(q.deposit)+' deposit and a '+ypCarMoney(q.repayWk)+' a week loan.');
  if(typeof save==='function')save();
  if(typeof hud==='function')hud();
  return {ok:true,car:rec,quote:q,cash:G.cash};
}

function ypOpenCarBought(car){
  const ui=ypCarPanel('yp-car-bought','Purchase Complete',{close:false});
  const body=document.createElement('div');
  body.className='yp-step-body';
  if(car&&car.image){
    const img=document.createElement('img');
    img.id='yp-car-bought-photo';
    ypCarImg(img,car);
    img.alt=ypCarTitle(car);
    body.appendChild(img);
  }
  const copy=document.createElement('p');
  copy.className='yp-car-copy';
  copy.id='yp-car-bought-copy';
  const loan=car&&car.loan;
  if(loan){
    copy.textContent='You bought the '+ypCarTitle(car)+' for '+ypCarMoney(car.price)+'. You paid a '+ypCarMoney(loan.deposit)+' deposit. Your loan is '+ypCarMoney(loan.principal)+', at '+ypCarMoney(loan.repayWk)+' a week.';
  }else{
    copy.textContent='You bought the '+ypCarTitle(car)+' for '+ypCarMoney(car&&car.price)+'.';
  }
  body.appendChild(copy);
  const foot=document.createElement('div');
  foot.className='yp-step-foot';
  foot.appendChild(ypCarFootButton('Done','hwb',()=>{ui.shut();ypOpenCarYardListings();},'yp-car-bought-done'));
  ui.card.append(body,foot);
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
