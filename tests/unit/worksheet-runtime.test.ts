import { test, expect } from "bun:test";
import { worksheetRuntime } from "../../src/modules/worksheet/runtime";
const local = {
  APP_PROFILE: "worksheet-qualification",
  APP_ENV: "test",
  WORKSHEET_CONTROLLED_TESTS: "1",
  APP_URL: "http://127.0.0.1:4335",
  CSRF_TARGET_ORIGIN: "http://127.0.0.1:4335",
  DATABASE_URL: "postgres://fixture:synthetic@localhost/clientelo_native_test",
};
test("product routes are closed by default and qualification admits only guarded test runtimes", () => {
  expect(worksheetRuntime({}).mode).toBe("disabled");
  expect(worksheetRuntime(local).mode).toBe("qualification");
  expect(() =>
    worksheetRuntime({ ...local, APP_URL: "http://untrusted.example.org" }),
  ).toThrow();
  expect(() => worksheetRuntime({ ...local, APP_ENV: "production" })).toThrow();
});
test("real collection fails closed without reviewed identity, purpose, legal basis and deletion operation", () => {
  const publicEnv = {
    APP_PROFILE: "worksheet-product",
    APP_ENV: "production",
    APP_URL: "https://demo.example.org",
    CSRF_TARGET_ORIGIN: "https://demo.example.org",
    DATABASE_URL:
      "postgres://clientelo_native_app:synthetic@fixture.neon.tech/clientelo_native",
    WORKSHEET_PUBLIC_COLLECTION: "1",
  };
  expect(() => worksheetRuntime(publicEnv)).toThrow();
  const notice = {
    operator: "Synthetic fixture operator",
    privacyContact: "privacy@example.test",
    purpose: "Record demo requests only",
    access: "Operator only",
    retention: "Seven days",
    deletionOwner: "Synthetic fixture operator",
    legalBasis: "Fixture approval, not a real legal determination",
  };
  const reviewed = {
    ...publicEnv,
    WORKSHEET_RELEASE_APPROVED: "1",
    WORKSHEET_RETENTION_VERIFIED: "1",
    PRIVACY_NOTICE_JSON: JSON.stringify(notice),
  };
  expect(worksheetRuntime(reviewed).mode).toBe("public");
  for (const key of [
    "WORKSHEET_RELEASE_APPROVED",
    "WORKSHEET_RETENTION_VERIFIED",
    "PRIVACY_NOTICE_JSON",
  ])
    expect(() => worksheetRuntime({ ...reviewed, [key]: "" })).toThrow();
  expect(() =>
    worksheetRuntime({ ...reviewed, MIGRATION_DATABASE_URL: "forbidden" }),
  ).toThrow();
  expect(() =>
    worksheetRuntime({ ...reviewed, RETENTION_DATABASE_URL: "forbidden" }),
  ).toThrow();
});

test("hosted synthetic qualification rejects deletion credentials too", () => {
  expect(() =>
    worksheetRuntime({
      APP_PROFILE: "worksheet-qualification",
      APP_ENV: "production",
      RENDER: "true",
      RENDER_EXTERNAL_URL: "https://clientelo-experiment.onrender.com",
      APP_URL: "https://clientelo-experiment.onrender.com",
      CSRF_TARGET_ORIGIN: "https://clientelo-experiment.onrender.com",
      DATABASE_URL:
        "postgres://clientelo_native_app:synthetic@fixture.neon.tech/clientelo_native",
      WORKSHEET_CONTROLLED_TESTS: "1",
      RETENTION_DATABASE_URL: "forbidden",
    }),
  ).toThrow();
});

test("the public contact request displays its reviewed legal-basis explanation", async () => {
  const { ViewRenderer, EtaViewEngine } = await import("@getstrata/core/view");
  const views = new ViewRenderer(
    new EtaViewEngine(import.meta.dir + "/../../views"),
    "layouts/etf-content.eta",
  );
  const legalBasis = "Synthetic legal-basis explanation only; not approval.";
  const response = await views.render("worksheet/contact.eta", {
    qualification: false,
    resource: "",
    email: "",
    error: "",
    action: "/etf",
    csrfToken: "synthetic-form-value",
    layout: { title: "Synthetic disclosure", description: "Test fixture only" },
    notice: {
      operator: "Synthetic fixture operator",
      privacyContact: "privacy@example.test",
      purpose: "Record demonstration requests only",
      access: "Operator only",
      retention: "Seven days",
      deletionOwner: "Synthetic fixture operator",
      legalBasis,
    },
  });
  const html = await response.text();
  expect(html).toContain(legalBasis);
  expect(html).toContain("Žádný newsletter ani e-mail neposíláme.");
});
