import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const html = readFileSync(new URL('../preview-406b69525cf5/index.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../preview-406b69525cf5/map-preview.js', import.meta.url), 'utf8');

assert.equal(html.includes('weekMs:30000'), false);
assert.equal(html.includes('1 game week = 30 s'), false);
assert.equal(html.includes('every 30 seconds is one week'), false);
assert.equal(html.includes('A game week takes 30 seconds'), false);
assert.equal(js.includes(':30000'), false);
assert.ok(html.includes('1 game year passes every 30 real days.'));
assert.ok(html.includes('function ypMigrateSavedClock'));
assert.ok(html.includes('function ypScaleGameMs'));
assert.ok(js.includes('function ypRescaleClockRecords'));
assert.ok(js.includes('Test option: fast clock'));
assert.ok(js.includes('ypWeekMs(clock)'));
assert.equal(js.includes('return n>0?n:30000'), false);

const sandbox = {localStorage: {getItem(){return null;}, setItem(){}}, location: {search: ''}, URLSearchParams};
vm.createContext(sandbox);
vm.runInContext(`
const YP_WEEKS_PER_YEAR=52.1775;
const YP_YEAR_REAL_DAYS=30;
const YP_WEEK_MS=Math.round(YP_YEAR_REAL_DAYS/YP_WEEKS_PER_YEAR*24*60*60*1000);
const YP_TEST_WEEK_MS=30*1000;
function ypScaleGameMs(ms,from,to){if(!Number.isFinite(+ms)||!(from>0)||!(to>0)||from===to)return +ms;const week=Math.floor(+ms/from),into=+ms-week*from;return week*to+into*to/from;}
this.YP_WEEK_MS=YP_WEEK_MS;
this.YP_TEST_WEEK_MS=YP_TEST_WEEK_MS;
this.hour=YP_WEEK_MS/168;
this.years90=90*YP_YEAR_REAL_DAYS/365.2425;
this.scale=ypScaleGameMs;
`, sandbox);

const weekMs = sandbox.YP_WEEK_MS;
const hourMin = sandbox.hour / 60000;
assert.equal(weekMs, Math.round(30 / 52.1775 * 24 * 60 * 60 * 1000));
assert.ok(html.includes('const YP_WEEK_MS=Math.round(YP_YEAR_REAL_DAYS/YP_WEEKS_PER_YEAR*24*60*60*1000);'));
assert.ok(Math.abs(weekMs / 3600000 - (13 + 48 / 60)) < 0.02, 'week is about 13h48m');
assert.ok(Math.abs(hourMin - 4.93) < 0.02, 'game hour is about 4.93 real minutes');
assert.ok(Math.abs(sandbox.years90 - 7.4) < 0.05, '90 game years is about 7.4 real years');

const old = sandbox.YP_TEST_WEEK_MS;
const acc = 15000;
const scaledAcc = Math.min(weekMs - 1, Math.round(acc * weekMs / old));
assert.ok(scaledAcc > 0 && scaledAcc < weekMs, 'partial week stays inside one week');
assert.equal(Math.floor(scaledAcc / weekMs), 0);

const gameMs = 12 * old + acc;
const approve = gameMs + old / 168;
const scaledNow = sandbox.scale(gameMs, old, weekMs);
const scaledApprove = sandbox.scale(approve, old, weekMs);
const leftHours = (scaledApprove - scaledNow) / (weekMs / 168);
assert.ok(Math.abs(leftHours - 1) < 1e-9, 'one game hour of wait survives the rate change');
assert.equal(Math.floor(scaledNow / weekMs), 12);

console.log('PASS clock rate', {weekMs, hourMin: +hourMin.toFixed(3), years90: +sandbox.years90.toFixed(3)});
