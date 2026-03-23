export { HomeDashboard } from "./HomeDashboard";
export type { AppSettings, HomeDashboardProps, ShellSessionState } from "./types";
export {
  getBackRoute,
  getInitialShellRoute,
  getModuleRouteFromPath,
  getPreferredModuleRoute,
  normalizeShellRoute,
  shellRoutes,
} from "./routes";

export {
  getDefaultModule,
  getEnabledModules,
  getModuleById,
  getModuleByRoute,
  moduleRegistry,
} from "../modules/registry";

