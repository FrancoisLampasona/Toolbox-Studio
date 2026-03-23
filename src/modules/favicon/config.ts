import type { ModuleConfig } from "../optimize/config";

export const faviconModule: ModuleConfig = {
  id: "favicon",
  name: "Favicon Generator",
  route: "/favicon",
  enabled: true,
  priority: 3,
  description: "Pacchetto favicon, manifest e snippet head pronti",
  icon: "F",
  category: "Web Workflow",
  statusLabel: "Beta",
  badge: "Nuovo",
  highlights: ["ICO", "Manifest", "Apple", "Snippet"],
};
