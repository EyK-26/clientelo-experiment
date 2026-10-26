import { isProductionEnv } from "@getstrata/core/runtime/appEnv";
import { freshDatabase, loadMigrationsFromDirectory } from "@getstrata/core/database/migrations";
import { withDeploymentDatabase } from "./deploy";

export async function fresh() {
  if (isProductionEnv())
    throw new Error("migrate:fresh is only available in development/test environments.");
  for (const value of [process.env.DATABASE_URL, process.env.MIGRATION_DATABASE_URL]) {
    let url: URL;
    try { url = new URL(value!); }
    catch { throw new Error("Fresh reset requires the owned local test database."); }
    if (
      !["127.0.0.1", "localhost"].includes(url.hostname) ||
      url.pathname !== "/clientelo_native_test"
    ) throw new Error("Fresh reset requires the owned local test database.");
  }
  await withDeploymentDatabase(async db => {
    await freshDatabase(db, await loadMigrationsFromDirectory(`${import.meta.dir}/migrations`), {
      destructive: true,
    });
  });
}

if (import.meta.main) {
  await fresh();
  console.log("Owned local test database reset through native migrations.");
}
