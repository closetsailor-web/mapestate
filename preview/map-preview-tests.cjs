const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const http = require('node:http');
const {spawn} = require('node:child_process');

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
check('game page prefix matches the approved build', () => {
  assert.ok(html.includes(marker));
  const restored = html.replace(marker, '');
  const sha = crypto.createHash('sha256').update(restored).digest('hex');
  assert.equal(sha, '70190a95747aafb97147775a8c5dde25c3e9ceca991f9f81e66f50e2f718f802');
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
      res.on('end', () => resolve({status: res.statusCode, body: Buffer.concat(chunks).toString('utf8'), type: res.headers['content-type'] || ''}));
    });
    req.on('error', reject);
    req.end();
  });
}

async function serverChecks() {
  const child = spawn('python3', [path.join(root, 'preview', 'localhost-server.py')], {stdio: 'ignore'});
  try {
    let ready = false;
    for (let i = 0; i < 40 && !ready; i++) {
      try { await once(8765, '/runtime-config'); ready = true; } catch { await new Promise(r => setTimeout(r, 50)); }
    }
    assert.equal(ready, true);
    const config = await once(8765, '/runtime-config');
    assert.equal(config.status, 200);
    const parsed = JSON.parse(config.body);
    assert.equal(typeof parsed.key, 'string');
    assert.equal(typeof parsed.geoapifyKey, 'string');
    assert.equal(config.body.includes('apiKey'), false);
    const page = await once(8765, '/');
    assert.equal(page.status, 200);
    assert.ok(page.body.includes('map-preview.js'));
    assert.ok(page.body.includes('Choose your Rental'));
    const script = await once(8765, '/map-preview.js');
    assert.equal(script.status, 200);
    assert.ok(script.body.includes('END TESTABLE SELECTION'));
    const missing = await once(8765, '/test/index.html');
    assert.equal(missing.status, 404);
    const rootPage = await once(8765, '/index.html');
    assert.ok(rootPage.body.includes('3d-5d6ea64333a6') === false);
    assert.ok(rootPage.body.includes('map-preview.js'));
    const foreign = await once(8765, '/runtime-config', {Host: 'example.com', Origin: 'http://example.com'});
    assert.equal(foreign.status, 403);
    const cross = await once(8765, '/runtime-config', {'Sec-Fetch-Site': 'cross-site'});
    assert.equal(cross.status, 403);
    console.log('PASS localhost server injects config without printing secrets and refuses other origins');
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
