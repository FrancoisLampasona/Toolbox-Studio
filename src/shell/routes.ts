import { getDefaultModule, getModuleById, getModuleByRoute } from "../modules/registry";

export const shellRoutes = {
  home: "/",
  optimize: "/optimize",
  wordpress: "/wordpress",
  srcset: "/srcset",
  favicon: "/favicon",
} as const;

export type ShellRoute = (typeof shellRoutes)[keyof typeof shellRoutes];

export type ShellLocationLike = {
  pathname?: string;
};

function stripTrailingSlash(pathname: string): string {
  if (pathname.length <= 1) {
    return pathname;
  }

  return pathname.replace(/\/+$/, "");
}

export function normalizeShellRoute(pathname: string): ShellRoute {
  const normalizedPath = stripTrailingSlash(pathname);

  if (normalizedPath === shellRoutes.optimize) {
    return shellRoutes.optimize;
  }

  if (normalizedPath === shellRoutes.wordpress) {
    return shellRoutes.wordpress;
  }

  if (normalizedPath === shellRoutes.srcset) {
    return shellRoutes.srcset;
  }

  if (normalizedPath === shellRoutes.favicon) {
    return shellRoutes.favicon;
  }

  return shellRoutes.home;
}

export function getModuleRouteFromPath(pathname: string): string | null {
  const module = getModuleByRoute(normalizeShellRoute(pathname));
  return module?.route ?? null;
}

export function getInitialShellRoute(location: ShellLocationLike | undefined): ShellRoute {
  const pathname = location?.pathname ?? shellRoutes.home;
  return normalizeShellRoute(pathname);
}

export function getBackRoute(currentRoute: ShellRoute): ShellRoute {
  return currentRoute === shellRoutes.optimize ||
    currentRoute === shellRoutes.wordpress ||
    currentRoute === shellRoutes.srcset ||
    currentRoute === shellRoutes.favicon
    ? shellRoutes.home
    : shellRoutes.home;
}

export function getPreferredModuleRoute(preferredModuleId?: string): string {
  if (!preferredModuleId) {
    return getDefaultModule().route;
  }

  return getModuleById(preferredModuleId)?.route ?? getDefaultModule().route;
}
