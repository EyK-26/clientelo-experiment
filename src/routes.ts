import { buildModuleRoutes } from "@getstrata/bootstrap/buildModuleRoutes";
import { buildWebModuleRoutes } from "@getstrata/bootstrap/buildWebModuleRoutes";
import { isViewsEnabled } from "@getstrata/core/runtime/frontendMode";
import type { AppDependencies, AppRouteMap } from "@getstrata/bootstrap/contracts";

export function buildRoutes(dependencies: AppDependencies): AppRouteMap {
  const api = buildModuleRoutes(dependencies);
  return {
    ...api,
    ...(isViewsEnabled() ? buildWebModuleRoutes(dependencies, { clearRegistry: false }) : {}),
  };
}
