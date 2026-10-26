import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

const server = fileURLToPath(new URL("../../src/bootstrap/server.ts", import.meta.url));
// Separate processes keep mock modules isolated from the real DB/app test suite.
for (const scenario of ["clean", "provider", "database", "both"] as const) {
  test(`server bind failure preserves its cause when cleanup is ${scenario}`, () => {
    const result = Bun.spawnSync([process.execPath, "--eval", `
      import { mock } from "bun:test";
      import { strict as assert } from "node:assert";
      import { pathToFileURL } from "node:url";
      const server = pathToFileURL(process.env.STARTUP_TEST_SERVER);
      const scenario = process.env.STARTUP_TEST_SCENARIO;
      const startup = new Error("bind failed");
      const provider = new Error("provider cleanup failed");
      const database = new Error("database cleanup failed");
      const calls = [];
      mock.module(new URL("./preload.ts", server).pathname, () => ({}));
      mock.module("@getstrata/core/lifecycle/gracefulShutdown", () => ({
        LifecycleCoordinator: class {}, installGracefulShutdownSignals() {},
      }));
      mock.module(new URL("./createApp.ts", server).pathname, () => ({
        bootstrapApp: async options => {
          assert.deepEqual(options, { migrate: false });
          return { routes: {}, config: { port: 0 }, context: { dispose: async () => {
            calls.push("provider");
            if (["provider", "both"].includes(scenario)) throw provider;
          } } };
        },
        createAppServer: () => { throw startup; },
      }));
      mock.module(new URL("./database.ts", server).pathname, () => ({ closeDatabase: async () => {
        calls.push("database");
        if (["database", "both"].includes(scenario)) throw database;
      } }));
      let caught;
      try { await import(server.href); } catch (error) { caught = error; }
      assert.deepEqual(calls, ["provider", "database"], "both cleanup steps must run in order");
      if (scenario === "clean") assert.equal(caught, startup, "preserve original error identity");
      else {
        assert.ok(caught instanceof AggregateError, "startup and cleanup failures must be aggregated");
        assert.equal(caught.cause, startup, "original bind failure must remain the cause");
        const expected = [startup];
        if (["provider", "both"].includes(scenario)) expected.push(provider);
        if (["database", "both"].includes(scenario)) expected.push(database);
        assert.deepEqual(caught.errors, expected, "retain every failure in cleanup order");
      }
    `], {
      cwd: fileURLToPath(new URL("../..", import.meta.url)),
      env: { PATH: process.env.PATH!, STARTUP_TEST_SERVER: server, STARTUP_TEST_SCENARIO: scenario },
      stdout: "pipe", stderr: "pipe",
    });
    expect(result.stderr.toString()).toBe("");
    expect(result.exitCode).toBe(0);
  });
}
