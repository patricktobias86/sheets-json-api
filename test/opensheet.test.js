import test, { mock } from 'node:test';
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

test('serves repeated requests from local cache within 60 seconds', async () => {
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

  // Second request for the same spreadsheet ID is still < 60s old.
  const second = await handler(req, context);
  const secondData = await second.json();
  assert.deepStrictEqual(secondData, [{ name: 'Ada' }]);
  assert.strictEqual(requests.length, 2); // no additional Google API calls

  globalThis.fetch = originalFetch;
});

test('shares one cached sheet across different ranges of the same spreadsheet', async () => {
  // No edge Cache API — only the local in-memory cache.
  delete globalThis.caches;

  const spreadsheetId = '1vIoWMf607RDAVaJ0HjFyAN9JyTg_NV9MV_9AChjbfZM';
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    requests.push(url);
    // Return the FULL sheet (columns A-D) as Google would for the bare range.
    return new Response(
      JSON.stringify({
        values: [
          ['name', 'age', 'city'],
          ['Ada', '36', 'London'],
          ['Grace', '41', 'NYC'],
        ],
      })
    );
  };

  const base = `https://example.com/${spreadsheetId}/VZVODA`;
  const reqB = new Request(`${base}!A:B`);
  const first = await handler(reqB, context);
  assert.deepStrictEqual(await first.json(), [
    { name: 'Ada', age: '36' },
    { name: 'Grace', age: '41' },
  ]);
  assert.strictEqual(requests.length, 1); // full sheet fetched once

  // A different range of the same sheet should reuse the cached full sheet
  // (columns A, B and C) without any new Google API call.
  const reqC = new Request(`${base}!A:C`);
  const secondC = await handler(reqC, context);
  assert.deepStrictEqual(await secondC.json(), [
    { name: 'Ada', age: '36', city: 'London' },
    { name: 'Grace', age: '41', city: 'NYC' },
  ]);
  assert.strictEqual(requests.length, 1); // still no additional Google API calls

  globalThis.fetch = originalFetch;
});
test('expires the cache after 60 seconds without any request', async () => {
  mock.timers.enable({ apis: ['Date'] });
  try {
    delete globalThis.caches;
    let calls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      calls++;
      return new Response(JSON.stringify({ values: [['name'], ['Ada']] }));
    };

    const url = 'https://example.com/expiry-sheet/Sheet1!A:B';
    mock.timers.setTime(1_000_000_000);

    // First request fetches the full sheet (cache miss).
    await handler(new Request(url), context);
    assert.strictEqual(calls, 1);

    // Same range at +15s: served from cache, no extra fetch.
    mock.timers.setTime(1_000_015_000);
    await handler(new Request(url), context);
    assert.strictEqual(calls, 1);

    // 61s after the last request (76s total): window expired, so it fetches.
    mock.timers.setTime(1_000_076_000);
    await handler(new Request(url), context);
    assert.strictEqual(calls, 2);

    globalThis.fetch = originalFetch;
  } finally {
    mock.timers.reset();
  }
});

test('keeps serving from cache while requests arrive within 60s', async () => {
  mock.timers.enable({ apis: ['Date'] });
  try {
    delete globalThis.caches;
    let calls = 0;
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      calls++;
      return new Response(JSON.stringify({ values: [['name'], ['Ada']] }));
    };

    const url = 'https://example.com/warm-sheet/Sheet1!A:B';
    mock.timers.setTime(1_000_000_000);

    await handler(new Request(url), context);
    assert.strictEqual(calls, 1);

    // A request every 30s keeps the sliding window alive, even though far
    // more than 60s elapse overall.
    for (const offset of [30, 60, 90, 120]) {
      mock.timers.setTime(1_000_000_000 + offset * 1000);
      await handler(new Request(url), context);
    }
    assert.strictEqual(calls, 1); // every request hit the cache, no refetch

    globalThis.fetch = originalFetch;
  } finally {
    mock.timers.reset();
  }
});
