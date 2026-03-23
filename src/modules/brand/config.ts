import type { ModuleConfig } from "../optimize/config";

export const brandModule: ModuleConfig = {
  id: "brand",
  name: "Team & Brand",
  route: "/brand",
  enabled: true,
  priority: 8,
  description: "Brand kit locali, palette condivise e asset di team",
  icon: "B",
  category: "Collaborazione",
  statusLabel: "Beta",
  badge: "Nuovo",
  highlights: ["Brand kit", "Palette", "Asset", "Logo"],
};
