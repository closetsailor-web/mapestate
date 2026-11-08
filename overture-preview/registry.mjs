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

export function geometriesOverlap(a, b) {
  const ra = outerRings(a), rb = outerRings(b);
  if (!ra.length || !rb.length) return false;
  if (geometryHash(a) && geometryHash(a) === geometryHash(b)) return false;
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
