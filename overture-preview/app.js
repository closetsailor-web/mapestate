const statusEl = document.getElementById('status');
const gameEl = document.getElementById('game-id');
const metaEl = document.getElementById('meta');
const claimEl = document.getElementById('claim');
const ownerBtn = document.getElementById('claim-owner');
const tenantBtn = document.getElementById('claim-tenant');
let selected = '';

const blank = {version: 8, sources: {}, layers: [{id: 'bg', type: 'background', paint: {'background-color': '#d5e2ef'}}]};
const map = window.__ypMap = new maplibregl.Map({
  container: 'map',
  style: blank,
  center: [152.348, -24.8665],
  zoom: 15.2,
  attributionControl: {compact: false}
});

async function keyIfAny() {
  try {
    const response = await fetch('/runtime-config');
    if (!response.ok) return '';
    const body = await response.json();
    return body.key || '';
  } catch {
    return '';
  }
}

function hideVendorBuildings() {
  const layers = map.getStyle()?.layers || [];
  for (const layer of layers) {
    const sourceLayer = String(layer['source-layer'] || '');
    if (sourceLayer === 'building' || layer.id === 'building' || layer.id === 'building-3d') {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  }
}

function show(feature) {
  const props = feature?.properties || {};
  selected = props.adopted ? props.gameId : '';
  ownerBtn.disabled = !selected;
  tenantBtn.disabled = !selected;
  claimEl.textContent = '';
  if (!feature) {
    statusEl.textContent = 'Tap a coloured building. Grey shapes are quarantined and have no saleable id.';
    gameEl.textContent = '';
    metaEl.textContent = '';
    return;
  }
  if (!props.adopted) {
    statusEl.textContent = 'Quarantined overlap. Not a saleable property.';
    gameEl.textContent = 'No game id';
    metaEl.textContent = `Reason: ${props.reason || 'overlap'}. Vendor reference ${props.gersId || 'unavailable'}.`;
    return;
  }
  statusEl.textContent = 'Selected building';
  gameEl.textContent = props.gameId;
  metaEl.textContent = `Vendor GERS reference, not the game id: ${props.gersId}`;
  map.getSource('ypb-selected').setData({type: 'FeatureCollection', features: [feature]});
}

async function claim(role) {
  if (!selected) return;
  const response = await fetch('/api/claim', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({gameId: selected, playerId: 'local-preview-player', role})
  });
  const body = await response.json();
  claimEl.textContent = body.ok
    ? `Local file claim recorded for ${role}. Shared only inside this server process.`
    : `Local file refused the ${role} claim (${body.reason}).`;
}

ownerBtn.addEventListener('click', () => claim('owner'));
tenantBtn.addEventListener('click', () => claim('tenant'));

map.on('load', async () => {
  const overlay = await (await fetch('/data/overlay-v1.geojson')).json();
  const adopted = {type: 'FeatureCollection', features: overlay.features.filter(f => f.properties.adopted)};
  const held = {type: 'FeatureCollection', features: overlay.features.filter(f => !f.properties.adopted)};
  map.addSource('ypb-buildings', {type: 'geojson', data: adopted});
  map.addSource('ypb-quarantine', {type: 'geojson', data: held});
  map.addSource('ypb-selected', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
  map.addLayer({id: 'ypb-quarantine-fill', type: 'fill', source: 'ypb-quarantine', paint: {'fill-color': '#8b95a8', 'fill-opacity': 0.35}});
  map.addLayer({id: 'ypb-fill', type: 'fill', source: 'ypb-buildings', paint: {'fill-color': '#f4b183', 'fill-opacity': 0.72}});
  map.addLayer({id: 'ypb-line', type: 'line', source: 'ypb-buildings', paint: {'line-color': '#8a4b08', 'line-width': 1.2}});
  map.addLayer({id: 'ypb-selected-fill', type: 'fill', source: 'ypb-selected', paint: {'fill-color': '#1a6fff', 'fill-opacity': 0.45}});
  map.addLayer({id: 'ypb-selected-line', type: 'line', source: 'ypb-selected', paint: {'line-color': '#0b2545', 'line-width': 3}});
  statusEl.textContent = `${adopted.features.length} adopted buildings. ${held.features.length} overlaps kept out. Tap one.`;
  const key = await keyIfAny();
  if (key) {
    map.setStyle(`https://api.maptiler.com/maps/base-v4/style.json?key=${encodeURIComponent(key)}`);
    map.once('style.load', () => {
      hideVendorBuildings();
      map.addSource('ypb-buildings', {type: 'geojson', data: adopted});
      map.addSource('ypb-quarantine', {type: 'geojson', data: held});
      map.addSource('ypb-selected', {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
      map.addLayer({id: 'ypb-quarantine-fill', type: 'fill', source: 'ypb-quarantine', paint: {'fill-color': '#8b95a8', 'fill-opacity': 0.35}});
      map.addLayer({id: 'ypb-fill', type: 'fill', source: 'ypb-buildings', paint: {'fill-color': '#f4b183', 'fill-opacity': 0.55}});
      map.addLayer({id: 'ypb-line', type: 'line', source: 'ypb-buildings', paint: {'line-color': '#8a4b08', 'line-width': 1.2}});
      map.addLayer({id: 'ypb-selected-fill', type: 'fill', source: 'ypb-selected', paint: {'fill-color': '#1a6fff', 'fill-opacity': 0.45}});
      map.addLayer({id: 'ypb-selected-line', type: 'line', source: 'ypb-selected', paint: {'line-color': '#0b2545', 'line-width': 3}});
    });
  }
});

map.on('click', event => {
  const hits = map.queryRenderedFeatures(event.point, {layers: ['ypb-fill', 'ypb-quarantine-fill']});
  const adopted = hits.find(hit => hit.layer.id === 'ypb-fill');
  show(adopted || hits[0] || null);
});
