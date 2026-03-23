import type { ModuleConfig } from "../optimize/config";

export const videoModule: ModuleConfig = {
  id: "video",
  name: "Video Tools",
  route: "/video",
  enabled: true,
  priority: 5,
  description: "Compressione FFmpeg, poster frame e target 60-90% per batch video web",
  icon: "V",
  category: "Video Workflow",
  statusLabel: "Beta",
  badge: "Nuovo",
  highlights: ["FFmpeg", "CRF", "Poster", "Batch"],
};
