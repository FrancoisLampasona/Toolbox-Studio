export interface ModuleConfig {
  id: string;
  name: string;
  route: string;
  enabled: boolean;
  priority: number;
  description?: string;
  badge?: string;
  icon?: string;
  category?: string;
  statusLabel?: string;
  highlights?: string[];
}

export const optimizeModule: ModuleConfig = {
  id: "optimize",
  name: "Ottimizza Immagini",
  route: "/optimize",
  enabled: true,
  priority: 0,
  description: "Converti e comprimi per PageSpeed 100",
  icon: "C",
  category: "Web Workflow",
  statusLabel: "Live",
  highlights: ["Batch", "Profili", "CSV", "Drag & drop"],
};
