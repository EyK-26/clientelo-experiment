import { tracingProvider } from "@getstrata/bootstrap";
import { discoverListeners } from "@getstrata/bootstrap/discoverListeners";
import { registerInvalidateCacheOnModelWriteListeners } from "@getstrata/bootstrap/listeners/invalidateCacheOnModelWrite";
import type { ServiceProvider } from "@getstrata/core/contracts/di";
import authProvider from "./auth.ts";
import cacheProvider from "./cache.ts";
import configProvider from "./config.ts";
import policyProvider from "./policy.ts";
import queueProvider from "./queue.ts";
import storageProvider from "./storage.ts";
import viewProvider from "./view.ts";

const listenersProvider: ServiceProvider = {
  name: "starter.listeners",
  async boot({ onCleanup }) {
    onCleanup(registerInvalidateCacheOnModelWriteListeners());

    for (const registerListener of await discoverListeners()) {
      await registerListener();
    }
  },
};

const starterProviders: ServiceProvider[] = [
  configProvider,
  tracingProvider,
  cacheProvider,
  storageProvider,
  queueProvider,
  authProvider,
  viewProvider,
  policyProvider,
  listenersProvider,
];

export { starterProviders };
