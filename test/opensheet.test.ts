import test from 'node:test';
import assert from 'node:assert';
import handler from '../netlify/edge-functions/opensheet';

const context = { waitUntil: () => {} } as any;

test('returns rows from Google Sheet', async () => {
  (globalThis as any).caches = {
    default: {
      async match() {
        return undefined;
      },
      async put() {
        // no-op
      },
    },
  };

  const req = new Request('https://example.com/1vufOODlks7O9PGak54hMNP4LWBUAoP-XB9n3VW_aw5Y/1');
  const res = await handler(req, context);
  const data = await res.json();
  assert(Array.isArray(data));
  assert.ok(data.length > 0);
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
