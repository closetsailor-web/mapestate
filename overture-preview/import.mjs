import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {importSnapshot, overlayFromRegistry} from './registry.mjs';

const root = dirname(new URL(import.meta.url).pathname);
const sourcePath = resolve(root, 'source/bundaberg-buildings.geojson');
const registryPath = resolve(root, 'data/registry-v1.json');
const overlayPath = resolve(root, 'data/overlay-v1.geojson');

const raw = JSON.parse(readFileSync(sourcePath, 'utf8'));
const meta = {
  name: 'central-bundaberg-buildings',
  release: '2026-10-21.0',
  requestedBbox: [152.343, -24.871, 152.353, -24.862],
  label: 'One Overture buildings extract. Not complete coverage of Bundaberg.'
};
const registry = importSnapshot(raw.features, null, {...meta, sourceFeatures: raw.features.length});
const slim = {
  version: registry.version,
  frozen: true,
  snapshot: registry.snapshot,
  records: registry.records.map(record => ({
    gameId: record.gameId,
    geometryHash: record.geometryHash,
    gersIds: record.gersIds,
    geometry: record.geometry,
    sources: record.sources,
    status: record.status
  })),
  quarantine: registry.quarantine.map(item => ({
    reason: item.reason,
    gersId: item.gersId || '',
    relatedGameIds: item.relatedGameIds || [],
    saleable: false,
    geometry: item.geometry || null
  })),
  ownership: {version: 1, claims: {}}
};
mkdirSync(resolve(root, 'data'), {recursive: true});
writeFileSync(registryPath, JSON.stringify(slim));
writeFileSync(overlayPath, JSON.stringify(overlayFromRegistry(slim)));
console.log(JSON.stringify({
  source: raw.features.length,
  adopted: slim.records.length,
  quarantined: slim.quarantine.length,
  reasons: slim.quarantine.reduce((acc, item) => { acc[item.reason] = (acc[item.reason] || 0) + 1; return acc; }, {})
}));
