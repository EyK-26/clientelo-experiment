import { CORE_AUTH_TOKEN } from "@getstrata/bootstrap/config";
import { createTokenAbilityChecker } from "@getstrata/core/auth/tokenAbilityChecker";
import { CORE_ABILITY_CHECKER_TOKEN } from "@getstrata/core/contracts/serviceTokens";
import { AuthManager, GuestGuard } from "@getstrata/core/auth/guard";
import type { ServiceProvider } from "@getstrata/core/contracts/di";
import { envFlagEnabled } from "@getstrata/core/runtime/appEnv";

const authProvider: ServiceProvider = {
  name: "starter.auth",
  register({ container }) {
    const guard = envFlagEnabled(process.env.AUTH_DEV_HEADERS)
      ? new GuestGuard()
      : { resolve: () => null };
    container.set(CORE_AUTH_TOKEN, new AuthManager(guard));
    container.set(CORE_ABILITY_CHECKER_TOKEN, createTokenAbilityChecker());
  },
};

export default authProvider;
