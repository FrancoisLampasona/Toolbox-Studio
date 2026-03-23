import type { ModuleConfig } from "../optimize/config";

export const socialModule: ModuleConfig = {
  id: "social",
  name: "Social Media Images",
  route: "/social",
  enabled: true,
  priority: 4,
  description: "Pack social, snippet meta e batch per i canali principali",
  icon: "S",
  category: "Web Workflow",
  statusLabel: "Beta",
  badge: "Nuovo",
  highlights: ["Instagram", "Facebook", "Batch", "Meta"],
};
