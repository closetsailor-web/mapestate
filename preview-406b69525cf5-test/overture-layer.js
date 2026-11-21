/* Regional building layer for the v19 game preview.
   It draws the frozen Overture overlay and opens the game property card.
   It does not create listings, owners, or claims, and it does not rewrite fe.* saves. */
(function(){
  window.__ygHandlesMapClick = true;
  const style = document.createElement('style');
  style.textContent = '#yp-building{position:fixed;inset:0;z-index:46;display:flex;align-items:center;justify-content:center;padding:20px 20px calc(108px + var(--sab));background:rgba(11,37,69,.62);font-family:Inter,system-ui,sans-serif;color:#14213d}#yp-building .card{background:#fff;border-radius:24px;width:100%;max-width:440px;box-shadow:0 20px 50px rgba(0,0,0,.35);overflow:hidden}#yp-building .hwh{margin:0;padding:18px 22px 14px;background:radial-gradient(120% 160% at 85% 0%,#1a6fff 0%,#0a3fb0 55%,#0b2545 100%);text-align:left}#yp-building .yp-kicker{margin:0 0 6px;color:rgba(255,255,255,.9);font:600 13px Inter,system-ui,sans-serif}#yp-building h2{margin:0;color:#fff;font:700 22px/1.25 Inter,system-ui,sans-serif;word-break:break-all}#yp-building .yp-price{display:flex;flex-wrap:wrap;align-items:baseline;column-gap:8px;row-gap:2px;margin:16px 22px 6px}#yp-building .yp-amt{font:800 34px/1.05 Inter,system-ui,sans-serif;color:#0b2545;letter-spacing:-.5px;min-width:0;max-width:100%}#yp-building .yp-per{margin-left:0;font:700 16px Inter,system-ui,sans-serif;color:#5a6780;white-space:nowrap}#yp-building .yp-price.yp-price-stack{flex-direction:column;align-items:flex-start;gap:2px}#yp-building .yp-place{margin:0 22px 8px;font:600 15px/1.35 Inter,system-ui,sans-serif}#yp-building .yp-status{margin:8px 22px 0;font:500 13px/1.4 Inter,system-ui,sans-serif;color:#3d4a63}#yp-building .hwx{display:flex;align-items:center;justify-content:center;min-height:48px;width:calc(100% - 44px);margin:12px 22px 18px;border:0;border-radius:999px;background:#e6ebf2;color:#14213d;font:700 16px Inter,system-ui,sans-serif;cursor:pointer}'
    +'#map{overflow:hidden}'
    +'.yp-sel-mark{width:28px;height:40px;pointer-events:none!important;overflow:visible;z-index:2}'
    +'.yp-sel-mark .yp-sel-pulse{position:absolute;left:50%;bottom:1px;width:16px;height:16px;margin:0 0 -8px -8px;border-radius:50%;background:rgba(255,106,0,.4);pointer-events:none;animation:ypSelPulse 1.6s ease-out infinite}'
    +'.yp-sel-mark .yp-sel-pin{position:absolute;left:50%;bottom:0;width:24px;height:36px;margin:0 0 0 -12px;display:block;filter:drop-shadow(0 2px 3px rgba(11,37,69,.45));pointer-events:none}'
    +'@keyframes ypSelPulse{0%{transform:scale(1);opacity:.9}100%{transform:scale(3.1);opacity:0}}'
    +'@media (prefers-reduced-motion:reduce){.yp-sel-mark .yp-sel-pulse{animation:none;opacity:.75;transform:scale(1.6)}}';
  document.head.appendChild(style);
  const money = new Intl.NumberFormat('en-AU', {style: 'currency', currency: 'AUD', maximumFractionDigits: 0});
  let manifest = null;
  let boundary = null;
  let parts = null;
  let loadedKey = '';
  let token = 0;
  let selected = null;
  let ignoreMapClicksUntil = 0;
  const CAMERA_KEY = 'yp.camera.v1';

  function map(){ return window.ypMap || window.__ypMap || null; }
  function searchVisible(){
    const host = document.getElementById('map');
    if (!host) return false;
    const cs = getComputedStyle(host);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    if (document.body.classList.contains('sheetopen')) return false;
    return true;
  }
  function hideVendor(m){
    const layers = m.getStyle()?.layers || [];
    for (const layer of layers) {
      const id = String(layer.id || '');
      if (id.startsWith('ypb-') || id.startsWith('yp-')) continue;
      const sourceLayer = String(layer['source-layer'] || '');
      if (sourceLayer === 'building' || /^building($|-)/i.test(id)) {
        try { m.setLayoutProperty(layer.id, 'visibility', 'none'); } catch (e) {}
      }
    }
  }
  function install(){
    const m = map();
    if (!m || !m.isStyleLoaded() || !parts) return false;
    hideVendor(m);
    if (!m.getSource('ypb-buildings')) m.addSource('ypb-buildings', {type: 'geojson', data: parts.adopted});
    else m.getSource('ypb-buildings').setData(parts.adopted);
    if (!m.getSource('ypb-quarantine')) m.addSource('ypb-quarantine', {type: 'geojson', data: parts.held});
    else m.getSource('ypb-quarantine').setData(parts.held);
    const selectedData = {type: 'FeatureCollection', features: selected ? [selected] : []};
    if (!m.getSource('ypb-selected')) m.addSource('ypb-selected', {type: 'geojson', data: selectedData});
    else m.getSource('ypb-selected').setData(selectedData);
    if (boundary && !m.getSource('ypb-boundary')) m.addSource('ypb-boundary', {type: 'geojson', data: boundary});
    const layers = [
      {id: 'ypb-quarantine-fill', type: 'fill', source: 'ypb-quarantine', paint: {'fill-color': '#8b95a8', 'fill-opacity': 0.45}},
      {id: 'ypb-fill', type: 'fill', source: 'ypb-buildings', paint: {'fill-color': ['match', ['get', 'tone'], 'home', '#e07a2f', 'trade', '#1f7a6b', 'other', '#c4a35a', 'none', '#d5dbe3', '#d5dbe3'], 'fill-opacity': 0.78}},
      {id: 'ypb-line', type: 'line', source: 'ypb-buildings', paint: {'line-color': '#7a3410', 'line-width': 1.4}},
      {id: 'ypb-selected-fill', type: 'fill', source: 'ypb-selected', paint: {'fill-color': '#1a6fff', 'fill-opacity': 0.5}},
      {id: 'ypb-selected-halo', type: 'line', source: 'ypb-selected', paint: {'line-color': '#ffffff', 'line-width': 0, 'line-opacity': 0}},
      {id: 'ypb-selected-line', type: 'line', source: 'ypb-selected', paint: {'line-color': '#0b2545', 'line-width': 3}}
    ];
    if (m.getSource('ypb-boundary')) layers.push({id: 'ypb-boundary', type: 'line', source: 'ypb-boundary', paint: {'line-color': '#0b2545', 'line-width': 1.5}});
    for (const layer of layers) {
      if (!m.getLayer(layer.id)) m.addLayer(layer);
      else if (layer.paint) {
        for (const key of Object.keys(layer.paint)) {
          try { m.setPaintProperty(layer.id, key, layer.paint[key]); } catch (e) {}
        }
      }
    }
    syncSelMarker();
    return !!m.getLayer('ypb-fill');
  }
  async function loadVisible(){
    const m = map();
    try {
    if (!manifest || !m || !m.isStyleLoaded() || !searchVisible()) {
      window.__ygLayer = 'skip:' + [!manifest, !m, !!(m && !m.isStyleLoaded()), !searchVisible()].join(',');
      return;
    }
    const here = ++token;
    const started = performance.now();
    const bounds = m.getBounds();
    const pad = 0.01;
    const west = bounds.getWest() - pad, south = bounds.getSouth() - pad, east = bounds.getEast() + pad, north = bounds.getNorth() + pad;
    const hits = manifest.chunks.filter(chunk => !(chunk.bbox[2] < west || chunk.bbox[0] > east || chunk.bbox[3] < south || chunk.bbox[1] > north));
    if (hits.length > 24) {
      window.__ygView = {features: 0, chunks: hits.length, wide: true, ms: Math.round(performance.now() - started)};
      syncSelMarker();
      return;
    }
    const key = hits.map(chunk => chunk.id).sort().join(',');
    if (key === loadedKey && m.getSource('ypb-buildings')) {
      window.__ygView = {features: parts.adopted.features.length, chunks: hits.length, ms: 0, cached: true};
      syncSelMarker();
      return;
    }
    const collections = await Promise.all(hits.map(chunk => fetch('data/chunks/' + chunk.id + '.json?v=prices1').then(response => response.json())));
    if (here !== token || !map()) return;
    const features = collections.flatMap(collection => collection.features || []);
    parts = {
      adopted: {type: 'FeatureCollection', features: features.filter(feature => feature.properties && feature.properties.adopted)},
      held: {type: 'FeatureCollection', features: features.filter(feature => !(feature.properties && feature.properties.adopted))}
    };
    loadedKey = key;
    window.__ygParts = parts;
    install();
    window.__ygView = {features: parts.adopted.features.length, held: parts.held.features.length, chunks: hits.length, ms: Math.round(performance.now() - started), cached: false};
    } catch (e) { window.__ygLayer = 'load-fail:' + e; window.__ygView = {error: String(e)}; }
  }
  function rememberCamera(){
    const m = map();
    if (!m || !searchVisible()) return;
    const center = m.getCenter();
    try { localStorage.setItem(CAMERA_KEY, JSON.stringify({lon: center.lng, lat: center.lat, zoom: m.getZoom()})); } catch (e) {}
  }
  function restoreCamera(){
    if (window.__ypListCentre || window.__ypPlace) return;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(CAMERA_KEY) || 'null'); } catch (e) {}
    const m = map();
    if (!m || !saved || !Number.isFinite(+saved.lon) || !Number.isFinite(+saved.lat)) return;
    m.jumpTo({center: [+saved.lon, +saved.lat], zoom: Number.isFinite(+saved.zoom) ? +saved.zoom : 15});
  }
  function line(parent, className, text){
    const el = document.createElement('p');
    el.className = className;
    el.textContent = text;
    parent.appendChild(el);
    return el;
  }
  function closePopup(event){
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    document.getElementById('yp-building')?.remove();
    selectFeature(null);
    ignoreMapClicksUntil = performance.now() + 700;
  }
  let selMarker = null;
  function ringCentroid(ring){
    if (!ring || ring.length < 3) return null;
    let x = 0, y = 0, area = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const x0 = +ring[i][0], y0 = +ring[i][1], x1 = +ring[i + 1][0], y1 = +ring[i + 1][1];
      const cross = x0 * y1 - x1 * y0;
      area += cross;
      x += (x0 + x1) * cross;
      y += (y0 + y1) * cross;
    }
    if (!area) {
      let sx = 0, sy = 0, n = 0;
      for (const p of ring) if (p && p.length >= 2) { sx += +p[0]; sy += +p[1]; n++; }
      return n ? [sx / n, sy / n] : null;
    }
    area *= 0.5;
    return [x / (6 * area), y / (6 * area)];
  }
  function selPoint(feature){
    const g = feature && feature.geometry;
    if (!g) return null;
    if (typeof ypFootprintPoint === 'function') {
      const ring = (typeof ypOuterRings === 'function' ? ypOuterRings(g) : [])[0];
      const pt = ring && ypFootprintPoint(ring);
      if (pt && Number.isFinite(+pt.lon) && Number.isFinite(+pt.lat)) return [+pt.lon, +pt.lat];
    }
    if (g.type === 'Point' && Array.isArray(g.coordinates)) return [+g.coordinates[0], +g.coordinates[1]];
    const ring = g.type === 'Polygon' ? (g.coordinates && g.coordinates[0])
      : g.type === 'MultiPolygon' ? (g.coordinates && g.coordinates[0] && g.coordinates[0][0])
      : null;
    const c = ringCentroid(ring);
    if (c && Number.isFinite(c[0]) && Number.isFinite(c[1])) return c;
    return null;
  }
  function makeSelMarkEl(){
    const el = document.createElement('div');
    el.className = 'yp-sel-mark';
    el.setAttribute('aria-hidden', 'true');
    const pulse = document.createElement('span');
    pulse.className = 'yp-sel-pulse';
    const pin = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    pin.setAttribute('class', 'yp-sel-pin');
    pin.setAttribute('viewBox', '0 0 24 36');
    pin.setAttribute('width', '24');
    pin.setAttribute('height', '36');
    pin.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 1.2C6.15 1.2 1.4 6 1.4 11.9c0 8.2 10.6 22.5 10.6 22.5s10.6-14.3 10.6-22.5C22.6 6 17.85 1.2 12 1.2z');
    path.setAttribute('fill', '#ff6a00');
    path.setAttribute('stroke', '#fff');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linejoin', 'round');
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', '12');
    dot.setAttribute('cy', '12');
    dot.setAttribute('r', '4');
    dot.setAttribute('fill', '#fff');
    pin.append(path, dot);
    el.append(pulse, pin);
    return el;
  }
  function isLinkedFeature(feature){
    const id = feature && feature.properties && (feature.properties.gameId || feature.properties.id);
    try { if (typeof ypIsLinkedHome === 'function') return !!ypIsLinkedHome(id); } catch (e) {}
    return false;
  }
  function applySelPaint(linked){
    const m = map();
    if (!m) return;
    const fill = linked ? {'fill-color':'#1a6fff','fill-opacity':0.55} : {'fill-color':'#1a6fff','fill-opacity':0.5};
    const halo = linked ? {'line-color':'#ffffff','line-width':8,'line-opacity':0.95} : {'line-color':'#ffffff','line-width':0,'line-opacity':0};
    const line = linked ? {'line-color':'#ff6a00','line-width':4} : {'line-color':'#0b2545','line-width':3};
    const set = (layer, props) => {
      if (!m.getLayer(layer)) return;
      for (const [k,v] of Object.entries(props)) { try { m.setPaintProperty(layer, k, v); } catch (e) {} }
    };
    set('ypb-selected-fill', fill);
    set('ypb-selected-halo', halo);
    set('ypb-selected-line', line);
  }
  function syncSelMarker(){
    const m = map();
    const linked = !!(selected && isLinkedFeature(selected));
    applySelPaint(linked);
    if (!linked) {
      if (selMarker) { selMarker.remove(); selMarker = null; }
      document.querySelectorAll('.yp-sel-mark').forEach(node => node.remove());
      return;
    }
    const pt = selected && selPoint(selected);
    if (!m || !pt || typeof maplibregl === 'undefined' || typeof maplibregl.Marker !== 'function') {
      if (selMarker) { selMarker.remove(); selMarker = null; }
      return;
    }
    if (selMarker) {
      const cur = selMarker.getLngLat && selMarker.getLngLat();
      const el = selMarker.getElement && selMarker.getElement();
      if (cur && el && el.isConnected && Math.abs(cur.lng - pt[0]) < 1e-9 && Math.abs(cur.lat - pt[1]) < 1e-9) return;
      selMarker.remove();
      selMarker = null;
    }
    document.querySelectorAll('.yp-sel-mark').forEach(node => node.remove());
    const el = makeSelMarkEl();
    selMarker = new maplibregl.Marker({
      element: el,
      anchor: 'bottom',
      pitchAlignment: 'viewport',
      rotationAlignment: 'viewport'
    }).setLngLat(pt).addTo(m);
  }
  function selectFeature(feature){
    selected = feature && feature.properties && feature.properties.adopted ? feature : null;
    const source = map() && map().getSource('ypb-selected');
    if (source) source.setData({type: 'FeatureCollection', features: selected ? [selected] : []});
    syncSelMarker();
  }
  function openPopup(feature){
    const props = feature && feature.properties || {};
    selectFeature(feature);
    document.getElementById('yp-building')?.remove();
    if (typeof ypOpenSaleDetail === 'function' && ypCardEligible(props) && (!ypOwnedFootprints().has(props.gameId) || ypBuyFor(props.gameId))) {
      try { ypOpenSaleDetail(feature); return; }
      catch (e) { console.warn('ypOpenSaleDetail', e); }
    }
    if (props.adopted && !ypCardEligible(props)) return;
    const panel = document.createElement('div');
    panel.id = 'yp-building';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-labelledby', 'yp-building-title');
    const card = document.createElement('div');
    card.className = 'card yp-listing';
    const head = document.createElement('div');
    head.className = 'hwh';
    const title = document.createElement('h2');
    title.id = 'yp-building-title';
    if (props.adopted) {
      if (typeof ypPropertyIdLabel === 'function') {
        title.appendChild(ypPropertyIdLabel(props.gameId));
      } else {
        const code = typeof ypPublicCode === 'function' ? ypPublicCode(props.gameId) : 'No code';
        title.textContent = 'Property ID: ' + (String(code).startsWith('ypb-') ? 'No code' : code);
        if (props.gameId) title.dataset.ypCode = props.gameId;
      }
    } else {
      const kicker = document.createElement('p');
      kicker.className = 'yp-kicker';
      kicker.textContent = 'Not saleable';
      title.textContent = 'No game id';
      head.appendChild(kicker);
    }
    head.appendChild(title);
    card.appendChild(head);
    if (typeof ypCardEligible === 'function' ? ypCardEligible(props) : (props.adopted && props.eligible === true && Number.isInteger(props.estimate))) {
      const price = document.createElement('p');
      price.className = 'yp-price';
      const amt = document.createElement('span');
      amt.className = 'yp-amt';
      amt.id = 'yp-building-estimate';
      amt.textContent = money.format(props.estimate);
      const per = document.createElement('span');
      per.className = 'yp-per';
      per.textContent = ' Game estimate';
      price.append(amt, per);
      card.appendChild(price);
      if(typeof ypFitPriceRow==='function')ypFitPriceRow(price);
    } else {
      line(card, 'yp-place', 'No game estimate');
    }
    line(card, 'yp-place', props.adopted ? 'A game player owns this property.' : 'This overlap is held out. It cannot be listed.');
    line(card, 'yp-status', 'A game price is not a real valuation. Only a player who owns a home can list a rental or a room share.');
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'hwx';
    back.textContent = 'Back';
    back.addEventListener('click', closePopup);
    card.appendChild(back);
    panel.addEventListener('click', event => { if (event.target === panel) closePopup(event); });
    panel.appendChild(card);
    document.body.appendChild(panel);
  }
  window.__ygSelect = selectFeature;
  window.__ygOpen = openPopup;
  function onClick(event){
    const m = map();
    if (!m || performance.now() < ignoreMapClicksUntil || document.getElementById('yp-building') || document.getElementById('yp-sale-detail')) return;
    if (typeof ypListingHit === 'function' && ypListingHit(event)) return;
    if (m.getLayer('yp-rental-cluster')) {
      try {
        if (m.queryRenderedFeatures(event.point, {layers: ['yp-rental-cluster']}).length) return;
      } catch (e) {}
    }
    const layers = ['ypb-fill', 'ypb-quarantine-fill'].filter(id => m.getLayer(id));
    if (!layers.length) return;
    let hits = [];
    try { hits = m.queryRenderedFeatures(event.point, {layers}); } catch (e) { return; }
    const adopted = hits.find(hit => hit.layer && hit.layer.id === 'ypb-fill');
    const hit = adopted || hits[0];
    if (!hit) return;
    const full = parts && parts.adopted.features.find(feature => feature.properties.gameId && feature.properties.gameId === hit.properties.gameId);
    const held = !full && parts && parts.held.features.find(feature => feature.properties.gersId === hit.properties.gersId);
    openPopup(full || held || hit);
  }
  function attach(){
    const m = map();
    if (!m || m.__ygAttached) return false;
    m.__ygAttached = true;
    window.__ygLayer = 'attached';
    m.on('style.load', () => { loadVisible(); });
    m.on('moveend', () => { rememberCamera(); loadVisible(); });
    m.on('click', onClick);
    restoreCamera();
    loadVisible();
    if (!window.__ygWatch) window.__ygWatch = setInterval(() => { if (searchVisible()) loadVisible(); }, 1000);
    return true;
  }
  async function boot(){
    try {
      manifest = await (await fetch('data/chunk-manifest.json')).json();
      boundary = await (await fetch('data/boundary.geojson')).json();
      window.__ygLayer = 'manifest';
    } catch (e) { window.__ygLayer = 'manifest-fail'; return; }
    const wait = setInterval(() => { if (attach()) clearInterval(wait); }, 200);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
