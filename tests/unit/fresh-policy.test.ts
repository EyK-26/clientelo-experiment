import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

for (const [label, appEnv, url, expected] of [
  ["production", "production", "postgres://runtime:synthetic@127.0.0.1/clientelo_native_test", "development/test"],
  ["hosted database", "test", "postgres://runtime:synthetic@fixture.neon.tech/clientelo_native_test", "owned local"],
  ["wrong local database", "test", "postgres://runtime:synthetic@127.0.0.1/clientelo_native", "owned local"],
] as const) {
  test(`fresh rejects ${label} before provisioning or connecting`, () => {
    const child = Bun.spawnSync([process.execPath, "--eval", `
      import { mock } from "bun:test";
      import { strict as assert } from "node:assert";
      import { pathToFileURL } from "node:url";
      const target=pathToFileURL(process.env.FRESH_TEST_ENTRY);
      mock.module(new URL("../bootstrap/ensureDatabase.ts",target).pathname,()=>({
        ensureAppDatabase:async()=>{throw new Error("Provisioning helper must not run");},
      }));
      let failure;
      try { await (await import(target.href)).fresh(); } catch(error) { failure=error; }
      assert(failure instanceof Error);
      assert(failure.message.includes(process.env.FRESH_TEST_EXPECTED),failure.message);
    `], {
      env: {
        PATH: process.env.PATH!, APP_ENV: appEnv, DATABASE_URL: url,
        MIGRATION_DATABASE_URL: url.replace("runtime:", "owner:"),
        FRESH_TEST_ENTRY: fileURLToPath(new URL("../../src/db/fresh.ts", import.meta.url)),
        FRESH_TEST_EXPECTED: expected,
      },
      stdout: "pipe", stderr: "pipe",
    });
    expect(child.stderr.toString()).toBe("");
    expect(child.exitCode).toBe(0);
  });
}
