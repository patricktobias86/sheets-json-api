import test from 'node:test';
import assert from 'node:assert';

test('fetches json from deployed API', async () => {
  const res = await fetch('https://sheets-json-api.netlify.app/1vufOODlks7O9PGak54hMNP4LWBUAoP-XB9n3VW_aw5Y/1');
  const data = await res.json();
  assert.deepStrictEqual(data, [{ headline: "It's working!" }]);
});
