import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {claimRecord, gameIdForGeometry, importSnapshot} from './registry.mjs';

const root = dirname(new URL(import.meta.url).pathname);
const raw = JSON.parse(readFileSync(resolve(root, 'source/bundaberg-buildings.geojson'), 'utf8'));
const frozen = JSON.parse(readFileSync(resolve(root, 'data/registry-v1.json'), 'utf8'));
const meta = {release: '2026-10-21.0'};
const square = (x, y, size = 0.001) => ({
  type: 'Polygon',
  coordinates: [[[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]]]
});
const feature = (id, geometry) => ({type: 'Feature', properties: {id, sources: []}, geometry});

const again = importSnapshot(raw.features, frozen, meta);
assert.equal(again.records.length, frozen.records.length);
assert.deepEqual(again.records.map(r => r.gameId), frozen.records.map(r => r.gameId));
assert.equal(again.quarantine.length, frozen.quarantine.length);
assert.equal(frozen.records.every(r => r.gameId === gameIdForGeometry(r.geometry)), true);
assert.equal(new Set(frozen.records.map(r => r.gameId)).size, frozen.records.length);

const mutated = raw.features.map(feature => ({
  ...feature,
  properties: {...feature.properties, id: `changed-${feature.properties.id}`}
}));
const renamed = importSnapshot(mutated, frozen, meta);
assert.deepEqual(renamed.records.map(r => r.gameId), frozen.records.map(r => r.gameId));
assert.equal(renamed.records.every(r => r.gersIds.some(id => id.startsWith('changed-'))), true);

const owned = {...frozen, ownership: {version: 1, claims: {'ypb-keep': {owner: 'player-a', tenant: ''}}}};
const kept = importSnapshot(raw.features, owned, meta);
assert.deepEqual(kept.ownership, owned.ownership);

const first = importSnapshot([
  feature('gers-a', square(0, 0)),
  feature('gers-b', square(1, 0))
], null, meta);
assert.equal(first.records.length, 2);
assert.equal(first.quarantine.length, 0);
const splitLeft = {type: 'Polygon', coordinates: [[[0, 0], [0.0005, 0], [0.0005, 0.001], [0, 0.001], [0, 0]]]};
const splitRight = {type: 'Polygon', coordinates: [[[0.0005, 0], [0.001, 0], [0.001, 0.001], [0.0005, 0.001], [0.0005, 0]]]};
const split = importSnapshot([
  feature('gers-a-left', splitLeft),
  feature('gers-a-right', splitRight),
  feature('gers-b', square(1, 0))
], first, meta);
assert.equal(split.records.length, first.records.length);
assert.equal(split.records.some(r => r.gersIds.includes('gers-a-left')), false);
assert.equal(split.quarantine.some(item => item.saleable === false && item.relatedGameIds.includes(first.records.find(r => r.gersIds.includes('gers-a')).gameId)), true);

const overlap = importSnapshot([
  feature('one', square(0, 0, 0.002)),
  feature('two', square(0.001, 0.0002, 0.002))
], null, meta);
assert.equal(overlap.records.length, 0);
assert.equal(overlap.quarantine.length, 2);
assert.equal(overlap.quarantine.every(item => item.saleable === false), true);

const claimA = claimRecord({version: 1, claims: {}}, {gameId: 'ypb-1', playerId: 'player-a', role: 'owner'});
assert.equal(claimA.ok, true);
const claimB = claimRecord(claimA.ownership, {gameId: 'ypb-1', playerId: 'player-b', role: 'owner'});
assert.equal(claimB.ok, false);
assert.equal(claimB.reason, 'taken');
const tenant = claimRecord(claimA.ownership, {gameId: 'ypb-1', playerId: 'player-c', role: 'tenant'});
assert.equal(tenant.ok, true);
const tenant2 = claimRecord(tenant.ownership, {gameId: 'ypb-1', playerId: 'player-d', role: 'tenant'});
assert.equal(tenant2.ok, false);
assert.equal(claimA.ownership.claims['ypb-1'].owner, 'player-a');

console.log(JSON.stringify({
  adopted: frozen.records.length,
  quarantined: frozen.quarantine.length,
  repeatIds: again.records.length,
  vendorMutationKept: renamed.records.length
}));
