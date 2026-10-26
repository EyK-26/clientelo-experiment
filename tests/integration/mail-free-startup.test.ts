import { test, expect } from "bun:test";
import { worksheetFixture } from "../support/worksheet";

test("qualification starts through generated app without SMTP or Resend setup", async () => {
  const fixture = await worksheetFixture();
  try {
    const child = Bun.spawnSync(
      [process.execPath, "tests/support/mail-free-boot.ts"],
      {
        env: {
          PATH: process.env.PATH!,
          APP_PROFILE: "worksheet-qualification",
          APP_ENV: "production",
          APP_URL: "https://native.clientelo.test",
          CSRF_TARGET_ORIGIN: "https://native.clientelo.test",
          DATABASE_URL: process.env.DATABASE_URL!,
          SESSION_SECRET: process.env.SESSION_SECRET!,
          AUTH_DEV_HEADERS: "false",
          TENANT_DEV_HEADERS: "false",
          FEATURE_REGISTRATION: "false",
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    expect(child.stderr.toString()).toBe("");
    expect(child.exitCode).toBe(0);
  } finally {
    await fixture.close();
  }
});
