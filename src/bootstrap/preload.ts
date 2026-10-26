import { join } from "node:path";
import { configureModulesDirectory } from "@getstrata/bootstrap/discoverModules";
import { isProductionEnv } from "@getstrata/core/runtime/appEnv";
import "../models/register.ts";

if (!isProductionEnv()) {
  process.env.DATABASE_URL ??= "postgresql://strata_app:dev-strata-app-change-me@localhost:5432/deployment_experiment_native";
  process.env.MIGRATION_DATABASE_URL ??= "postgresql://postgres:dev-postgres-change-me@localhost:5432/deployment_experiment_native";
}
process.env.FRONTEND_MODE ??= "server-htmx";
process.env.SPA_PREFIX ??= "/app";
process.env.CACHE_DRIVER ??= "array";
process.env.QUEUE_DRIVER ??= "sync";
process.env.MAIL_DRIVER ??= "smtp";
process.env.TENANCY_DRIVER ??= "none";
configureModulesDirectory(join(import.meta.dir, "../modules"));
