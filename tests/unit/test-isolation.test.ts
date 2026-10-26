import { expect, test } from "bun:test";
import { localTestUrl } from "../support/database";

test("fixture admission rejects hosted or wrong-database URLs before a connection is opened", () => {
  const key = "CLIENTELO_ISOLATION_TEST_URL";
  const previous = process.env[key];
  try {
    for (const url of [
      "postgres://fixture:synthetic@fixture.neon.tech/clientelo_native_test",
      "postgres://fixture:synthetic@127.0.0.1/clientelo_native",
      "postgres://fixture:synthetic@localhost.example.org/clientelo_native_test",
      "https://localhost/clientelo_native_test",
      "invalid",
    ]) {
      process.env[key] = url;
      expect(() => localTestUrl(key)).toThrow();
    }
    for (const host of ["127.0.0.1", "localhost"]) {
      process.env[key] = `postgres://fixture:synthetic@${host}/clientelo_native_test`;
      expect(localTestUrl(key)).toBe(process.env[key]!);
    }
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
  }
});
