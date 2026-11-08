const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const http = require('node:http');
const {spawn, execFileSync} = require('node:child_process');

const root = path.join(__dirname, '..');
const jsPath = path.join(root, '3d-5d6ea64333a6', 'map-preview.js');
const htmlPath = path.join(root, '3d-5d6ea64333a6', 'index.html');
const code = fs.readFileSync(jsPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');
let passed = 0;
function check(name, fn) {
  const result = fn();
  if (result && typeof result.then === 'function') {
    return result.then(() => { console.log('PASS', name); passed++; });
  }
  console.log('PASS', name);
  passed++;
}

const marker = '\n<script src="map-preview.js"></script>\n';
check('save-up body is two centred paragraphs and income bands are unchanged', () => {
  assert.ok(html.includes(marker));
  const first = 'Looks like you may have to start saving towards your first home deposit. If any are available, room share or boarding is usually the best way to save.';
  const second = 'Once you have family or friends in the game, you may choose to live with them for free.';
  assert.ok(html.includes('<h3>Save up first?</h3><p>' + first + '</p><p class="hw-follow">' + second + '</p>'));
  assert.equal(html.includes('for free also.'), false);
  assert.equal(html.includes('deposit.</p><div class="hwr hi">'), false);
  const flow = Buffer.from(html.match(/const FLOW_SRC_B64='([^']+)'/)[1], 'base64').toString();
  const bands = '[[0,10000],[10000,20000],[20000,30000],[30000,40000],[40000,50000],[50000,60000],[60000,70000],[70000,80000],[80000,90000],[90000,100000],[100000,110000],[110000,120000],[120000,130000],[130000,140000],[140000,150000],[150000,160000],[160000,170000],[170000,180000],[180000,190000],[190000,200000]]';
  assert.ok(flow.includes('const BANDS=' + bands));
  assert.ok(flow.includes("$('band').onchange=e=>{const [lo,hi]=BANDS[+e.target.value];P.income.band={min:lo,max:hi,mid:(lo+hi)/2};if(!P.income.touched){P.income.touched=1;setExpFreq(P.income.freq||'fortnight')}saveP();renderIncome()};"));
  assert.ok(flow.includes('id="band-btn"') || flow.includes("btn.id='band-btn'"));
  assert.ok(flow.includes("sel.dispatchEvent(new Event('change'"));
  assert.equal(flow.includes("row('Starting place'"), false);
  assert.ok(flow.includes("row('Take-home pay'"));
  assert.ok(flow.includes("row('Starting savings'"));
  assert.ok(flow.includes("row('Expenses'"));
  assert.ok(flow.includes('Left over (after tax)'));
  assert.ok(flow.includes("<p>Good to see you <b>'+escH(who)+'</b>, just remember the saying...</p><p>Do not save what is left after spending, but spend what is left after saving.</p>"));
  assert.equal(flow.includes('Your properties are right where you left them.'), false);
  assert.equal(flow.includes("You\\'re starting in"), false);
  assert.ok(flow.includes("We\\'re starting you in"));
});
check('root and test pages are the published files', () => {
  const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  assert.equal(sha(path.join(root, 'index.html')), '9e262497dcd5718db66f63fc71aa80c6beb4de25504fbef15fe6d17625a9bc93');
  assert.equal(sha(path.join(root, 'test/index.html')), 'e0ff1bf59303707c72ca6c53e1f5c597b3d3330e55ca882e618068e92a53c967');
});
check('pre-map copy and insurance formula remain', () => {
  assert.ok(html.includes('Choose your Rental'));
  assert.ok(html.includes('they decide if you’re successful or not.'));
  assert.ok(html.includes('Buying a House'));
  assert.ok(html.includes('Buying a Block of Land'));
  assert.ok(html.includes('m2*2500*0.005'));
  assert.ok(html.includes('Your current everyday living costs before renting, boarding or having a mortgage.'));
  assert.ok(html.includes('The game clock starts once you choose.'));
});
check('preview script does not port auction, valuation, address lookup, or lot binding', () => {
  for (const banned of ['pilotAuction', 'pilotAutoValue', 'pilotValuation', 'pilotAddress', 'lookupAddress', 'UI.plot', 'fe.global', 'baselines-v1']) {
    assert.equal(code.includes(banned), false, banned);
  }
  assert.ok(code.includes('yp.mapsel.v1'));
  assert.ok(code.includes('not a Your Plot lot'));
  assert.ok(code.includes('no game owner'));
  assert.ok(code.includes('no game price'));
  assert.ok(code.includes('not a stable property identity'));
  assert.ok(code.includes('existing Coralwood game record'));
  assert.equal(code.includes('api.maptiler.com') && code.includes("u.hostname==='api.maptiler.com'"), true);
});

const helperSrc = code.split('// END TESTABLE SELECTION')[0];
const select = vm.runInNewContext(helperSrc + ';pilotSelection.components', {AbortController, AbortSignal, URL, URLSearchParams});
const square = (x, y) => [[[x, y], [x + 1, y], [x + 1, y + 1], [x, y + 1], [x, y]]];
const feature = (rings, id) => ({id, properties: {height: 5}, geometry: {type: 'Polygon', coordinates: rings}});
check('unrelated footprints with shared ids stay separate', () => assert.equal(select([feature(square(0, 0), 7), feature(square(4, 0), 7)], [.5, .5]).length, 1));
check('disconnected MultiPolygon selects the clicked component', () => {
  const result = select([{geometry: {type: 'MultiPolygon', coordinates: [square(0, 0), square(4, 0), square(8, 0)]}}], [4.5, .5]);
  assert.equal(result.length, 1);
  assert.equal(result[0].geometry.type, 'Polygon');
  assert.equal(JSON.stringify(result[0].geometry.coordinates), JSON.stringify(square(4, 0)));
});
check('hole interior and boundary are rejected', () => {
  const outer = [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], ...square(2, 2)];
  assert.equal(select([feature(outer)], [2.5, 2.5]).length, 0);
  assert.equal(select([feature(outer)], [2, 2.5]).length, 0);
  assert.equal(select([feature(outer)], [1, 1]).length, 1);
});
check('duplicate geometry is collapsed and a shared edge is not a selection', () => {
  assert.equal(select([feature(square(0, 0)), feature(square(0, 0))], [.5, .5]).length, 1);
  assert.equal(select([feature(square(0, 0)), feature(square(1, 0))], [1, .5]).length, 0);
});

const streetApi = vm.runInNewContext(code.split('// END TESTABLE STREET SEARCH')[0] + ';pilotStreetSearch', {URL, URLSearchParams, AbortSignal});
check('structured street helper rejects house numbers and keeps a suburb inside its city', () => {
  const road = {result_type: 'street', street: 'Barolin Street', suburb: 'Avenell Heights', city: 'Bundaberg', country: 'Australia', lon: 152.35, lat: -24.89};
  const run = (rows, town = 'Bundaberg') => streetApi.results({results: rows}, 'Barolin Street', town, 'Australia');
  assert.equal(run([road]).length, 1);
  assert.equal(run([road], 'Avenell Heights').length, 1);
  assert.equal(run([{...road, city: 'Brisbane'}]).length, 0);
  assert.equal(run([{...road, housenumber: '1'}]).length, 0);
  assert.throws(() => streetApi.query('123 Queen Street', 'Bundaberg', 'Australia'));
});
const identitySrc = code.split('// END TESTABLE IDENTITY')[0];
const ident = vm.runInNewContext(identitySrc + ';({ypSelection,ypPersistable,ypSameFootprint,ypNextGameId,autocompleteQuery,geocodeUrl,pilotSuggest})', {crypto, URL, URLSearchParams, AbortController, AbortSignal});
check('selection id is a yp UUID and coordinate only', () => {
  const id = ident.ypNextGameId(null, false);
  const saved = ident.ypPersistable({gameId: id, coordinate: [152.35, -24.86], geometry: {type: 'Polygon'}});
  assert.deepEqual(Object.keys(saved).sort(), ['coordinate', 'gameId', 'version']);
  assert.equal(saved.version, 1);
  assert.equal(ident.ypSelection({gameId: 'c1:400', coordinate: [152, -24]}), null);
  assert.equal(ident.ypSelection({gameId: id, coordinate: [181, 0]}), null);
  assert.equal(ident.ypNextGameId(id, true), id);
});
check('same rendered polygon reuses the id and a different component does not', () => {
  const a = {geometry: {type: 'Polygon', coordinates: square(0, 0)}};
  const b = {geometry: {type: 'Polygon', coordinates: square(4, 0)}};
  assert.equal(ident.ypSameFootprint([a], [a]), true);
  assert.equal(ident.ypSameFootprint([a], [b]), false);
});
check('area then street queries stay explicit and do not carry the key', () => {
  const area = ident.autocompleteQuery('area', 'Ave', null, 'Australia');
  assert.equal(area.type, 'locality');
  assert.equal(area.filter, 'countrycode:au');
  assert.equal('apiKey' in area, false);
  const street = ident.autocompleteQuery('street', 'Bar', {place_id: 'place-1'}, 'Australia');
  assert.equal(street.text, 'Bar');
  assert.equal(street.type, 'street');
  assert.equal(street.filter, 'place:place-1');
  assert.equal('apiKey' in street, false);
  assert.throws(() => ident.autocompleteQuery('street', '12 Queen', {place_id: 'place-1'}, 'Australia'));
  assert.throws(() => ident.autocompleteQuery('street', 'Bar', null, 'Australia'));
  assert.throws(() => ident.autocompleteQuery('area', '467', null, 'Australia'));
  const postcode = ident.autocompleteQuery('area', '4670', null, 'Australia');
  assert.equal(postcode.limit, '100');
  assert.throws(() => ident.geocodeUrl(area, ''));
  const url = ident.geocodeUrl(street, 'test-key');
  assert.equal(url.hostname, 'api.geoapify.com');
  assert.equal(url.pathname, '/v1/geocode/autocomplete');
  assert.equal(url.searchParams.get('bias'), 'countrycode:none');
  assert.equal(url.searchParams.get('filter'), 'place:place-1');
  assert.equal(url.searchParams.get('type'), 'street');
  assert.equal(url.searchParams.has('housenumber'), false);
});
check('stale suggestion guard aborts the previous request', () => {
  const gate = ident.pilotSuggest.gate();
  const first = gate.next();
  const second = gate.next();
  assert.equal(first.signal.aborted, true);
  assert.equal(gate.current(second.version), true);
});
check('same-place suggestions merge and distinct towns stay separate', () => {
  const row = (over) => ({result_type: 'suburb', place_id: 'p', housenumber: undefined, country: 'Australia', country_code: 'au', ...over});
  const data = {results: [
    row({place_id: 'heights-suburb', name: 'Avenell Heights', state: 'Queensland', lon: 152.35, lat: -24.88, result_type: 'suburb'}),
    row({place_id: 'heights-district', name: 'Avenell Heights', state: 'Queensland', lon: 152.352, lat: -24.881, result_type: 'district'}),
    row({place_id: 'avenel', name: 'Avenel', state: 'Victoria', postcode: '3664', lon: 145.23, lat: -36.90, result_type: 'suburb'}),
    row({place_id: 'richmond-vic', name: 'Richmond', state: 'Victoria', city: 'Melbourne', lon: 144.998, lat: -37.818}),
    row({place_id: 'richmond-nsw', name: 'Richmond', state: 'New South Wales', city: 'Sydney', lon: 150.751, lat: -33.599}),
    row({place_id: 'hamilton-a', name: 'Hamilton', state: 'Queensland', city: 'Brisbane', lon: 153.06, lat: -27.44}),
    row({place_id: 'hamilton-b', name: 'Hamilton', state: 'Queensland', city: 'Townsville', lon: 146.82, lat: -19.26})
  ]};
  const areas = ident.pilotSuggest.areas(data, 'Australia', null);
  const labels = areas.map(item => item.label);
  assert.equal(labels.filter(label => label.startsWith('Avenell Heights')).length, 1);
  assert.equal(areas.find(item => item.label.startsWith('Avenell Heights')).place_id, 'heights-suburb');
  assert.equal(areas.find(item => item.label.startsWith('Avenell Heights')).lon, 152.35);
  assert.equal(labels.filter(label => label.startsWith('Avenel,')).length, 1);
  assert.equal(labels.filter(label => label.startsWith('Richmond')).length, 2);
  assert.equal(labels.filter(label => label.startsWith('Hamilton')).length, 2);
});
check('suggestion buttons use text, not HTML', () => {
  const roads = ident.pilotSuggest.roads({results: [{result_type: 'street', street: '<img src=x>', suburb: 'Avenell Heights', city: 'Bundaberg', country: 'Australia', lon: 1, lat: 2, place_id: 'p'}]}, {result_type: 'city', name: 'Bundaberg', country: 'Australia', place_id: 'area'});
  assert.equal(roads.length, 1);
  assert.ok(roads[0].label.includes('<img src=x>'));
});

function once(port, pathName, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({hostname: '127.0.0.1', port, path: pathName, headers}, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({status: res.statusCode, body: Buffer.concat(chunks).toString('utf8'), type: res.headers['content-type'] || '', acao: res.headers['access-control-allow-origin']}));
    });
    req.on('error', reject);
    req.end();
  });
}

check('no device location, hidden street labels, and shared preview rentals', () => {
  const src = code.split('// END TESTABLE IDENTITY')[1].split('// END TESTABLE STOCK')[0];
  assert.equal(src.includes('getCurrentPosition'), false);
  assert.equal(src.includes('watchPosition'), false);
  assert.equal(src.includes('geolocation'), false);
  assert.equal(code.includes('getCurrentPosition'), false);
  assert.equal(code.includes('watchPosition'), false);
  assert.equal(code.includes('navigator.geolocation'), false);
  assert.equal(code.includes('My Location'), false);
  assert.equal(code.includes('yp-accuracy'), false);
  assert.ok(code.includes("title.textContent='Choose location'"));
  assert.ok(code.includes("placeholder='enter town or suburb'"));
  assert.ok(code.includes("moveNote.textContent='You can also search on the map'"));
  assert.equal(code.includes('About search'), false);
  assert.equal(code.includes('Choose one suggestion. None is selected automatically.'), false);
  const api = vm.runInNewContext(src + '\n;({ypShouldHideLabel,ypEnsureSuburbStock,ypFreshStock,ypRadiusList,ypPage,ypInView,ypRentalDetail,ypApplyPreview,ypSuburbKey,ypDistanceM,ypDestination,ypBuildingSites,ypPointInRing,ypSpreadSites,ypAreaStockReady,ypCommitAreaStock,ypListingModel,ypRentPicture,ypMoneyText,ypApplySample,ypRefreshSample,ypCancelSample,ypConfirmSample,ypChargeSampleWeek,YP_TEST_APPROVAL_MS,YP_TEST_CONFIRM_MS})', {});
  assert.equal(api.ypShouldHideLabel({id:'road_label', type:'symbol', 'source-layer':'transportation_name'}), true);
  assert.equal(api.ypShouldHideLabel({id:'road', type:'line', 'source-layer':'transportation'}), false);
  assert.equal(api.ypShouldHideLabel({id:'building', type:'fill', 'source-layer':'building'}), false);
  assert.equal(api.ypShouldHideLabel({id:'housenumber', type:'symbol', 'source-layer':'housenumber'}), true);
  const place = {label:'Avenell Heights', lon:152.35, lat:-24.88};
  const bargara = {label:'Bargara, Queensland, Australia', lon:152.464, lat:-24.814};
  assert.equal(api.ypEnsureSuburbStock(api.ypFreshStock(), bargara).rentals.length, 0);
  assert.equal(api.ypEnsureSuburbStock(api.ypFreshStock(), bargara, []).rentals.length, 0);
  const land = api.ypDestination(bargara.lon, bargara.lat, 270, 350);
  const offshore = api.ypDestination(bargara.lon, bargara.lat, 90, 1600);
  const coastal = api.ypEnsureSuburbStock(api.ypFreshStock(), bargara, [{lon:land.lon, lat:land.lat}, {lon:offshore.lon, lat:offshore.lat}]);
  assert.equal(coastal.rentals.length, 2);
  const house = (lon, lat, size = 0.00012) => [[lon, lat], [lon + size, lat], [lon + size, lat + size], [lon, lat + size], [lon, lat]];
  const west = api.ypDestination(bargara.lon, bargara.lat, 270, 400);
  const west2 = api.ypDestination(bargara.lon, bargara.lat, 280, 520);
  const gap = {type:'MultiPolygon', coordinates:[[house(west.lon, west.lat)], [house(west2.lon, west2.lat)]]};
  const badAverageLon = (west.lon + west2.lon) / 2, badAverageLat = (west.lat + west2.lat) / 2;
  const sites = api.ypBuildingSites([
    {sourceLayer:'building', geometry: gap},
    {sourceLayer:'landuse', geometry:{type:'Polygon', coordinates:[house(bargara.lon, bargara.lat, 0.004)]}},
    {sourceLayer:'building', geometry:{type:'Polygon', coordinates:[house(bargara.lon, bargara.lat, 0.02)]}}
  ], bargara);
  assert.equal(sites.length, 2);
  assert.equal(sites.every(p => api.ypPointInRing(p.lon, p.lat, house(west.lon, west.lat)) || api.ypPointInRing(p.lon, p.lat, house(west2.lon, west2.lat))), true);
  assert.equal(sites.some(p => api.ypDistanceM(badAverageLon, badAverageLat, p.lon, p.lat) < 15), false);
  const wide = [];
  for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) {
    const north = api.ypDestination(bargara.lon, bargara.lat, 0, y * 700);
    const point = api.ypDestination(north.lon, north.lat, 90, x * 700);
    wide.push({sourceLayer:'building', geometry:{type:'Polygon', coordinates:[house(point.lon, point.lat)]}});
  }
  const outside = api.ypDestination(bargara.lon, bargara.lat, 90, 2800);
  wide.push({sourceLayer:'building', geometry:{type:'Polygon', coordinates:[house(outside.lon, outside.lat)]}});
  wide.push({sourceLayer:'landuse', geometry:{type:'Polygon', coordinates:[house(bargara.lon, bargara.lat, 0.004)]}});
  const spread = api.ypBuildingSites(wide, bargara);
  assert.equal(spread.length, 10);
  assert.equal(spread.every(p => api.ypDistanceM(bargara.lon, bargara.lat, p.lon, p.lat) <= 2000), true);
  assert.equal(spread.filter(p => api.ypDistanceM(bargara.lon, bargara.lat, p.lon, p.lat) > 1200).length >= 4, true);
  assert.equal(spread.some(p => api.ypDistanceM(outside.lon, outside.lat, p.lon, p.lat) < 30), false);
  const seenOnce = api.ypAreaStockReady('', spread, true);
  assert.equal(seenOnce.ready, false);
  const seenTwice = api.ypAreaStockReady(seenOnce.sig, spread, true);
  assert.equal(seenTwice.ready, true);
  let hold = {key:'', sig:'', tilesLoaded:true};
  const firstCommit = api.ypCommitAreaStock(api.ypFreshStock(), bargara, spread, hold);
  assert.equal(firstCommit.changed, false);
  const secondCommit = api.ypCommitAreaStock(firstCommit.store, bargara, spread, firstCommit.hold);
  assert.equal(secondCommit.changed, true);
  assert.equal(secondCommit.placed, 10);
  const alt = spread.map(p => ({lon: +(p.lon + 0.002).toFixed(6), lat: p.lat}));
  const frozen = api.ypCommitAreaStock(secondCommit.store, bargara, alt, {...secondCommit.hold, tilesLoaded:true});
  assert.equal(frozen.changed, false);
  assert.equal(frozen.store.rentals.length, 10);
  assert.equal(JSON.stringify(frozen.store.rentals.map(r => [r.lon, r.lat])), JSON.stringify(secondCommit.store.rentals.map(r => [r.lon, r.lat])));
  assert.equal(coastal.rentals.every(r => r.placement === 'mapped-building'), true);
  const none = api.ypEnsureSuburbStock(api.ypFreshStock(), place);
  assert.equal(none.rentals.length, 0);
  const buildingsFor = (origin, count) => Array.from({length: count}, (_, i) => api.ypDestination(origin.lon, origin.lat, i * 36, 300 + i * 40));
  const first = api.ypEnsureSuburbStock(api.ypFreshStock(), place, buildingsFor(place, 12));
  assert.equal(first.rentals.length, 10);
  assert.equal(first.rentals[0].bond, first.rentals[0].weeklyRent * 6);
  assert.equal(first.rentals.every(r => r.radiusM === 2000 && !r.postcode && r.placement === 'mapped-building'), true);
  assert.equal(first.rentals.every(r => api.ypDistanceM(place.lon, place.lat, r.lon, r.lat) <= 2000), true);
  first.rentals[0].status = 'application-pending';
  const again = api.ypEnsureSuburbStock(first, place, buildingsFor(place, 12));
  assert.equal(again.rentals.length, 10);
  assert.equal(again.rentals.find(r => r.id === first.rentals[0].id).status, 'application-pending');
  assert.equal(JSON.stringify(again.rentals.map(r => r.id)), JSON.stringify(first.rentals.map(r => r.id)));
  assert.equal(JSON.stringify(again.rentals.map(r => r.lon)), JSON.stringify(first.rentals.map(r => r.lon)));
  const nearPoint = api.ypDestination(place.lon, place.lat, 0, 80);
  const nearPlace = {label:'Near A', lon:nearPoint.lon, lat:nearPoint.lat};
  const near = api.ypEnsureSuburbStock(again, nearPlace, buildingsFor(nearPlace, 10));
  const also = api.ypDestination(place.lon, place.lat, 180, 80);
  const southPlace = {label:'Near B', lon:also.lon, lat:also.lat};
  const three = api.ypEnsureSuburbStock(near, southPlace, buildingsFor(southPlace, 10));
  const farPoint = api.ypDestination(place.lon, place.lat, 90, 15000);
  const farPlace = {label:'Far Town', lon:farPoint.lon, lat:farPoint.lat};
  const stock = api.ypEnsureSuburbStock(three, farPlace, buildingsFor(farPlace, 10));
  assert.equal(stock.rentals.length, 40);
  const listed = api.ypRadiusList(stock, place);
  assert.equal(listed.status, 'ready');
  assert.equal(listed.items.length, 10);
  assert.equal(listed.items.every(r => r.placeLabel === 'Avenell Heights' && api.ypDistanceM(place.lon, place.lat, r.lon, r.lat) <= 2000), true);
  assert.equal(listed.items.some(r => r.placeLabel === 'Far Town' || r.placeLabel === 'Near A'), false);
  const nearListed = api.ypRadiusList(stock, nearPlace);
  assert.equal(nearListed.items.length, 10);
  assert.equal(nearListed.items.every(r => r.placeLabel === 'Near A'), true);
  const long = Array.from({length: 25}, (_, i) => ({n: i}));
  assert.equal(api.ypPage(long, 1, 20).items.length, 20);
  assert.equal(api.ypPage(long, 2, 20).items.length, 5);
  const missing = api.ypRadiusList(stock, null);
  assert.equal(missing.status, 'none');
  assert.equal(missing.items.length, 0);
  const sample = listed.items.find(r => r.status === 'available');
  const detail = api.ypRentalDetail(sample);
  assert.equal(detail.id, sample.id);
  assert.ok(detail.availability.includes('Not a real vacancy'));
  assert.ok(detail.pin.includes('2 km'));
  assert.equal(/device/i.test(detail.pin), false);
  assert.equal(detail.tag, undefined);
  assert.equal(detail.weeklyRent, sample.weeklyRent);
  assert.equal(detail.listing.kicker, 'Game sample property');
  assert.equal(detail.listing.title.startsWith('Sample rental'), true);
  assert.equal(detail.listing.action.label, 'Apply to rent');
  assert.equal(detail.listing.money.map(item => item.label).join('|'), 'Weekly rent|Bond');
  assert.equal(detail.listing.fixture, false);
  assert.equal(/bedroom|bathroom|photo|hero|house|home/i.test(JSON.stringify(detail.listing)), false);
  assert.equal(/2 km/.test(detail.listing.limitation), false);
  const sale = api.ypListingModel({kind:'sale', n:1, place:'Fixture Bay', price:505000, fixture:true});
  const auction = api.ypListingModel({kind:'auction', n:2, bid:12000, fixture:true});
  const share = api.ypListingModel({kind:'roomshare', n:3, share:180, fixture:true});
  assert.equal(sale.title, 'Sample for sale 1');
  assert.equal(sale.action, null);
  assert.equal(sale.money[0].amount, '$505,000');
  assert.ok(sale.fixtureNote.includes('Not a live record'));
  assert.equal(auction.action, null);
  assert.equal(auction.money[0].label, 'Current bid');
  assert.equal(share.action, null);
  assert.equal(share.money[0].label, 'Weekly room share');
  assert.equal(api.ypListingModel({kind:'sale', fixture:true}).money.length, 0);
  const picture = api.ypRentPicture(500, {incomeWk: 1157.9, expenseWk: 0, bank: 30000});
  assert.equal(picture.bond, 3000);
  assert.equal(picture.income, 1158);
  assert.equal(picture.expenses, 0);
  assert.equal(picture.left, 658);
  assert.equal(picture.afterBond, 27000);
  const short = api.ypRentPicture(500, {incomeWk: 400, expenseWk: 200, bank: 1000});
  assert.equal(short.left, -300);
  assert.equal(short.afterBond, -2000);
  assert.equal(api.ypMoneyText(short.left), '-$300');
  assert.equal(api.ypRentPicture(500, {}).left, null);
  assert.equal(api.ypListingModel({kind:'sale', price: 10, fixture:true}).flow.length, 0);
  assert.equal(api.YP_TEST_APPROVAL_MS, 30000);
  const sampleRent = {id:'s1', weeklyRent:500, bond:3000, status:'available', owner:'game'};
  const owned = {id:'p1', weeklyRent:400, bond:2400, status:'available', owner:'player'};
  const other = {id:'s2', weeklyRent:420, bond:2520, status:'available'};
  const t0 = 1_000_000;
  const sampleApplied = api.ypApplySample({version:1, rentals:[sampleRent, other]}, 's1', t0);
  assert.equal(sampleApplied.ok, true);
  assert.equal(sampleApplied.store.rentals[0].status, 'application-pending');
  assert.equal(sampleApplied.store.rentals[0].approveAt, t0 + 30000);
  const repeatApply = api.ypApplySample(sampleApplied.store, 's1', t0 + 1);
  assert.equal(repeatApply.ok, false);
  assert.equal(repeatApply.reason, 'already');
  const blocked = api.ypApplySample(sampleApplied.store, 's2', t0 + 1);
  assert.equal(blocked.reason, 'other');
  const still = api.ypRefreshSample(sampleApplied.store, t0 + 29999);
  assert.equal(still.store.rentals[0].status, 'application-pending');
  const approved = api.ypRefreshSample(sampleApplied.store, t0 + 30000);
  assert.equal(approved.store.rentals[0].status, 'approved');
  const player = {incomeWk:1158, expenseWk:0, bank:30000};
  const paid = api.ypConfirmSample(approved.store, 's1', t0 + 30000, player, 30000, 4);
  assert.equal(paid.ok, true);
  assert.equal(paid.charged, 3000);
  assert.equal(paid.cash, 27000);
  assert.equal(paid.firstRentWeek, 5);
  const twice = api.ypConfirmSample(paid.store, 's1', t0 + 31000, player, paid.cash, 4);
  assert.equal(twice.charged, 0);
  assert.equal(twice.cash, 27000);
  const week = api.ypChargeSampleWeek(paid.store, 4);
  assert.equal(week.charged, 0);
  const nextWeek = api.ypChargeSampleWeek(paid.store, 5);
  assert.equal(nextWeek.charged, 500);
  const sameWeek = api.ypChargeSampleWeek(nextWeek.store, 5);
  assert.equal(sameWeek.charged, 0);
  const poor = api.ypConfirmSample(approved.store, 's1', t0 + 30000, player, 100, 4);
  assert.equal(poor.ok, false);
  assert.equal(poor.cash, 100);
  assert.ok(poor.short.includes('bond'));
  const tight = api.ypConfirmSample(approved.store, 's1', t0 + 30000, {incomeWk:400, expenseWk:200, bank:30000}, 30000, 4);
  assert.equal(tight.ok, false);
  assert.equal(tight.cash, 30000);
  assert.ok(tight.short.includes('left'));
  const cancelled = api.ypCancelSample(sampleApplied.store, 's1');
  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.store.rentals[0].status, 'available');
  const late = api.ypRefreshSample(approved.store, approved.store.rentals[0].expiresAt);
  assert.equal(late.store.rentals[0].status, 'expired');
  const expiredPay = api.ypConfirmSample(approved.store, 's1', approved.store.rentals[0].expiresAt, player, 30000, 4);
  assert.equal(expiredPay.ok, false);
  assert.equal(expiredPay.cash, 30000);
  const ownerApply = api.ypApplySample({version:1, rentals:[owned]}, 'p1', t0);
  const ownerLater = api.ypRefreshSample(ownerApply.store, t0 + 120000);
  assert.equal(ownerLater.store.rentals[0].status, 'application-pending');
  assert.equal(ownerLater.store.rentals[0].owner, 'player');
  const applied = api.ypApplyPreview(stock, sample.id);
  assert.equal(applied.rentals.find(r => r.id === sample.id).status, 'application-pending');
  assert.equal(stock.rentals.find(r => r.id === sample.id).status, 'available');
  assert.equal(JSON.stringify(applied).includes('G.cash'), false);
  assert.ok((code.match(/ypOpenRentalDetail/g) || []).length >= 2);
  assert.ok(code.includes("b.textContent='Search Area'"));
  assert.equal(code.includes('Show available rentals'), false);
  assert.equal(code.includes('yp-provider-note'), false);
  assert.equal(code.includes('yp-radius-note'), false);
  const shipped = fs.readFileSync(path.join(root, '3d-5d6ea64333a6', 'index.html'), 'utf8');
  for (const banned of ['getCurrentPosition', 'watchPosition', 'navigator.geolocation', 'clearWatch', 'locationfound', 'locationerror']) assert.equal(shipped.includes(banned), false, banned);
  assert.equal(shipped.includes('const TEST_ALWAYS_FRESH=false'), true);
  assert.equal(shipped.includes('TEST_ALWAYS_FRESH=true'), false);
  assert.equal(shipped.includes("q.get('fresh')!=='1'"), true);
  assert.equal(shipped.includes("var PREFIX='ypfresh.'"), true);
  assert.ok(code.includes('#yp-where-suggestions button{') && code.includes('cursor:pointer') && code.includes('#yp-where-suggestions button:hover') && code.includes('button:focus-visible') && code.includes('button:active'));
  assert.equal(shipped.includes("k.startsWith('fe.')||k.startsWith('mt.')"), false);
  assert.ok(code.includes("n.textContent='Listings'"));
  assert.ok(code.includes("textContent='For Sale'"));
  assert.ok(code.includes("textContent='For Rent'"));
  assert.ok(code.includes("textContent='Room Share'"));
  assert.ok(code.includes("textContent='Auctions'"));
  assert.ok(code.includes('ypOpenListingsChoice'));
  assert.equal((code.match(/<button[^>]*data-v="sale"/g) || []).length, 0);
  assert.equal(code.includes('Search this area'), false);
  assert.ok(code.includes('style.load'));
  assert.ok(code.includes("ypMap.on('moveend',()=>{if(ypReady)ypSyncRentalMarkers();}"));
  assert.equal(code.includes('No 4-digit Australian postcode came with the place you chose'), false);
  assert.equal(code.includes('No postcode was guessed'), false);
  assert.equal(code.split("ypMap.on('moveend'")[1].slice(0, 90).includes('__ypListCentre'), false);
  assert.ok(code.includes('yp-search-radius'));
});

check('alternate port rules stay localhost-only', () => {
  const out = execFileSync('python3', ['-c', `
import importlib.util
spec = importlib.util.spec_from_file_location('srv', ${JSON.stringify(path.join(root, 'preview', 'localhost-server.py'))})
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
assert mod.preview_port([]) == 8765
hosts, origins = mod.loopback_rules(8766)
assert hosts == {'localhost:8766', '127.0.0.1:8766'}
assert origins == {'http://localhost:8766', 'http://127.0.0.1:8766'}
assert '*' not in origins and not any(item.endswith(':*') for item in origins)
`], {encoding: 'utf8'});
  assert.equal(out, '');
});

async function serverChecks() {
  const port = 8766;
  const child = spawn('python3', [path.join(root, 'preview', 'localhost-server.py'), '--port', String(port)], {stdio: 'ignore'});
  const host = `127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let i = 0; i < 40 && !ready; i++) {
      try { await once(port, '/runtime-config', {Host: host}); ready = true; } catch { await new Promise(r => setTimeout(r, 50)); }
    }
    assert.equal(ready, true);
    const config = await once(port, '/runtime-config', {Host: host, Origin: `http://127.0.0.1:${port}`});
    assert.equal(config.status, 200);
    assert.notEqual(config.acao, '*');
    const parsed = JSON.parse(config.body);
    assert.equal(typeof parsed.key, 'string');
    assert.equal(typeof parsed.geoapifyKey, 'string');
    assert.equal(config.body.includes('apiKey'), false);
    const named = await once(port, '/runtime-config', {Host: `localhost:${port}`, Origin: `http://localhost:${port}`});
    assert.equal(named.status, 200);
    assert.notEqual(named.acao, '*');
    const page = await once(port, '/', {Host: host});
    assert.equal(page.status, 200);
    assert.ok(page.body.includes('map-preview.js'));
    assert.ok(page.body.includes('Choose your Rental'));
    const script = await once(port, '/map-preview.js', {Host: host});
    assert.equal(script.status, 200);
    assert.ok(script.body.includes('END TESTABLE SELECTION'));
    const missing = await once(port, '/test/index.html', {Host: host});
    assert.equal(missing.status, 404);
    const rootPage = await once(port, '/index.html', {Host: host});
    assert.ok(rootPage.body.includes('3d-5d6ea64333a6') === false);
    assert.ok(rootPage.body.includes('map-preview.js'));
    const foreign = await once(port, '/runtime-config', {Host: host, Origin: 'http://example.com'});
    assert.equal(foreign.status, 403);
    const otherPort = await once(port, '/runtime-config', {Host: host, Origin: 'http://127.0.0.1:8765'});
    assert.equal(otherPort.status, 403);
    const wildcard = await once(port, '/runtime-config', {Host: host, Origin: '*'});
    assert.equal(wildcard.status, 403);
    const wrongHost = await once(port, '/runtime-config', {Host: 'example.com', Origin: `http://127.0.0.1:${port}`});
    assert.equal(wrongHost.status, 403);
    const pilotHost = await once(port, '/runtime-config', {Host: '127.0.0.1:8765'});
    assert.equal(pilotHost.status, 403);
    const cross = await once(port, '/runtime-config', {Host: host, 'Sec-Fetch-Site': 'cross-site'});
    assert.equal(cross.status, 403);
    console.log('PASS chosen localhost port accepts runtime config and foreign origins stay forbidden');
    passed++;
  } finally {
    child.kill('SIGTERM');
  }
}

(async () => {
  await check('missing search key does not build a request', async () => {
    let calls = 0;
    await assert.rejects(streetApi.search(async () => { calls++; }, '', 'Barolin Street', 'Bundaberg', 'Australia'));
    assert.equal(calls, 0);
  });
  await serverChecks();
  console.log(passed + ' checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
