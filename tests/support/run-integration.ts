import { readdir } from "node:fs/promises";
import { localTestUrl } from "./database";

for (const key of ["DATABASE_URL", "MIGRATION_DATABASE_URL", "RETENTION_DATABASE_URL"])
  localTestUrl(key);

const files = (await readdir(new URL("../integration/", import.meta.url)))
  .filter(file => file.endsWith(".test.ts")).sort();
for (const file of files) {
  // One process/fixture at a time; a failed check stops the suite.
  const child = Bun.spawn([process.execPath, "test", `./tests/integration/${file}`], {
    env: process.env, stdout: "inherit", stderr: "inherit",
  });
  const status = await child.exited;
  if (status !== 0) process.exit(status);
}
