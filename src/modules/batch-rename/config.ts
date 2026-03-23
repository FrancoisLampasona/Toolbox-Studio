import type { ModuleConfig } from "../optimize/config";

export const batchRenameModule: ModuleConfig = {
  id: "batch-rename",
  name: "Batch Rename",
  route: "/rename",
  enabled: true,
  priority: 6,
  description: "Anteprima naming, collisioni sicure e rinomina batch in-place",
  icon: "R",
  category: "Workflow",
  statusLabel: "Live",
  badge: "Nuovo",
  highlights: ["Pattern", "Preview", "Collisioni", "In-place"],
};
