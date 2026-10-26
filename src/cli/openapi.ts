import { createApp } from "../bootstrap/createApp.ts";
import { closeDatabase } from "../bootstrap/database.ts";

let app: Awaited<ReturnType<typeof createApp>> | undefined;
async function bootstrap() {
  app = await createApp({ migrate: false });
  return app;
}
async function close() {
  try { await app?.context.dispose(); } finally { app = undefined; await closeDatabase(); }
}

async function openapiGenerateCommand(): Promise<void> {
  const { createOpenApiGenerateCommand } = await import("@getstrata/cli/openapi");
  await createOpenApiGenerateCommand(bootstrap, close)();
}

async function openapiValidateCommand(): Promise<void> {
  const { createOpenApiValidateCommand } = await import("@getstrata/cli/openapi");
  await createOpenApiValidateCommand(bootstrap, close)();
}

async function openapiCheckCommand(): Promise<void> {
  const { createOpenApiCheckCommand } = await import("@getstrata/cli/openapi");
  await createOpenApiCheckCommand(bootstrap, close)();
}

export { openapiCheckCommand, openapiGenerateCommand, openapiValidateCommand };
