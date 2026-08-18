import test from 'node:test';
import assert from 'node:assert';
import handler from '../functions/opensheet.js';
import { localClear } from '../functions/cache.js';

const context = { waitUntil: () => {} };

process.env.GOOGLE_API_KEY = 'FAKE_KEY';

// Keep the local in-memory cache isolated between tests.
test.beforeEach(() => {
  localClear();
});

test('returns rows from Google Sheet', async () => {
  globalThis.caches = {
    default: {
      async match() {
        return undefined;
      },
      async put() {
        // no-op
      },
    },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ values: [["name"], ["Ada"]] }));

  const req = new Request('https://example.com/test-sheet/Sheet1');
  const res = await handler(req, context);
  const data = await res.json();
  assert.deepStrictEqual(data, [{ name: 'Ada' }]);

  globalThis.fetch = originalFetch;
});

test('redirects to first sheet when sheet is missing', async () => {
  const req = new Request('https://example.com/1vufOODlks7O9PGak54hMNP4LWBUAoP-XB9n3VW_aw5Y');
  const res = await handler(req, context);
  assert.strictEqual(res.status, 302);
  assert.strictEqual(
    res.headers.get('Location'),
    'https://example.com/1vufOODlks7O9PGak54hMNP4LWBUAoP-XB9n3VW_aw5Y/1'
  );
});

test('falls back to static content on root path', async () => {
  const nextResponse = new Response('ok');
  const req = new Request('https://example.com/');
  const res = await handler(req, { next: () => nextResponse, waitUntil: () => {} });
  assert.strictEqual(res, nextResponse);
});

test('works when cache API is unavailable', async () => {
  delete globalThis.caches;

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ values: [["name"], ["Ada"]] }));

  const req = new Request('https://example.com/test-sheet/Sheet1');
  const res = await handler(req, context);
  const data = await res.json();
  assert.deepStrictEqual(data, [{ name: 'Ada' }]);

  globalThis.fetch = originalFetch;
});

test('uses Deno env when process env missing', async () => {
  const originalKey = process.env.GOOGLE_API_KEY;
  delete process.env.GOOGLE_API_KEY;

  globalThis.Deno = { env: { get: () => 'FAKE_KEY' } };
  globalThis.caches = {
    default: {
      async match() {
        return undefined;
      },
      async put() {},
    },
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ values: [["headline"], ["It's working!"]] })
    );

  const req = new Request('https://example.com/test-sheet/Sheet1');
  const res = await handler(req, context);
  const data = await res.json();
  assert.deepStrictEqual(data, [{ headline: "It's working!" }]);

  globalThis.fetch = originalFetch;
  delete globalThis.Deno;
  process.env.GOOGLE_API_KEY = originalKey;
});

test('serves repeated requests from local cache within 30 seconds', async () => {
  // No edge Cache API in this test — only the local in-memory cache.
  delete globalThis.caches;

  const spreadsheetId = 'spreadsheet123';
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    requests.push(url);
    if (String(url).includes('/values/')) {
      return new Response(JSON.stringify({ values: [['name'], ['Ada']] }));
    }
    // Metadata / spreadsheet document.
    return new Response(
      JSON.stringify({ sheets: [{ properties: { title: 'Sheet1' } }] })
    );
  };

  const req = new Request(`https://example.com/${spreadsheetId}/1`);
  const first = await handler(req, context);
  const firstData = await first.json();
  assert.deepStrictEqual(firstData, [{ name: 'Ada' }]);
  assert.strictEqual(requests.length, 2); // metadata + values fetched once

  // Second request for the same spreadsheet ID is still < 30s old.
  const second = await handler(req, context);
  const secondData = await second.json();
  assert.deepStrictEqual(secondData, [{ name: 'Ada' }]);
  assert.strictEqual(requests.length, 2); // no additional Google API calls

  globalThis.fetch = originalFetch;
});
