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
check('save-up body is one centred paragraph and income bands are unchanged', () => {
  assert.ok(html.includes(marker));
  const sentence = 'Looks like you may have to start saving towards your first home deposit. Room share or boarding is usually the best way to save if other players have something available. You can live with family or friends for free also.';
  assert.ok(html.includes('<h3>Save up first?</h3><p>' + sentence + '</p>'));
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
  assert.ok(flow.includes("Good to see you, <b>'+escH(who)+'</b>. Your properties are right where you left them."));
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
  assert.ok(code.includes("moveNote.textContent='You can also move and search on the map.'"));
  const api = vm.runInNewContext(src + '\n;({ypShouldHideLabel,ypEnsureSuburbStock,ypFreshStock,ypRadiusList,ypPage,ypInView,ypRentalDetail,ypApplyPreview,ypSuburbKey,ypDistanceM,ypDestination})', {});
  assert.equal(api.ypShouldHideLabel({id:'road_label', type:'symbol', 'source-layer':'transportation_name'}), true);
  assert.equal(api.ypShouldHideLabel({id:'road', type:'line', 'source-layer':'transportation'}), false);
  assert.equal(api.ypShouldHideLabel({id:'building', type:'fill', 'source-layer':'building'}), false);
  assert.equal(api.ypShouldHideLabel({id:'housenumber', type:'symbol', 'source-layer':'housenumber'}), true);
  const place = {label:'Avenell Heights', lon:152.35, lat:-24.88};
  const first = api.ypEnsureSuburbStock(api.ypFreshStock(), place);
  assert.equal(first.rentals.length, 10);
  assert.equal(first.rentals.every(r => r.radiusM === 2000 && !r.postcode), true);
  assert.equal(first.rentals.every(r => api.ypDistanceM(place.lon, place.lat, r.lon, r.lat) <= 2000), true);
  assert.equal(first.rentals.every(r => api.ypDistanceM(place.lon, place.lat, r.lon, r.lat) > 100), true);
  first.rentals[0].status = 'application-pending';
  const again = api.ypEnsureSuburbStock(first, place);
  assert.equal(again.rentals.length, 10);
  assert.equal(again.rentals.find(r => r.id === first.rentals[0].id).status, 'application-pending');
  assert.equal(JSON.stringify(again.rentals.map(r => r.id)), JSON.stringify(first.rentals.map(r => r.id)));
  assert.equal(JSON.stringify(again.rentals.map(r => r.lon)), JSON.stringify(first.rentals.map(r => r.lon)));
  const nearPoint = api.ypDestination(place.lon, place.lat, 0, 80);
  const near = api.ypEnsureSuburbStock(again, {label:'Near A', lon:nearPoint.lon, lat:nearPoint.lat});
  const also = api.ypDestination(place.lon, place.lat, 180, 80);
  const three = api.ypEnsureSuburbStock(near, {label:'Near B', lon:also.lon, lat:also.lat});
  const farPoint = api.ypDestination(place.lon, place.lat, 90, 15000);
  const stock = api.ypEnsureSuburbStock(three, {label:'Far Town', lon:farPoint.lon, lat:farPoint.lat});
  assert.equal(stock.rentals.length, 40);
  const listed = api.ypRadiusList(stock, place);
  assert.equal(listed.status, 'ready');
  assert.equal(listed.items.length, 30);
  assert.equal(listed.items.every(r => api.ypDistanceM(place.lon, place.lat, r.lon, r.lat) <= 2000), true);
  assert.equal(listed.items.some(r => r.placeLabel === 'Far Town'), false);
  const page = api.ypPage(listed.items, 1, 20);
  assert.equal(page.items.length, 20);
  assert.equal(api.ypPage(listed.items, 2, 20).items.length, 10);
  const missing = api.ypRadiusList(stock, null);
  assert.equal(missing.status, 'none');
  assert.equal(missing.items.length, 0);
  const sample = listed.items.find(r => r.status === 'available');
  const detail = api.ypRentalDetail(sample);
  assert.equal(detail.id, sample.id);
  assert.ok(detail.availability.includes('Not a real vacancy'));
  assert.ok(detail.pin.includes('2 km'));
  assert.ok(detail.pin.includes('Not this device') || detail.pin.includes('not this device'));
  assert.equal(detail.tag, undefined);
  assert.equal(detail.weeklyRent, sample.weeklyRent);
  const applied = api.ypApplyPreview(stock, sample.id);
  assert.equal(applied.rentals.find(r => r.id === sample.id).status, 'application-pending');
  assert.equal(stock.rentals.find(r => r.id === sample.id).status, 'available');
  assert.equal(JSON.stringify(applied).includes('G.cash'), false);
  assert.ok((code.match(/ypOpenRentalDetail/g) || []).length >= 2);
  assert.ok(code.includes('Show available rentals'));
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
