import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const htmlPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'preview-406b69525cf5', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const start = html.indexOf('function fmtCompact(');
assert.ok(start > 0, 'fmtCompact is defined');
let i = html.indexOf('{', start);
let depth = 0;
let end = i;
for (; end < html.length; end++) {
  if (html[end] === '{') depth++;
  else if (html[end] === '}') {
    depth--;
    if (depth === 0) { end++; break; }
  }
}
const fmtCompact = vm.runInNewContext(html.slice(start, end) + '\nfmtCompact', {});
const cases = [
  [9850, '$9,850'],
  [57097, '$57.1k'],
  [1250000, '$1.25M'],
  [3400000000, '$3.4B'],
  [-1200000, '-$1.2M']
];
for (const [input, expected] of cases) {
  assert.equal(fmtCompact(input), expected, String(input));
}
assert.equal(fmtCompact(570000), '$570k');
assert.equal(fmtCompact(1000000000000), '$1T');
console.log('PASS fmtCompact', cases.map(([n]) => n).join(', '));
