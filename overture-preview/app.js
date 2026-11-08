const statusEl = document.getElementById('status');
const gameEl = document.getElementById('game-id');
const estimateEl = document.getElementById('estimate');
const metaEl = document.getElementById('meta');
const blank = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#d5e2ef'}}]};
const sampleBounds = [[152.3421, -24.8732], [152.3535, -24.8623]];
let mapKey = '';
let parts = null;
let basemapRequested = false;
let basemapFallback = false;
let styleGeneration = 0;
let idleTried = -1;
let fitsLeft = 2;
let prices = new Map();
let selectedFeature = null;

const money = new Intl.NumberFormat('en-AU', {style: 'currency', currency: 'AUD', maximumFractionDigits: 0});

const map = window.__ypMap = new maplibregl.Map({
  container: 'map',
  style: blank,
  center: [152.348, -24.8665],
  zoom: 15.2,
  attributionControl: {compact: false},
  transformRequest(url) {
    try {
      const parsed = new URL(url, window.location.href);
      if (mapKey && parsed.hostname === 'api.maptiler.com') parsed.searchParams.set('key', mapKey);
      return {url: parsed.href};
    } catch {
      return {url};
    }
  }
});

function redact(text) {
  const raw = String(text || 'Map error');
  return mapKey ? raw.split(mapKey).join('[redacted]') : raw;
}

function note(text) {
  if (!gameEl.textContent) statusEl.textContent = text;
}

async function keyIfAny() {
  try {
    const response = await fetch('/runtime-config');
    if (!response.ok) return '';
    const body = await response.json();
    return typeof body.key === 'string' ? body.key : '';
  } catch {
    return '';
  }
}

function hideVendorBuildings() {
  const layers = map.getStyle()?.layers || [];
  for (const layer of layers) {
    if (String(layer.id || '').startsWith('ypb-')) continue;
    const sourceLayer = String(layer['source-layer'] || '');
    const id = String(layer.id || '');
    if (sourceLayer === 'building' || /^building($|-)/i.test(id)) {
      try { map.setLayoutProperty(layer.id, 'visibility', 'none'); } catch {}
    }
  }
}

function installOverlay() {
  if (!parts) return false;
  const {adopted, held} = parts;
  if (!map.getSource('ypb-buildings')) map.addSource('ypb-buildings', {type: 'geojson', data: adopted});
  else map.getSource('ypb-buildings').setData(adopted);
  if (!map.getSource('ypb-quarantine')) map.addSource('ypb-quarantine', {type: 'geojson', data: held});
  else map.getSource('ypb-quarantine').setData(held);
  const selected = {type: 'FeatureCollection', features: selectedFeature ? [selectedFeature] : []};
  if (!map.getSource('ypb-selected')) map.addSource('ypb-selected', {type: 'geojson', data: selected});
  else map.getSource('ypb-selected').setData(selected);
  const layers = [
    {id: 'ypb-quarantine-fill', type: 'fill', source: 'ypb-quarantine', paint: {'fill-color': '#8b95a8', 'fill-opacity': 0.45}},
    {id: 'ypb-fill', type: 'fill', source: 'ypb-buildings', paint: {'fill-color': ['match', ['get', 'tone'], 'home', '#e07a2f', 'trade', '#1f7a6b', 'other', '#c4a35a', 'none', '#d5dbe3', '#d5dbe3'], 'fill-opacity': 0.78}},
    {id: 'ypb-line', type: 'line', source: 'ypb-buildings', paint: {'line-color': '#7a3410', 'line-width': 1.4}},
    {id: 'ypb-selected-fill', type: 'fill', source: 'ypb-selected', paint: {'fill-color': '#1a6fff', 'fill-opacity': 0.5}},
    {id: 'ypb-selected-line', type: 'line', source: 'ypb-selected', paint: {'line-color': '#0b2545', 'line-width': 3}}
  ];
  for (const layer of layers) if (!map.getLayer(layer.id)) map.addLayer(layer);
  return !!map.getLayer('ypb-fill');
}

function frameSample() {
  if (fitsLeft <= 0) return;
  fitsLeft -= 1;
  map.fitBounds(sampleBounds, {padding: {left: 450, right: 36, top: 28, bottom: 72}, duration: 0, maxZoom: 16});
}

function restoreOverlay() {
  hideVendorBuildings();
  const ready = installOverlay();
  if (ready) frameSample();
  return ready;
}

map.on('style.load', () => {
  styleGeneration += 1;
  try { restoreOverlay(); } catch (error) { note(`The building overlay did not attach (${redact(error.message)}).`); }
});

map.on('idle', () => {
  if (!parts || !map.isStyleLoaded() || map.getLayer('ypb-fill') || idleTried === styleGeneration) return;
  idleTried = styleGeneration;
  try { restoreOverlay(); } catch (error) { note(`The building overlay did not attach (${redact(error.message)}).`); }
});

map.on('error', event => {
  const message = redact(event?.error?.message || event?.message || 'Map error');
  if (map.getLayer('ypb-fill')) return;
  if (!basemapFallback) {
    basemapFallback = true;
    note(`The basemap did not finish (${message}). The building shapes are shown without it.`);
    map.setStyle(blank);
    return;
  }
  note(`The basemap did not finish (${message}).`);
});

function clearSelection() {
  selectedFeature = null;
  estimateEl.textContent = '';
  const source = map.getSource('ypb-selected');
  if (source) source.setData({type: 'FeatureCollection', features: []});
}

function show(feature) {
  const props = feature?.properties || {};
  if (!map.getLayer('ypb-fill')) {
    note('The building overlay is not on the map yet.');
    return;
  }
  if (!feature) {
    statusEl.textContent = `${parts.adopted.features.length} buildings are drawn. ${parts.held.features.length} overlaps kept out. Tap a building.`;
    gameEl.textContent = '';
    metaEl.textContent = '';
    clearSelection();
    return;
  }
  if (!props.adopted) {
    statusEl.textContent = 'Quarantined overlap. Not a saleable property.';
    gameEl.textContent = 'No game id';
    estimateEl.textContent = '';
    metaEl.textContent = `Reason: ${props.reason || 'overlap'}. Vendor reference ${props.gersId || 'unavailable'}.`;
    clearSelection();
    return;
  }
  selectedFeature = feature;
  const row = prices.get(props.gameId);
  statusEl.textContent = 'Selected building';
  gameEl.textContent = props.gameId;
  if (row && row.eligible && Number.isInteger(row.estimate)) {
    estimateEl.textContent = money.format(row.estimate);
    metaEl.textContent = 'Game estimate. Not a real property value, and not a listing.';
  } else {
    estimateEl.textContent = 'No game estimate';
    metaEl.textContent = 'Nothing is listed or for sale.';
  }
  const source = map.getSource('ypb-selected');
  if (source) source.setData({type: 'FeatureCollection', features: [feature]});
}

map.on('load', async () => {
  try {
    const overlay = await (await fetch('/data/overlay-v1.geojson')).json();
    try {
      const pricing = await (await fetch('/data/pricing-v1.json')).json();
      prices = new Map((pricing.rows || []).map(row => [row.gameId, row]));
    } catch {
      prices = new Map();
    }
    const features = Array.isArray(overlay.features) ? overlay.features : [];
    const withTone = feature => {
      const row = prices.get(feature.properties && feature.properties.gameId);
      return {...feature, properties: {...feature.properties, tone: row ? row.tone : 'none'}};
    };
    parts = {
      adopted: {type: 'FeatureCollection', features: features.filter(feature => feature.properties && feature.properties.adopted).map(withTone)},
      held: {type: 'FeatureCollection', features: features.filter(feature => !(feature.properties && feature.properties.adopted))}
    };
    restoreOverlay();
    statusEl.textContent = `${parts.adopted.features.length} adopted buildings. ${parts.held.features.length} overlaps kept out. Tap a building.`;
    const key = await keyIfAny();
    if (key && !basemapRequested) {
      basemapRequested = true;
      mapKey = key;
      map.setStyle('https://api.maptiler.com/maps/base-v4/style.json');
    }
  } catch (error) {
    note(`The building file did not load (${redact(error.message)}).`);
  }
});

map.on('click', event => {
  const layers = ['ypb-fill', 'ypb-quarantine-fill'].filter(id => map.getLayer(id));
  if (!layers.length) {
    note('The building overlay is not on the map yet.');
    return;
  }
  let hits = [];
  try {
    hits = map.queryRenderedFeatures(event.point, {layers});
  } catch (error) {
    note(`The building click could not be read (${redact(error.message)}).`);
    return;
  }
  const adopted = hits.find(hit => hit.layer && hit.layer.id === 'ypb-fill');
  const hit = adopted || hits[0] || null;
  const full = hit?.properties?.gameId ? parts.adopted.features.find(feature => feature.properties.gameId === hit.properties.gameId) : null;
  show(full || hit);
});
