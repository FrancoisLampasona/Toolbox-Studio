import type { ModuleConfig } from "../optimize/config";

export const srcsetModule: ModuleConfig = {
  id: "srcset",
  name: "Srcset Generator",
  route: "/srcset",
  enabled: true,
  priority: 2,
  description: "Varianti responsive e snippet HTML pronti per il web",
  icon: "S",
  category: "Web Workflow",
  statusLabel: "Live",
  badge: "Nuovo",
  highlights: ["Srcset", "Picture", "Responsive", "HTML"],
};
