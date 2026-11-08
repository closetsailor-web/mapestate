import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import http from 'node:http';
import assert from 'node:assert/strict';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const here = dirname(fileURLToPath(import.meta.url));
const serverScript = resolve(here, 'server.py');

const fakeKey = 'maptiler-browser-test-key';
const ownership = '/tmp/overture-ownership-should-not-exist.json';
const port = 8768;

function request(targetPort, method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({hostname: '127.0.0.1', port: targetPort, path, method, headers}, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8')}));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const server = spawn('python3', [serverScript, '--port', String(port)], {
  cwd: here,
  env: {...process.env, MAPTILER_TEST_API_KEY: fakeKey, OVERTURE_OWNERSHIP_FILE: ownership},
  stdio: 'ignore'
});
const blankServer = spawn('python3', [serverScript, '--port', '8769'], {
  cwd: here,
  env: {...process.env, MAPTILER_TEST_API_KEY: ''},
  stdio: 'ignore'
});

try {
  let up = false;
  for (let i = 0; i < 40; i++) {
    try {
      await request(port, 'GET', '/', {Host: `127.0.0.1:${port}`});
      up = true;
      break;
    } catch {
      await delay(100);
    }
  }
  if (!up) throw new Error('server did not start');
  const same = {Host: `127.0.0.1:${port}`, Origin: `http://127.0.0.1:${port}`, 'Sec-Fetch-Site': 'same-origin'};
  const config = await request(port, 'GET', '/runtime-config', same);
  assert.equal(config.status, 200);
  assert.deepEqual(JSON.parse(config.body), {key: fakeKey});
  assert.equal('access-control-allow-origin' in config.headers, false);
  let blankBody = '';
  for (let i = 0; i < 30; i++) {
    try {
      const blank = await request(8769, 'GET', '/runtime-config', {Host: '127.0.0.1:8769', Origin: 'http://127.0.0.1:8769', 'Sec-Fetch-Site': 'same-origin'});
      blankBody = blank.body;
      break;
    } catch {
      await delay(100);
    }
  }
  assert.deepEqual(JSON.parse(blankBody), {key: ''});
  const foreign = await request(port, 'GET', '/runtime-config', {...same, Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site'});
  assert.equal(foreign.status, 403);
  assert.equal(foreign.body.includes(fakeKey), false);
  assert.equal((await request(port, 'GET', '/runtime-config', {...same, Origin: 'null'})).status, 403);
  assert.equal((await request(port, 'GET', '/runtime-config', {...same, Host: 'rebind.example'})).status, 403);
  assert.equal((await request(port, 'GET', '/runtime-config', {...same, Host: '127.0.0.1:1', Origin: 'http://127.0.0.1:1'})).status, 403);
  assert.equal((await request(port, 'GET', '/runtime-config', {...same, Referer: 'https://evil.example/'})).status, 403);
  const form = await request(port, 'POST', '/api/claim', {
    Host: `127.0.0.1:${port}`,
    Origin: 'https://evil.example',
    'Content-Type': 'application/x-www-form-urlencoded',
    Referer: 'https://evil.example/'
  }, 'gameId=ypb-1&playerId=thief&role=owner');
  assert.equal(form.status, 403);
  const samePost = await request(port, 'POST', '/api/claim', {...same, 'Content-Type': 'application/json'}, JSON.stringify({gameId: 'ypb-1', playerId: 'local', role: 'owner'}));
  assert.equal(samePost.status, 404);
  assert.equal(existsSync(ownership), false);
  for (const path of ['/source/bundaberg-buildings.geojson', '/../private/api-key.txt', '/data/../../server.py', '/private/api-key.txt']) {
    const denied = await request(port, 'GET', path, same);
    assert.notEqual(denied.status, 200, path);
    assert.equal(denied.body.includes(fakeKey), false);
  }
  const chunk = await request(port, 'GET', '/data/chunks/3033_-496.json', same);
  assert.equal(chunk.status, 200);
  assert.equal(chunk.body.includes(fakeKey), false);
  const chunkEscape = await request(port, 'GET', '/data/chunks/../registry-v1.json', same);
  assert.notEqual(chunkEscape.status, 200);
  const pricing = await request(port, 'GET', '/data/pricing-v1.json', same);
  assert.equal(pricing.status, 200);
  assert.equal(pricing.body.includes(fakeKey), false);
  assert.equal(pricing.body.includes('pending-review'), true);
  const page = await request(port, 'GET', '/', {Host: `127.0.0.1:${port}`});
  assert.equal(page.status, 200);
  assert.equal(page.body.includes('Overture building preview'), true);
  console.log(JSON.stringify({config: 'same-origin-only', blank: true, claims: 'disabled', traversal: 'denied'}));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  blankServer.kill('SIGTERM');
}
