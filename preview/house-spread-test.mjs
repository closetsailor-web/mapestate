import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const src = readFileSync(new URL('../preview-406b69525cf5/map-preview.js', import.meta.url), 'utf8');
assert.equal(src.includes('function ypChooseFootprints'), false);
assert.ok(src.includes('const YP_HOUSE_MIN_M2=80,YP_HOUSE_MAX_M2=450'));
assert.ok(src.includes('ypSpreadSites(homes,10)'));
assert.ok(src.includes('if(!(area>=YP_HOUSE_MIN_M2&&area<=YP_HOUSE_MAX_M2))continue'));
assert.ok(src.includes("tone==='trade'||tone==='other'"));
assert.equal(src.includes("props.tone!=='home'"), false);

const start = src.indexOf('function ypDistanceM');
const end = src.indexOf('function ypAreaStockReady');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(src.slice(start, end) + '\nthis.api={ypSpreadSites};', sandbox);
const points = [];
for (let i = 0; i < 16; i++) points.push({lon: 152.45 + i * 0.001, lat: -24.82, d: i * 80, footprintId: 'h' + i, geometry: {type: 'Polygon', coordinates: []}});
const chosen = sandbox.api.ypSpreadSites(points, 10);
assert.equal(chosen.length, 10);
assert.ok(chosen.every(p => p.footprintId && p.geometry));
assert.equal(Math.min(...chosen.map(p => p.lon)), 152.45);
assert.equal(Math.max(...chosen.map(p => p.lon)), 152.465);
const few = sandbox.api.ypSpreadSites(points.slice(0, 4), 10);
assert.equal(few.length, 4);
console.log('PASS house spread', chosen.map(p => p.footprintId).join(','));
