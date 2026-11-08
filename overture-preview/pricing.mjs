// Game estimates for the frozen building overlay.
// Residential dollars follow the current game functions baseValue() and value()
// in 3d-5d6ea64333a6/index.html. This file does not read or write fe.* or yp.* saves.
// A game estimate is not a real valuation, not a listing, and not a purchase.

import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {geometryHash} from './registry.mjs';

const HOUSE_MEDIAN = 703000;
const UNIT_MEDIAN = 495000;
const CBD_RELATIVE = 0.78;
const HOUSE_TYPICAL_M2 = 220;
const UNIT_TYPICAL_M2 = 360;
const UNIT_SIZE_FACTOR = 1.1;
const MARKET_KEY = 'c10';

export const ADJUSTMENTS = {
  version: 1,
  residential: 0,
  commercialMinBps: 3000,
  commercialMaxBps: 4000,
  other: 0,
  otherStatus: 'pending-review'
};

const INELIGIBLE = new Set(['roof', 'shed', 'garage', 'outbuilding', 'carport']);
const COMMERCIAL = new Set(['commercial', 'retail', 'office', 'warehouse']);
const UNIT = new Set(['apartments', 'terrace', 'townhouse']);
const HOUSE = new Set(['residential', 'house', 'detached', 'semidetached']);

export function gameHash(text) {
  let h = 2166136261;
  for (const ch of String(text)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

export function marketIndex(key, week) {
  const phase = gameHash('ph' + key);
  const amplitude = 0.04 + gameHash('am' + key) * 0.05;
  const trend = 0.04 + gameHash('tr' + key) * 0.04;
  const period = 364 * (5 + gameHash('cy' + key) * 4) / 7;
  const omega = 2 * Math.PI / period;
  return Math.exp(trend * week / 52 + (amplitude / 52) / omega * (Math.cos(2 * Math.PI * phase) - Math.cos(omega * week + 2 * Math.PI * phase)) + 0.015 * Math.sin(week / 9 + phase * 20));
}

function houseSize(areaM2) {
  const raw = (areaM2 / HOUSE_TYPICAL_M2) ** 0.3;
  return Math.min(1.6, Math.max(0.7, raw));
}

function variation(gameId) {
  return 0.9 + gameHash(gameId) * 0.2;
}

export function residentialGameValue({gameId, areaM2, dwelling}) {
  const median = dwelling === 'unit' ? UNIT_MEDIAN : HOUSE_MEDIAN;
  const size = dwelling === 'unit' ? UNIT_SIZE_FACTOR : houseSize(areaM2);
  const base = median * CBD_RELATIVE * size * variation(gameId) * marketIndex(MARKET_KEY, 0);
  return Math.round(base / 1000) * 1000;
}

export function commercialUpliftBps(gameId) {
  return ADJUSTMENTS.commercialMinBps + Math.floor(gameHash('commercial-uplift:' + gameId) * (ADJUSTMENTS.commercialMaxBps - ADJUSTMENTS.commercialMinBps + 1));
}

export function applyAdjustment(base, group, gameId) {
  if (group === 'commercial') {
    const upliftBps = commercialUpliftBps(gameId);
    return {estimate: Math.round(base * (1 + upliftBps / 10000)), upliftBps};
  }
  if (group === 'other') return {estimate: Math.round(base * (1 + ADJUSTMENTS.other)), upliftBps: 0};
  return {estimate: base, upliftBps: 0};
}

export function classifyBuilding(className, subtype) {
  const tokens = [className, subtype].map(value => String(value || '').trim().toLowerCase()).filter(Boolean);
  if (!tokens.length || tokens.some(token => INELIGIBLE.has(token))) {
    return {group: 'ineligible', dwelling: null, tone: 'none'};
  }
  if (tokens.some(token => COMMERCIAL.has(token))) return {group: 'commercial', dwelling: 'house', tone: 'trade'};
  if (tokens.some(token => UNIT.has(token))) return {group: 'residential', dwelling: 'unit', tone: 'home'};
  if (tokens.some(token => HOUSE.has(token))) return {group: 'residential', dwelling: 'house', tone: 'home'};
  return {group: 'other', dwelling: 'house', tone: 'other'};
}

export function footprintAreaM2(geometry) {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
  let total = 0;
  for (const polygon of polygons) {
    const ring = polygon?.[0];
    if (!ring || ring.length < 4) continue;
    const lat = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
    const kx = 111320 * Math.cos(lat * Math.PI / 180);
    const ky = 110540;
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      area += ring[i][0] * kx * ring[i + 1][1] * ky - ring[i + 1][0] * kx * ring[i][1] * ky;
    }
    total += Math.abs(area) / 2;
  }
  return total;
}

export function buildPricing(registry, features) {
  const byHash = new Map();
  for (const feature of features || []) {
    const hash = geometryHash(feature.geometry);
    if (hash && !byHash.has(hash)) byHash.set(hash, feature);
  }
  const rows = [];
  for (const record of registry.records || []) {
    const feature = byHash.get(record.geometryHash);
    const props = feature?.properties || {};
    const kind = classifyBuilding(props.class, props.subtype);
    const areaM2 = footprintAreaM2(record.geometry);
    if (kind.group === 'ineligible') {
      rows.push({gameId: record.gameId, tone: 'none', eligible: false, estimate: null, upliftBps: 0});
      continue;
    }
    const base = residentialGameValue({gameId: record.gameId, areaM2, dwelling: kind.dwelling});
    const priced = applyAdjustment(base, kind.group, record.gameId);
    rows.push({gameId: record.gameId, tone: kind.tone, eligible: true, estimate: priced.estimate, upliftBps: priced.upliftBps});
  }
  rows.sort((a, b) => a.gameId < b.gameId ? -1 : 1);
  return {
    version: 1,
    kind: 'game-estimate',
    disclaimer: 'Game prices for this preview. Not real property values. Not listings. Purchasing is not enabled.',
    adjustments: ADJUSTMENTS,
    formula: {
      profile: 'regional',
      houseMedian: HOUSE_MEDIAN,
      unitMedian: UNIT_MEDIAN,
      suburbKind: 'cbd',
      suburbRelative: CBD_RELATIVE,
      houseTypicalM2: HOUSE_TYPICAL_M2,
      unitTypicalM2: UNIT_TYPICAL_M2,
      unitSizeFactor: UNIT_SIZE_FACTOR,
      houseSizeMin: 0.7,
      houseSizeMax: 1.6,
      sizeExponent: 0.3,
      bedroomMultiplier: 1,
      waterPremium: 0,
      week: 0,
      marketKey: MARKET_KEY,
      releaseBoost: 1,
      roundResidentialTo: 1000
    },
    rows
  };
}

function writtenFromDisk() {
  const root = dirname(new URL(import.meta.url).pathname);
  const registry = JSON.parse(readFileSync(resolve(root, 'data/registry-v1.json'), 'utf8'));
  const source = JSON.parse(readFileSync(resolve(root, 'source/bundaberg-buildings.geojson'), 'utf8'));
  return buildPricing(registry, source.features);
}

if (process.argv.includes('--write')) {
  const root = dirname(new URL(import.meta.url).pathname);
  const pricing = writtenFromDisk();
  writeFileSync(resolve(root, 'data/pricing-v1.json'), JSON.stringify(pricing));
  const counts = pricing.rows.reduce((acc, row) => { acc[row.tone] = (acc[row.tone] || 0) + 1; return acc; }, {});
  console.log(JSON.stringify({rows: pricing.rows.length, counts}));
}
