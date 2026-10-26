import { expect, test } from "bun:test";
import { worksheetFixture } from "../support/worksheet";

test("restricted role verifies worksheet grants and actual rolled-back ORM operations", async () => {
  const fixture = await worksheetFixture();
  try {
    const child = Bun.spawnSync([process.execPath, "tests/support/privileges.ts"], {
      env: { PATH: process.env.PATH!, DATABASE_URL: process.env.DATABASE_URL! },
      stdout: "pipe", stderr: "pipe",
    });
    expect(child.stderr.toString()).toBe("");
    expect(child.exitCode).toBe(0);
    const report = JSON.parse(child.stdout.toString());
    expect(report.worksheet_tables).toEqual([
      "worksheet_contact", "worksheet_event", "worksheet_journey_event",
    ]);
    expect(report.orm_acceptance_resource_and_duplicates).toBe(true);
    expect(report.probe_records_rolled_back).toBe(true);
    expect(report.actual_create_delete_truncate_denied).toBe("42501");
  } finally {
    await fixture.close();
  }
});
