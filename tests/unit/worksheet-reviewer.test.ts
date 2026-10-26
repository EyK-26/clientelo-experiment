import { test, expect } from "bun:test";
import { worksheetRuntime } from "../../src/modules/worksheet/runtime";

const render = {
  APP_PROFILE: "worksheet-qualification",
  APP_ENV: "production",
  RENDER: "true",
  RENDER_EXTERNAL_URL: "https://clientelo-experiment.onrender.com",
  APP_URL: "https://clientelo-experiment.onrender.com",
  CSRF_TARGET_ORIGIN: "https://clientelo-experiment.onrender.com",
  WORKSHEET_CONTROLLED_TESTS: "1",
  WORKSHEET_PUBLIC_COLLECTION: "0",
  DATABASE_URL:
    "postgres://clientelo_native_app:synthetic@fixture-pooler.neon.tech/clientelo_native",
};

test("the existing Render service can admit the synthetic reviewer journey", () => {
  expect(worksheetRuntime(render).mode).toBe("qualification");
});

test("Render reviewer admission preserves origin, platform and database restrictions", () => {
  for (const change of [
    { RENDER: "" },
    { RENDER_EXTERNAL_URL: "https://other.onrender.com" },
    {
      APP_URL: "https://other.onrender.com",
      CSRF_TARGET_ORIGIN: "https://other.onrender.com",
      RENDER_EXTERNAL_URL: "https://other.onrender.com",
    },
    { CSRF_TARGET_ORIGIN: "https://other.onrender.com" },
    {
      DATABASE_URL: "postgres://owner:synthetic@fixture.neon.tech/clientelo_native",
    },
    {
      DATABASE_URL:
        "postgres://clientelo_native_app:synthetic@localhost/clientelo_native",
    },
    { WORKSHEET_PUBLIC_COLLECTION: "1" },
  ])
    expect(() => worksheetRuntime({ ...render, ...change })).toThrow();
  for (const key of [
    "MIGRATION_DATABASE_URL",
    "RETENTION_DATABASE_URL",
    "RENDER_API_KEY",
    "RESEND_API_KEY",
  ])
    expect(() => worksheetRuntime({ ...render, [key]: "forbidden" })).toThrow();
});
