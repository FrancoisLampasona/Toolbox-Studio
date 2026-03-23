import type { ModuleConfig } from "../modules/optimize/config";
import type { AppSettings } from "../types";

export type { AppSettings };
export type HomeDropModulePathsHandler = (moduleId: string, paths: string[]) => void;

export interface ShellSessionState {
  activeRoute: string;
  preferredModuleId: string;
  lastVisitedModuleId: string;
}

export interface HomeDashboardProps {
  active?: boolean;
  modules: ModuleConfig[];
  activeModuleId?: string;
  defaultModuleId?: string;
  recentPaths?: string[];
  onOpenModule: (moduleId: string) => void;
  onDropModulePaths?: HomeDropModulePathsHandler;
  onOpenSettings?: () => void;
}
