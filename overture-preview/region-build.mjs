import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {createInterface} from 'node:readline';
import {createReadStream} from 'node:fs';
import {reconcileIncoming} from './registry.mjs';
import {applyAdjustment, classifyBuilding, footprintAreaM2, residentialGameValue} from './pricing.mjs';

const root = dirname(new URL(import.meta.url).pathname);
const registryPath = resolve(root, 'data/registry-v1.json');
const pricingPath = resolve(root, 'data/pricing-v1.json');
const sourcePath = process.argv[2];
const boundaryPath = process.argv[3];
if (!sourcePath || !boundaryPath) throw new Error('Usage: region-build.mjs buildings.geojsonseq boundary.geojson');

const started = Date.now();
const previous = JSON.parse(readFileSync(registryPath, 'utf8'));
const pricing = JSON.parse(readFileSync(pricingPath, 'utf8'));
const preservedRecordHash = createHash('sha256').update(previous.records.map(record => JSON.stringify(record)).join('\n')).digest('hex');
const preservedQuarantineHash = createHash('sha256').update(previous.quarantine.map(item => JSON.stringify(item)).join('\n')).digest('hex');
const preservedPriceHash = createHash('sha256').update(pricing.rows.map(row => JSON.stringify(row)).join('\n')).digest('hex');
const oldIds = new Set(previous.records.map(record => record.gameId));

const features = [];
const lines = createInterface({input: createReadStream(sourcePath)});
for await (const line of lines) {
  if (!line) continue;
  const row = JSON.parse(line);
  features.push({type: 'Feature', properties: {id: row.id, class: row.class, subtype: row.subtype, sources: row.sources}, geometry: row.geometry});
}
console.log(JSON.stringify({loaded: features.length, loadSeconds: (Date.now() - started) / 1000}));

const reconcileStarted = Date.now();
const reconciled = reconcileIncoming(previous, features);
console.log(JSON.stringify({...reconciled.stats, reconcileSeconds: (Date.now() - reconcileStarted) / 1000}));

const recordHash = createHash('sha256').update(reconciled.records.filter(record => oldIds.has(record.gameId)).map(record => JSON.stringify(record)).sort().join('\n')).digest('hex');
const oldRecordHash = createHash('sha256').update(previous.records.map(record => JSON.stringify(record)).sort().join('\n')).digest('hex');
if (recordHash !== oldRecordHash) throw new Error('Existing registry records changed');
const oldQuarantine = new Set(previous.quarantine.map(item => JSON.stringify(item)));
if (!reconciled.quarantine.slice(0, previous.quarantine.length).every((item, index) => JSON.stringify(item) === JSON.stringify(previous.quarantine[index]))) {
  throw new Error('Existing quarantine records changed');
}
if (preservedRecordHash !== createHash('sha256').update(previous.records.map(record => JSON.stringify(record)).join('\n')).digest('hex')) {
  throw new Error('Original record hash drifted');
}

const priceStarted = Date.now();
const rows = pricing.rows.slice();
for (const record of reconciled.records) {
  if (oldIds.has(record.gameId)) continue;
  const kind = classifyBuilding(record.className, record.subtype);
  if (kind.group === 'ineligible') {
    rows.push({gameId: record.gameId, tone: 'none', eligible: false, estimate: null, upliftBps: 0});
    continue;
  }
  const base = residentialGameValue({gameId: record.gameId, areaM2: footprintAreaM2(record.geometry), dwelling: kind.dwelling});
  const priced = applyAdjustment(base, kind.group, record.gameId);
  rows.push({gameId: record.gameId, tone: kind.tone, eligible: true, estimate: priced.estimate, upliftBps: priced.upliftBps});
}
const priceHash = createHash('sha256').update(rows.slice(0, pricing.rows.length).map(row => JSON.stringify(row)).join('\n')).digest('hex');
if (priceHash !== preservedPriceHash) throw new Error('Existing prices changed');
console.log(JSON.stringify({priced: rows.length - pricing.rows.length, priceSeconds: (Date.now() - priceStarted) / 1000}));

const publicRecords = reconciled.records.map(record => ({
  gameId: record.gameId,
  geometryHash: record.geometryHash,
  gersIds: record.gersIds,
  geometry: record.geometry,
  sources: record.sources,
  status: record.status
}));
const publicQuarantine = reconciled.quarantine.map(item => ({
  reason: item.reason,
  gersId: item.gersId || '',
  relatedGameIds: item.relatedGameIds || [],
  saleable: false,
  geometry: item.geometry || null
}));
if (publicQuarantine.slice(0, previous.quarantine.length).some((item, index) => JSON.stringify(item) !== JSON.stringify(previous.quarantine[index]))) {
  throw new Error('Quarantine projection changed existing rows');
}
const boundary = JSON.parse(readFileSync(boundaryPath, 'utf8'));
const nextRegistry = {
  version: 1,
  frozen: true,
  snapshot: {
    ...previous.snapshot,
    release: '2026-10-21.0',
    coverage: 'Bundaberg Regional Council, excluding the Coral Sea portion omitted by the council boundary',
    preservedRecordHash,
    preservedQuarantineHash,
    preservedPriceHash,
    matchedExisting: reconciled.stats.matchedExisting,
    adopted: publicRecords.length,
    quarantined: publicQuarantine.length
  },
  records: publicRecords,
  quarantine: publicQuarantine,
  ownership: {version: 1, claims: {}}
};
writeFileSync(registryPath, JSON.stringify(nextRegistry));
writeFileSync(pricingPath, JSON.stringify({...pricing, rows}));

const byPrice = new Map(rows.map(row => [row.gameId, row]));
const cell = 0.05;
const chunks = new Map();
const place = (feature, lon, lat) => {
  const id = `${Math.floor(lon / cell)}_${Math.floor(lat / cell)}`;
  let bucket = chunks.get(id);
  if (!bucket) chunks.set(id, bucket = []);
  bucket.push(feature);
};
const centroid = geometry => {
  const ring = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0][0];
  const n = Math.max(1, ring.length - 1);
  let lon = 0, lat = 0;
  for (let i = 0; i < n; i++) { lon += ring[i][0]; lat += ring[i][1]; }
  return [lon / n, lat / n];
};
for (const record of publicRecords) {
  const row = byPrice.get(record.gameId);
  const [lon, lat] = centroid(record.geometry);
  place({
    type: 'Feature',
    properties: {gameId: record.gameId, gersId: record.gersIds[0] || '', adopted: true, tone: row?.tone || 'none', eligible: row?.eligible === true, estimate: row?.eligible ? row.estimate : null},
    geometry: record.geometry
  }, lon, lat);
}
for (const item of publicQuarantine) {
  if (!item.geometry) continue;
  const [lon, lat] = centroid(item.geometry);
  place({
    type: 'Feature',
    properties: {gameId: '', gersId: item.gersId || '', adopted: false, reason: item.reason, tone: 'none', eligible: false, estimate: null},
    geometry: item.geometry
  }, lon, lat);
}
const chunkDir = resolve(root, 'data/chunks');
rmSync(chunkDir, {recursive: true, force: true});
mkdirSync(chunkDir, {recursive: true});
const manifest = [];
for (const [id, chunkFeatures] of chunks) {
  const [x, y] = id.split('_').map(Number);
  writeFileSync(resolve(chunkDir, `${id}.json`), JSON.stringify({type: 'FeatureCollection', features: chunkFeatures}));
  manifest.push({id, bbox: [x * cell, y * cell, (x + 1) * cell, (y + 1) * cell], features: chunkFeatures.length});
}
manifest.sort((a, b) => a.id < b.id ? -1 : 1);
writeFileSync(resolve(root, 'data/chunk-manifest.json'), JSON.stringify({cell, chunks: manifest}));
writeFileSync(resolve(root, 'data/boundary.geojson'), JSON.stringify(boundary));
console.log(JSON.stringify({
  chunks: manifest.length,
  features: manifest.reduce((sum, item) => sum + item.features, 0),
  totalSeconds: (Date.now() - started) / 1000,
  preservedRecordHash,
  preservedQuarantineHash,
  preservedPriceHash,
  unused: oldQuarantine.size
}));
