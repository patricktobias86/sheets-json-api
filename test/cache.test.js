import test from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";

test("reads CACHE_TTL_S as seconds", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", "import('./functions/cache.js').then(({ CACHE_TTL_SECONDS }) => console.log(CACHE_TTL_SECONDS))"],
    {
      cwd: process.cwd(),
      env: { ...process.env, CACHE_TTL_S: "120" },
      encoding: "utf8",
    }
  );

  assert.strictEqual(result.status, 0, result.stderr);
  assert.strictEqual(result.stdout.trim(), "120");
});
