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
      res.on('end', () => resolve({status: res.statusCode, body: Buffer.concat(chunks).toString('utf8'), type: res.headers['content-type'] || '', acao: res.headers['access-control-allow-origin']}));
    });
    req.on('error', reject);
    req.end();
  });
}

check('my location reads only after a tap and does not override a chosen search', () => {
  const src = code.split('// END TESTABLE IDENTITY')[1].split('// END TESTABLE LOCATE')[0];
  assert.equal(src.includes('watchPosition'), false);
  assert.equal(src.includes('permissions'), false);
  assert.equal(src.includes('localStorage'), false);
  assert.equal(src.includes('geoapify'), false);
  const api = vm.runInNewContext(src + '\n;({ypLocateSession,ypLocateView,ypLocateMessage,ypAccuracyRing})', {});
  let calls = 0;
  const pending = [];
  const geo = {getCurrentPosition(ok, err, opts){calls++; pending.push({ok, err, opts});}};
  const session = api.ypLocateSession(geo, true);
  assert.equal(calls, 0);
  const seen = [];
  const first = session.tap(result => seen.push(result));
  assert.equal(first.accepted, true);
  assert.equal(calls, 1);
  assert.equal(pending[0].opts.maximumAge, 0);
  assert.equal(pending[0].opts.enableHighAccuracy, true);
  assert.equal(session.tap().accepted, false);
  assert.equal(calls, 1);
  session.cancel();
  pending[0].ok({coords:{longitude:152.35, latitude:-24.86, accuracy:20}});
  assert.equal(seen.length, 0);
  session.tap(result => seen.push(result));
  assert.equal(calls, 2);
  pending[1].err({code:1});
  assert.equal(seen[0].status, 'denied');
  session.tap(result => seen.push(result));
  pending[2].err({code:2});
  assert.equal(seen[1].status, 'unavailable');
  session.tap(result => seen.push(result));
  pending[3].err({code:3});
  assert.equal(seen[2].status, 'timeout');
  session.tap(result => seen.push(result));
  pending[4].ok({coords:{longitude:152.35, latitude:-24.86, accuracy:12}});
  assert.equal(seen[3].status, 'found');
  assert.equal(seen[3].view.maxZoom, 17);
  assert.equal(seen[3].view.showCircle, true);
  const wide = api.ypLocateView(152.35, -24.86, 4000);
  assert.equal(wide.maxZoom, 17);
  assert.ok(wide.bounds[1][0] - wide.bounds[0][0] > seen[3].view.bounds[1][0] - seen[3].view.bounds[0][0]);
  const ring = api.ypAccuracyRing(152.35, -24.86, 100);
  assert.equal(ring.length, 33);
  assert.equal(ring[0][0], ring[ring.length - 1][0]);
  const found = api.ypLocateMessage('found', seen[3].view);
  assert.equal(found.includes('152.35'), false);
  assert.equal(found.includes('-24.86'), false);
  assert.ok(found.includes('not an address'));
  assert.ok(found.includes('map provider'));
  const insecure = [];
  const blocked = api.ypLocateSession({getCurrentPosition(){calls++;}}, false);
  blocked.tap(result => insecure.push(result));
  assert.equal(insecure[0].status, 'insecure');
  const missing = [];
  api.ypLocateSession(null, true).tap(result => missing.push(result));
  assert.equal(missing[0].status, 'unsupported');
  assert.ok(code.includes('min-height:44px'));
  assert.ok(code.includes('focus-visible'));
  assert.ok(code.includes('aria-live'));
  assert.equal(code.includes('watchPosition'), false);
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
