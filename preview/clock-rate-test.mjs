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
assert.equal(html.includes('1 game year passes every 30 real days.'), false);
assert.ok(html.includes('1 game year passes every 14 real days.'));
assert.ok(html.includes('const YP_YEAR_REAL_DAYS=14;'));
assert.ok(html.includes('const YP_TEST_WEEK_MS=30*1000;'));
assert.ok(html.includes('Test clock: one game week takes 30 seconds.'));
assert.ok(html.includes("q==='test'||q==='real'"));
assert.ok(html.includes("mode==='test'?YP_TEST_WEEK_MS:YP_WEEK_MS"));
assert.ok(html.includes('function ypMigrateSavedClock'));
assert.ok(html.includes('function ypScaleGameMs'));
assert.ok(js.includes('function ypRescaleClockRecords'));
assert.ok(js.includes('Test option: fast clock'));
assert.ok(js.includes('ypWeekMs(clock)'));
assert.equal(js.includes('return n>0?n:30000'), false);

function runClock(search){
  const sandbox = {localStorage: {getItem(){return null;}, setItem(){}}, location: {search}, URLSearchParams};
  vm.createContext(sandbox);
  const start = html.indexOf('const YP_WEEKS_PER_YEAR=');
  const end = html.indexOf('const CFG=');
  assert.ok(start > 0 && end > start, 'clock block is in the page');
  vm.runInContext(html.slice(start, end) + `
this.YP_YEAR_REAL_DAYS=YP_YEAR_REAL_DAYS;
this.YP_WEEK_MS=YP_WEEK_MS;
this.YP_TEST_WEEK_MS=YP_TEST_WEEK_MS;
this.resolved=ypResolveWeekMs();
this.years90=90*YP_YEAR_REAL_DAYS/365.2425;
this.scale=ypScaleGameMs;
`, sandbox);
  return sandbox;
}
const sandbox = runClock('');
const testClock = runClock('?speed=test');
assert.equal(sandbox.YP_YEAR_REAL_DAYS, 14);
assert.equal(sandbox.resolved, sandbox.YP_WEEK_MS, 'default speed is the real year, not the test clock');
assert.equal(testClock.resolved, testClock.YP_TEST_WEEK_MS);
assert.equal(testClock.YP_TEST_WEEK_MS, 30 * 1000);
assert.notEqual(sandbox.YP_WEEK_MS, testClock.YP_TEST_WEEK_MS);

const weekMs = sandbox.YP_WEEK_MS;
const hourMin = weekMs / 168 / 60000;
assert.equal(weekMs, Math.round(14 / 52.1775 * 24 * 60 * 60 * 1000));
assert.ok(html.includes('const YP_WEEK_MS=Math.round(YP_YEAR_REAL_DAYS/YP_WEEKS_PER_YEAR*24*60*60*1000);'));
assert.ok(Math.abs(weekMs / 3600000 - (6 + 27 / 60)) < 0.02, 'week is about 6h27m');
assert.ok(Math.abs(hourMin - 2.30) < 0.02, 'game hour scales with the 14-day year');
assert.ok(Math.abs(sandbox.years90 - 3.45) < 0.05, '90 game years is about 3.45 real years');
assert.ok(Math.abs(52 * weekMs / 86400000 - 14) < 0.2, '12-month lease is about 14 real days');

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
