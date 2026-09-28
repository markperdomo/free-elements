import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { serve } from '../scripts/serve.mjs';

test('static server serves app files and never exposes installer, research, keys, or scripts', async () => {
  const server = http.createServer(serve);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const path of ['/', '/src/core/layout.js', '/manifest.xml', '/assets/icon-32.png']) {
      const response = await fetch(base + path); assert.equal(response.status, 200, path);
      assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    }
    for (const path of ['/installer.pkg', '/research/private.json', '/.certs/localhost.key', '/src/%2e%2e%2fscripts/serve.mjs', '/src/%2e%2e%2f%2e%2e%2fetc/passwd', '/scripts/serve.mjs']) {
      assert.equal((await fetch(base + path)).status, 404, path);
    }
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
