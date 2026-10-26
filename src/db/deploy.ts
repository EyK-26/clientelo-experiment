// Explicit schema-only operator entrypoint. Never import from HTTP startup.
import { SQL } from "bun";
import { loadMigrationsFromDirectory, migrateDatabase } from "@getstrata/core/database/migrations";
import type { MigrationDatabase } from "@getstrata/core/database/migrations/types";
import { quoteIdentifier } from "@getstrata/core/database/query";

export async function applyRuntimeGrants(db: MigrationDatabase, role: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(role)) throw new Error("Invalid runtime role name.");
  const identifier = quoteIdentifier(role);
  // Authorization SQL is application policy, not schema/ORM emulation.
  await db.unsafe(`REVOKE CREATE ON SCHEMA public FROM PUBLIC, ${identifier}`);
  await db.unsafe(`GRANT USAGE ON SCHEMA public TO ${identifier}`);
  await db.unsafe(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${identifier}`);
  await db.unsafe(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${identifier}`);
  await db.unsafe(
    `GRANT SELECT,INSERT,UPDATE ON worksheet_contact,worksheet_event,worksheet_journey_event TO ${identifier}`,
  );
}

export async function withDeploymentDatabase<T>(fn: (db: MigrationDatabase) => Promise<T>): Promise<T> {
  const ownerUrl = process.env.MIGRATION_DATABASE_URL;
  const runtimeUrl = process.env.DATABASE_URL;
  if (!ownerUrl || !runtimeUrl) throw new Error("Separate migration/runtime URLs required.");
  const owner = new URL(ownerUrl), runtime = new URL(runtimeUrl);
  const directHost = (host: string) => host.replace("-pooler.", ".");
  if (
    !["postgres:", "postgresql:"].includes(owner.protocol) ||
    !["postgres:", "postgresql:"].includes(runtime.protocol) ||
    owner.pathname !== runtime.pathname ||
    directHost(owner.hostname) !== directHost(runtime.hostname) ||
    owner.port !== runtime.port ||
    decodeURIComponent(owner.username) === decodeURIComponent(runtime.username)
  ) throw new Error("Separate identities in the same database required.");
  const role = decodeURIComponent(runtime.username);
  if (!/^[a-z_][a-z0-9_]*$/.test(role)) throw new Error("Invalid runtime role name.");
  const db = new SQL({ url: ownerUrl, max: 1 });
  try {
    const result = await fn(db);
    await applyRuntimeGrants(db, role);
    return result;
  } finally {
    await db.close();
  }
}

export async function migrate() {
  await withDeploymentDatabase(async db => {
    await migrateDatabase(db, await loadMigrationsFromDirectory(`${import.meta.dir}/migrations`));
  });
  console.log(JSON.stringify({ schema_only_migration: true, provisioning: false, narrow_grants: true }));
}
if (import.meta.main) await migrate();
