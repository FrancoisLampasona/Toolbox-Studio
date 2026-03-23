import type { ModuleConfig } from "../optimize/config";

export const automationModule: ModuleConfig = {
  id: "automation",
  name: "Watch Folder",
  route: "/automation",
  enabled: true,
  priority: 5,
  description: "Sorveglia una cartella e converte automaticamente con optimize",
  icon: "A",
  category: "Utility Workflow",
  statusLabel: "Beta",
  badge: "Nuovo",
  highlights: ["Watch", "Auto", "Queue", "Optimize"],
};
