import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import assert from 'node:assert/strict';
import {gameIdForGeometry} from './registry.mjs';
import {
  ADJUSTMENTS,
  applyAdjustment,
  buildPricing,
  classifyBuilding,
  commercialUpliftBps,
  gameHash,
  marketIndex,
  residentialGameValue
} from './pricing.mjs';

const root = dirname(new URL(import.meta.url).pathname);
const registry = JSON.parse(readFileSync(resolve(root, 'data/registry-v1.json'), 'utf8'));
const source = JSON.parse(readFileSync(resolve(root, 'source/bundaberg-buildings.geojson'), 'utf8'));
const stored = JSON.parse(readFileSync(resolve(root, 'data/pricing-v1.json'), 'utf8'));
const registrySha = createHash('sha256').update(readFileSync(resolve(root, 'data/registry-v1.json'))).digest('hex');

function referenceHouse(gameId, areaM2) {
  const phase = gameHash('phc10');
  const market = Math.exp(0.015 * Math.sin(phase * 20));
  const size = Math.min(1.6, Math.max(0.7, (areaM2 / 220) ** 0.3));
  const spread = 0.9 + gameHash(gameId) * 0.2;
  return Math.round(703000 * 0.78 * size * spread * market / 1000) * 1000;
}

function referenceUnit(gameId) {
  const phase = gameHash('phc10');
  const market = Math.exp(0.015 * Math.sin(phase * 20));
  const spread = 0.9 + gameHash(gameId) * 0.2;
  return Math.round(495000 * 0.78 * 1.1 * spread * market / 1000) * 1000;
}

assert.equal(registrySha, '13e1eaa98bf3943aa21955bebcea233408617e7170ab230df6e036d2560b778e');
assert.equal(registry.records.length, 1058);
assert.equal(registry.quarantine.length, 35);
assert.equal(marketIndex('c10', 0), Math.exp(0.015 * Math.sin(gameHash('phc10') * 20)));

const houseId = 'ypb-parity-house';
assert.equal(residentialGameValue({gameId: houseId, areaM2: 160, dwelling: 'house'}), referenceHouse(houseId, 160));
assert.notEqual(residentialGameValue({gameId: houseId, areaM2: 160, dwelling: 'house'}), residentialGameValue({gameId: houseId, areaM2: 80, dwelling: 'house'}));
assert.equal(residentialGameValue({gameId: houseId, areaM2: 90, dwelling: 'unit'}), referenceUnit(houseId));
assert.equal(residentialGameValue({gameId: houseId, areaM2: 400, dwelling: 'unit'}), referenceUnit(houseId));
assert.equal(residentialGameValue({gameId: houseId, areaM2: 160, dwelling: 'house'}) % 1000, 0);

assert.equal(classifyBuilding(null, null).group, 'ineligible');
assert.equal(classifyBuilding('roof', 'outbuilding').group, 'ineligible');
assert.equal(classifyBuilding('shed', 'outbuilding').group, 'ineligible');
assert.equal(classifyBuilding('garage', 'residential').group, 'ineligible');
assert.equal(classifyBuilding('detached', 'residential').dwelling, 'house');
assert.equal(classifyBuilding('apartments', 'residential').dwelling, 'unit');
assert.equal(classifyBuilding('retail', 'commercial').group, 'commercial');
assert.equal(classifyBuilding(null, 'commercial').group, 'commercial');
assert.equal(classifyBuilding('school', 'education').group, 'other');
assert.equal(ADJUSTMENTS.other, 0);
assert.equal(ADJUSTMENTS.otherStatus, 'pending-review');

const pricing = buildPricing(registry, source.features);
assert.deepEqual(pricing, stored);
assert.equal(pricing.rows.length, 1058);
assert.equal(new Set(pricing.rows.map(row => row.gameId)).size, 1058);
const known = new Set(registry.records.map(record => record.gameId));
assert.equal(pricing.rows.every(row => known.has(row.gameId)), true);
assert.equal(pricing.rows.some(row => /residential|commercial|outbuilding|roof|shed/.test(JSON.stringify(row))), false);
assert.equal(JSON.stringify(pricing).includes('"names"'), false);

const homes = pricing.rows.filter(row => row.tone === 'home');
const trades = pricing.rows.filter(row => row.tone === 'trade');
const others = pricing.rows.filter(row => row.tone === 'other');
const none = pricing.rows.filter(row => row.tone === 'none');
assert.ok(homes.length > 0 && trades.length > 0 && others.length > 0 && none.length > 0);
assert.equal(none.every(row => row.eligible === false && row.estimate === null), true);
assert.equal(homes.every(row => row.eligible && row.upliftBps === 0 && row.estimate % 1000 === 0), true);
assert.equal(others.every(row => row.eligible && row.upliftBps === 0 && row.estimate % 1000 === 0), true);
for (const row of trades) {
  assert.equal(row.eligible, true);
  assert.ok(row.upliftBps >= 3000 && row.upliftBps <= 4000);
  assert.equal(Number.isInteger(row.estimate), true);
  assert.equal(commercialUpliftBps(row.gameId), row.upliftBps);
  assert.equal(commercialUpliftBps(row.gameId), commercialUpliftBps(row.gameId));
}

const sample = trades[0];
const sampleRecord = registry.records.find(record => record.gameId === sample.gameId);
const sampleFeature = source.features.find(feature => feature.properties.id === sampleRecord.gersIds[0]);
const renamed = source.features.map(feature => feature === sampleFeature
  ? {...feature, properties: {...feature.properties, id: 'vendor-only-change'}}
  : feature);
const again = buildPricing(registry, renamed);
assert.equal(again.rows.find(row => row.gameId === sample.gameId).estimate, sample.estimate);
assert.equal(again.rows.find(row => row.gameId === sample.gameId).upliftBps, sample.upliftBps);
assert.equal(gameIdForGeometry(sampleRecord.geometry), sample.gameId);

const base = residentialGameValue({gameId: sample.gameId, areaM2: 180, dwelling: 'house'});
const lifted = applyAdjustment(base, 'commercial', sample.gameId);
assert.ok(lifted.estimate >= Math.round(base * 1.3) && lifted.estimate <= Math.round(base * 1.4));
assert.equal(applyAdjustment(base, 'other', sample.gameId).estimate, base);

console.log(JSON.stringify({
  homes: homes.length,
  trades: trades.length,
  others: others.length,
  none: none.length,
  sample: {gameId: sample.gameId, estimate: sample.estimate, upliftBps: sample.upliftBps}
}));
