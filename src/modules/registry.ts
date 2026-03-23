import { faviconModule } from "./favicon/config";
import { optimizeModule, type ModuleConfig } from "./optimize/config";
import { srcsetModule } from "./srcset/config";
import { wordpressModule } from "./wordpress/config";

export const moduleRegistry: ModuleConfig[] = [
  optimizeModule,
  wordpressModule,
  srcsetModule,
  faviconModule,
];

export function getEnabledModules(): ModuleConfig[] {
  return moduleRegistry
    .filter((module) => module.enabled)
    .sort((a, b) => a.priority - b.priority);
}

export function getModuleById(moduleId: string): ModuleConfig | undefined {
  return moduleRegistry.find((module) => module.id === moduleId);
}

export function getModuleByRoute(route: string): ModuleConfig | undefined {
  return moduleRegistry.find((module) => module.route === route);
}

export function getDefaultModule(): ModuleConfig {
  return getEnabledModules()[0] ?? optimizeModule;
}
