import {createHash} from 'node:crypto';

// Frozen-snapshot registry. Game ids are hashes of canonical geometry, not
// client UUIDs and not Overture GERS ids. This module does not read game saves.

export function canonicalGeometry(geometry) {
  const polygons = geometry?.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry?.type === 'MultiPolygon'
      ? geometry.coordinates
      : [];
  const canon = [];
  for (const polygon of polygons) {
    if (!polygon?.[0]) continue;
    const ring = canonicalRing(polygon[0]);
    if (ring) canon.push([ring]);
  }
  canon.sort((a, b) => JSON.stringify(a[0][0]).localeCompare(JSON.stringify(b[0][0])));
  if (!canon.length) return null;
  return canon.length === 1
    ? {type: 'Polygon', coordinates: canon[0]}
    : {type: 'MultiPolygon', coordinates: canon};
}

export function geometryHash(geometry) {
  const canon = canonicalGeometry(geometry);
  if (!canon) return '';
  return createHash('sha256').update(JSON.stringify(canon)).digest('hex');
}

export function gameIdForGeometry(geometry) {
  const hash = geometryHash(geometry);
  if (!hash) return '';
  return `ypb-${hash.slice(0, 32)}`;
}

function canonicalRing(ring) {
  let pts = ring.map(p => [round7(p[0]), round7(p[1])]).filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]));
  if (pts.length > 1 && samePoint(pts[0], pts[pts.length - 1])) pts = pts.slice(0, -1);
  if (pts.length < 3) return null;
  if (signedArea(pts) < 0) pts.reverse();
  let min = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i][0] < pts[min][0] || (pts[i][0] === pts[min][0] && pts[i][1] < pts[min][1])) min = i;
  }
  pts = pts.slice(min).concat(pts.slice(0, min));
  pts.push([pts[0][0], pts[0][1]]);
  return pts;
}

function round7(n) { return Math.round(Number(n) * 1e7) / 1e7; }
function samePoint(a, b) { return a[0] === b[0] && a[1] === b[1]; }
function signedArea(pts) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    area += p[0] * q[1] - q[0] * p[1];
  }
  return area / 2;
}

export function parseSources(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'string') return [];
  try {
    return JSON.parse(raw);
  } catch {
    const repaired = raw.replace(/\}\s+\{/g, '}, {').replace(/\bNone\b/g, 'null');
    try {
      return JSON.parse(repaired.replace(/'/g, '"'));
    } catch {
      const datasets = [];
      for (const name of ['OpenStreetMap', 'Microsoft ML Buildings']) {
        if (raw.includes(name)) datasets.push({dataset: name, license: raw.includes('ODbL-1.0') ? 'ODbL-1.0' : ''});
      }
      return datasets;
    }
  }
}

function outerRings(geometry) {
  const canon = canonicalGeometry(geometry);
  if (!canon) return [];
  if (canon.type === 'Polygon') return [canon.coordinates[0]];
  return canon.coordinates.map(p => p[0]);
}

function bboxOf(rings) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const ring of rings) for (const p of ring) {
    if (p[0] < minX) minX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] > maxY) maxY = p[1];
  }
  return [minX, minY, maxX, maxY];
}

function bboxHit(a, b) {
  return !(a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1]);
}

function onSegment(a, b, p) {
  const cross = (p[1] - a[1]) * (b[0] - a[0]) - (p[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(cross) > 1e-12) return false;
  return Math.min(a[0], b[0]) - 1e-12 <= p[0] && p[0] <= Math.max(a[0], b[0]) + 1e-12
    && Math.min(a[1], b[1]) - 1e-12 <= p[1] && p[1] <= Math.max(a[1], b[1]) + 1e-12;
}

function pointClass(lon, lat, ring) {
  for (let i = 0; i < ring.length - 1; i++) if (onSegment(ring[i], ring[i + 1], [lon, lat])) return 'boundary';
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const yi = ring[i][1], yj = ring[j][1], xi = ring[i][0], xj = ring[j][0];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside ? 'inside' : 'outside';
}

function orient(a, b, c) {
  const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  if (Math.abs(v) < 1e-12) return 0;
  return v > 0 ? 1 : -1;
}

function properCross(a, b, c, d) {
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

export function geometriesOverlap(a, b, hashesDiffer) {
  const ra = outerRings(a), rb = outerRings(b);
  if (!ra.length || !rb.length) return false;
  if (!hashesDiffer && geometryHash(a) && geometryHash(a) === geometryHash(b)) return false;
  if (!bboxHit(bboxOf(ra), bboxOf(rb))) return false;
  if (samplesInside(ra, rb) || samplesInside(rb, ra)) return true;
  for (const ringA of ra) for (const ringB of rb) {
    for (let i = 0; i < ringA.length - 1; i++) for (let j = 0; j < ringB.length - 1; j++) {
      if (properCross(ringA[i], ringA[i + 1], ringB[j], ringB[j + 1])) return true;
    }
  }
  return false;
}

function samplesInside(from, into) {
  for (const ring of from) {
    for (let i = 0; i < ring.length - 1; i++) {
      const mid = [(ring[i][0] + ring[i + 1][0]) / 2, (ring[i][1] + ring[i + 1][1]) / 2];
      if (into.some(other => pointClass(mid[0], mid[1], other) === 'inside')) return true;
      if (into.some(other => pointClass(ring[i][0], ring[i][1], other) === 'inside')) return true;
    }
  }
  return false;
}

function sourceSummary(properties) {
  const rows = parseSources(properties?.sources);
  const datasets = [...new Set(rows.map(row => row.dataset).filter(Boolean))];
  const licenses = [...new Set(rows.map(row => row.license).filter(Boolean))];
  return {datasets, licenses};
}

export function emptyRegistry(meta) {
  return {
    version: 1,
    frozen: true,
    snapshot: meta || {},
    records: [],
    quarantine: [],
    ownership: {version: 1, claims: {}}
  };
}

export function importSnapshot(features, previous, meta) {
  const prior = previous && previous.version === 1 ? previous : emptyRegistry(meta);
  const ownership = prior.ownership || {version: 1, claims: {}};
  const incoming = (features || []).map((feature, index) => {
    const geometry = canonicalGeometry(feature.geometry);
    const hash = geometryHash(feature.geometry);
    return {
      index,
      gersId: String(feature?.properties?.id || feature?.id || ''),
      geometry,
      hash,
      sources: sourceSummary(feature?.properties)
    };
  }).filter(item => item.geometry && item.hash && item.gersId);
  const adopted = new Map((prior.records || []).map(record => [record.geometryHash, {...record, gersIds: [...record.gersIds]}]));
  const byGers = new Map();
  for (const record of adopted.values()) for (const id of record.gersIds) byGers.set(id, record);
  const quarantine = [];
  const usedHashes = new Set();
  for (const item of incoming) {
    const exact = adopted.get(item.hash);
    if (exact) {
      if (!exact.gersIds.includes(item.gersId)) exact.gersIds.push(item.gersId);
      usedHashes.add(item.hash);
      continue;
    }
    const sameVendor = byGers.get(item.gersId);
    if (sameVendor && sameVendor.geometryHash !== item.hash) {
      quarantine.push({reason: 'vendor-geometry-changed', gersId: item.gersId, relatedGameIds: [sameVendor.gameId], saleable: false});
      continue;
    }
    const overlapped = [...adopted.values()].filter(record => geometriesOverlap(item.geometry, record.geometry));
    if (overlapped.length) {
      quarantine.push({
        reason: overlapped.length > 1 ? 'split-or-merge' : 'overlaps-adopted',
        gersId: item.gersId,
        relatedGameIds: overlapped.map(record => record.gameId),
        saleable: false
      });
      continue;
    }
    const twins = incoming.filter(other => other.hash === item.hash);
    if (twins.length > 1) {
      quarantine.push({reason: 'duplicate-geometry', gersId: item.gersId, relatedGameIds: [], saleable: false});
      continue;
    }
    const peers = incoming.filter(other => other !== item && other.hash !== item.hash && geometriesOverlap(item.geometry, other.geometry));
    if (peers.length) {
      quarantine.push({reason: 'overlap', gersId: item.gersId, relatedGameIds: [], saleable: false, geometry: item.geometry});
      continue;
    }
    const gameId = gameIdForGeometry(item.geometry);
    adopted.set(item.hash, {
      gameId,
      geometryHash: item.hash,
      gersIds: [item.gersId],
      geometry: item.geometry,
      sources: item.sources,
      status: 'adopted'
    });
    usedHashes.add(item.hash);
  }
  const records = [...adopted.values()].sort((a, b) => a.gameId < b.gameId ? -1 : 1);
  return {
    version: 1,
    frozen: true,
    snapshot: {...(prior.snapshot || {}), ...(meta || {}), adopted: records.length, quarantined: quarantine.length},
    records,
    quarantine,
    ownership
  };
}

export function overlayFromRegistry(registry) {
  const features = [];
  for (const record of registry.records || []) {
    features.push({
      type: 'Feature',
      properties: {gameId: record.gameId, gersId: record.gersIds[0] || '', adopted: true},
      geometry: record.geometry
    });
  }
  for (const item of registry.quarantine || []) {
    if (!item.geometry) continue;
    features.push({
      type: 'Feature',
      properties: {gameId: '', gersId: item.gersId || '', adopted: false, reason: item.reason},
      geometry: item.geometry
    });
  }
  return {type: 'FeatureCollection', features};
}

function cellKeys(bbox, size) {
  const keys = [];
  const x0 = Math.floor(bbox[0] / size), x1 = Math.floor(bbox[2] / size);
  const y0 = Math.floor(bbox[1] / size), y1 = Math.floor(bbox[3] / size);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) keys.push(`${x}:${y}`);
  return keys;
}

export function reconcileIncoming(previous, features, options = {}) {
  const prior = previous && previous.version === 1 ? previous : emptyRegistry();
  const keptRecords = [...(prior.records || [])];
  const quarantine = [...(prior.quarantine || [])];
  const quarantineHashes = new Set();
  for (const item of quarantine) if (item.geometry) quarantineHashes.add(geometryHash(item.geometry));
  const byHash = new Map(keptRecords.map(record => [record.geometryHash, record]));
  const byGers = new Map();
  for (const record of keptRecords) for (const id of record.gersIds) byGers.set(id, record);
  const size = options.cellSize || 0.002;
  const grid = new Map();
  const put = item => {
    for (const key of cellKeys(item.bbox, size)) {
      let bucket = grid.get(key);
      if (!bucket) grid.set(key, bucket = []);
      bucket.push(item);
    }
  };
  const indexed = [];
  const addFixed = (geometry, hash, kind) => {
    const rings = outerRings(geometry);
    if (!rings.length) return;
    const item = {hash, geometry, bbox: bboxOf(rings), kind, fixed: true};
    indexed.push(item);
    put(item);
  };
  for (const record of keptRecords) addFixed(record.geometry, record.geometryHash, 'adopted');
  for (const item of quarantine) if (item.geometry) addFixed(item.geometry, `q:${item.gersId}:${item.reason}`, 'quarantine');
  const candidates = [];
  let matchedExisting = 0;
  for (const feature of features || []) {
    const geometry = canonicalGeometry(feature.geometry);
    const hash = geometryHash(feature.geometry);
    const gersId = String(feature?.properties?.id || feature?.id || '');
    if (!geometry || !hash || !gersId) continue;
    const exact = byHash.get(hash);
    if (exact) {
      matchedExisting += 1;
      continue;
    }
    if (quarantineHashes.has(hash)) {
      matchedExisting += 1;
      continue;
    }
    const sameVendor = byGers.get(gersId);
    if (sameVendor && sameVendor.geometryHash !== hash) {
      quarantine.push({reason: 'vendor-geometry-changed', gersId, relatedGameIds: [sameVendor.gameId], saleable: false, geometry});
      continue;
    }
    const rings = outerRings(geometry);
    if (!rings.length) continue;
    const item = {
      hash,
      gersId,
      geometry,
      bbox: bboxOf(rings),
      sources: sourceSummary(feature.properties),
      properties: {class: feature.properties?.class ?? null, subtype: feature.properties?.subtype ?? null},
      fixed: false
    };
    candidates.push(item);
    put(item);
  }
  const hashCount = new Map();
  for (const item of candidates) hashCount.set(item.hash, (hashCount.get(item.hash) || 0) + 1);
  const rejected = new Map();
  const reject = (item, reason, relatedGameIds) => {
    if (!rejected.has(item.hash)) rejected.set(item.hash, {reason, relatedGameIds: relatedGameIds || []});
  };
  for (const item of candidates) {
    const seen = new Set();
    for (const key of cellKeys(item.bbox, size)) {
      for (const other of grid.get(key) || []) {
        if (other === item || other.hash === item.hash || seen.has(other.hash)) continue;
        if (!item.fixed && other.fixed === false && other.hash < item.hash) continue;
        seen.add(other.hash);
        if (!bboxHit(item.bbox, other.bbox)) continue;
        if (!geometriesOverlap(item.geometry, other.geometry, true)) continue;
        if (other.kind === 'adopted') reject(item, 'overlaps-adopted', []);
        else if (other.fixed) reject(item, 'overlaps-quarantine', []);
        else {
          reject(item, 'overlap', []);
          reject(other, 'overlap', []);
        }
      }
    }
  }
  const fresh = [];
  for (const item of candidates) {
    if ((hashCount.get(item.hash) || 0) > 1) {
      quarantine.push({reason: 'duplicate-geometry', gersId: item.gersId, relatedGameIds: [], saleable: false, geometry: item.geometry});
      continue;
    }
    if (rejected.has(item.hash)) {
      const held = rejected.get(item.hash);
      quarantine.push({reason: held.reason, gersId: item.gersId, relatedGameIds: held.relatedGameIds, saleable: false, geometry: item.geometry});
      continue;
    }
    fresh.push({
      gameId: gameIdForGeometry(item.geometry),
      geometryHash: item.hash,
      gersIds: [item.gersId],
      geometry: item.geometry,
      sources: item.sources,
      status: 'adopted',
      className: item.properties.class,
      subtype: item.properties.subtype
    });
  }
  const records = keptRecords.concat(fresh).sort((a, b) => a.gameId < b.gameId ? -1 : 1);
  return {
    version: 1,
    frozen: true,
    snapshot: {...(prior.snapshot || {}), reconciled: true, matchedExisting, adopted: records.length, quarantined: quarantine.length},
    records,
    quarantine,
    ownership: prior.ownership || {version: 1, claims: {}},
    stats: {matchedExisting, candidates: candidates.length, rejected: rejected.size, adopted: records.length, quarantined: quarantine.length}
  };
}

export function claimRecord(ownership, input) {
  const state = ownership && ownership.version === 1 ? ownership : {version: 1, claims: {}};
  const claims = {...state.claims};
  const gameId = String(input?.gameId || '');
  const playerId = String(input?.playerId || '');
  const role = input?.role === 'tenant' ? 'tenant' : input?.role === 'owner' ? 'owner' : '';
  if (!gameId || !playerId || !role) return {ok: false, reason: 'missing', ownership: state};
  const current = claims[gameId] ? {...claims[gameId]} : {owner: '', tenant: ''};
  if (current[role] && current[role] !== playerId) return {ok: false, reason: 'taken', ownership: state, claim: current};
  if (current[role] === playerId) return {ok: true, reason: 'same', ownership: state, claim: current};
  current[role] = playerId;
  claims[gameId] = current;
  return {ok: true, reason: 'claimed', ownership: {version: 1, claims}, claim: current};
}
