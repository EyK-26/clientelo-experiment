import type { StrataCommandMap } from "@getstrata/cli";

const commands: StrataCommandMap = {
  "worksheet:prune": async () =>
    (await import("./pruneWorksheet")).pruneWorksheetCommand,
  "make:module": async () =>
    (await import("@getstrata/cli/scaffold")).makeModuleCommand,
  "make:model": async () =>
    (await import("@getstrata/cli/scaffold")).makeModelCommand,
  "make:view": async () =>
    (await import("@getstrata/cli/scaffold")).makeViewCommand,
  "make:policy": async () =>
    (await import("@getstrata/cli/scaffold")).makePolicyCommand,
  "make:job": async () =>
    (await import("@getstrata/cli/scaffold")).makeJobCommand,
  "make:listener": async () =>
    (await import("@getstrata/cli/scaffold")).makeListenerCommand,
  "make:request": async () =>
    (await import("@getstrata/cli/scaffold")).makeRequestCommand,
  "make:factory": async () =>
    (await import("@getstrata/cli/scaffold")).makeFactoryCommand,
  "make:migration": async () =>
    (await import("@getstrata/cli/scaffold")).makeMigrationCommand,
};

export { commands };
