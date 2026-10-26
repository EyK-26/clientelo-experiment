import { test, expect } from "bun:test";
import {
  attribution,
  controlledWorksheetEnabled,
} from "../../src/modules/worksheet/measurement";
const valid = {
  APP_ENV: "test",
  WORKSHEET_CONTROLLED_TESTS: "1",
  APP_URL: "https://native.clientelo.test",
  DATABASE_URL: "postgres://runtime:synthetic@localhost/clientelo_native_test",
};
test("contact gate is absent by default and cannot be enabled in production", () => {
  expect(controlledWorksheetEnabled({})).toBe(false);
  expect(() =>
    controlledWorksheetEnabled({ ...valid, APP_ENV: "production" }),
  ).toThrow("controlled");
  expect(() =>
    controlledWorksheetEnabled({
      ...valid,
      DATABASE_URL: "postgres://runtime:synthetic@localhost/clientelo_native",
    }),
  ).toThrow("controlled");
  expect(controlledWorksheetEnabled(valid)).toBe(true);
});
test("only complete known ad tags enter controlled attribution", () => {
  expect(
    attribution(
      new URLSearchParams(
        "utm_source=demo&utm_medium=ad&utm_campaign=etf_compare&ad_variant=a",
      ),
    ),
  ).toBe("a");
  expect(
    attribution(
      new URLSearchParams(
        "utm_source=demo&utm_medium=ad&utm_campaign=etf_compare&ad_variant=b",
      ),
    ),
  ).toBe("b");
  for (const query of [
    "",
    "ad_variant=a",
    "utm_source=person%40example.test&utm_medium=ad&utm_campaign=etf_compare&ad_variant=a",
    "utm_source=demo&utm_source=private&utm_medium=ad&utm_campaign=etf_compare&ad_variant=a",
    "utm_source=demo&utm_medium=ad&utm_campaign=etf_compare&ad_variant=a&ad_variant=b",
  ])
    expect(attribution(new URLSearchParams(query))).toBeNull();
});

import { WorksheetContactRequest } from "../../src/modules/worksheet/submission";
test("native controlled validation retains invalid scalar and rejects files, repeats and real addresses", () => {
  const request = new WorksheetContactRequest();
  expect(() => request.validatePayload({ email: ["not-an-email"] })).toThrow();
  expect(request.previousEmail).toBe("not-an-email");
  for (const email of [
    [],
    ["a@example.test", "b@example.test"],
    [new File(["x"], "mail.txt")],
    ["person@gmail.com"],
  ])
    expect(() =>
      new WorksheetContactRequest().validatePayload({ email }),
    ).toThrow();
  expect(
    new WorksheetContactRequest().validatePayload({
      email: ["  FIXTURE@example.test  "],
    }),
  ).toEqual({ email: "fixture@example.test" });
});

test("controlled browser harness permits only its fixed loopback origin", () => {
  expect(
    controlledWorksheetEnabled({ ...valid, APP_URL: "http://127.0.0.1:4335" }),
  ).toBe(true);
  expect(() =>
    controlledWorksheetEnabled({
      ...valid,
      APP_URL: "http://public.example.test",
    }),
  ).toThrow("controlled");
});

test("controlled addresses reject invalid local-part boundaries before persistence", () => {
  for (const local of [".fixture", "fixture.", "two..dots", "a".repeat(65)]) {
    expect(() =>
      new WorksheetContactRequest().validatePayload({
        email: [`${local}@example.test`],
      }),
    ).toThrow();
  }
});

test("public request validates one real-shaped email while qualification remains synthetic-only", () => {
  expect(
    new WorksheetContactRequest("public").validatePayload({
      email: ["  READER+Sheet@example.org "],
    }),
  ).toEqual({ email: "reader+sheet@example.org" });
  for (const email of [
    ["a@example.org", "a@example.org"],
    [new File(["x"], "a.txt")],
    ["a..b@example.org"],
    [".a@example.org"],
    ["a@-example.org"],
    ["x".repeat(65) + "@example.org"],
  ]) {
    expect(() =>
      new WorksheetContactRequest("public").validatePayload({ email }),
    ).toThrow();
  }
  expect(() =>
    new WorksheetContactRequest().validatePayload({
      email: ["reader@example.org"],
    }),
  ).toThrow();
});
