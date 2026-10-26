import { test, expect } from "bun:test";
import { appProfile } from "../../src/bootstrap/appProfile";
import { controlledWorksheetEnabled } from "../../src/modules/worksheet/measurement";
const hosted = {
  APP_PROFILE: "worksheet-qualification",
  APP_ENV: "production",
  RENDER: "true",
  RENDER_EXTERNAL_URL: "https://clientelo-experiment.onrender.com",
  WORKSHEET_CONTROLLED_TESTS: "1",
  APP_URL: "https://clientelo-experiment.onrender.com",
  CSRF_TARGET_ORIGIN: "https://clientelo-experiment.onrender.com",
  DATABASE_URL:
    "postgres://clientelo_native_app:synthetic@fixture-pooler.eu-central-1.aws.neon.tech/clientelo_native",
};
test("normal product startup defaults to a mail-free, closed collection profile", () => {
  expect(appProfile({})).toBe("worksheet-product");
  expect(controlledWorksheetEnabled({})).toBe(false);
});
test("qualification selects only the supported worksheet profile", () => {
  expect(appProfile(hosted)).toBe("worksheet-qualification");
  expect(() => appProfile({ APP_PROFILE: "typo" })).toThrow();
});
test("Render admission follows its actual platform URL after a display-name rename", () => {
  const origin = "https://clientelo-experiment.onrender.com";
  expect(controlledWorksheetEnabled({
    ...hosted, APP_URL: origin, CSRF_TARGET_ORIGIN: origin, RENDER_EXTERNAL_URL: origin,
  })).toBe(true);
  expect(() => controlledWorksheetEnabled({
    ...hosted, RENDER_EXTERNAL_URL: "https://other.onrender.com",
  })).toThrow();
});
test("retired experiment profile is rejected instead of reopening the email application", () => {
  expect(() => appProfile({ APP_PROFILE: "experiment" })).toThrow(
    "Unknown application profile",
  );
});
test("hosted synthetic mode requires explicit profile, exact HTTPS origin and existing restricted identity", () => {
  expect(controlledWorksheetEnabled(hosted)).toBe(true);
  for (const change of [
    { APP_PROFILE: "experiment" },
    { RENDER: "false" },
    { CSRF_TARGET_ORIGIN: "https://other.example.test" },
    { APP_URL: "http://clientelo-experiment.onrender.com" },
    {
      DATABASE_URL: hosted.DATABASE_URL.replace(
        "clientelo_native_app:",
        "owner:",
      ),
    },
    {
      DATABASE_URL: hosted.DATABASE_URL.replace("/clientelo_native", "/other"),
    },
    { MIGRATION_DATABASE_URL: "forbidden" },
    { RESEND_API_KEY: "forbidden" },
  ])
    expect(() =>
      controlledWorksheetEnabled({ ...hosted, ...change }),
    ).toThrow();
});
