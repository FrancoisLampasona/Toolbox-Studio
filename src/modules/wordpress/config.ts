import type { ModuleConfig } from "../optimize/config";

export const wordpressModule: ModuleConfig = {
  id: "wordpress",
  name: "WordPress Media",
  route: "/wordpress",
  enabled: true,
  priority: 1,
  description: "Profili tema e batch media per workflow WordPress",
  icon: "W",
  category: "Web Workflow",
  statusLabel: "Beta",
  badge: "Nuovo",
  highlights: ["Theme", "Batch", "Snippet", "WP"],
};
