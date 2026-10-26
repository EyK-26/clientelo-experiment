import { createQueueFailedCommands } from "@getstrata/cli/queueFailed";
import { bootstrapApp } from "../bootstrap/createApp.ts";
import { closeDatabase } from "../bootstrap/database.ts";

let app: Awaited<ReturnType<typeof bootstrapApp>> | undefined;
const { queueFailedCommand, queueFlushFailedCommand, queueRetryCommand } = createQueueFailedCommands(
  async () => { app = await bootstrapApp({ migrate: false }); },
  async () => { try { await app?.context.dispose(); } finally { app = undefined; await closeDatabase(); } },
);

export { queueFailedCommand, queueFlushFailedCommand, queueRetryCommand };
