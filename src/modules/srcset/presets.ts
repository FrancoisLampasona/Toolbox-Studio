export interface SrcsetPreset {
  id: string;
  name: string;
  description: string;
  widths: number[];
  sizes: string;
}

export const DEFAULT_SRCSET_NAMING = "{slug}-{w}w";

export const SRCSET_PRESETS: SrcsetPreset[] = [
  {
    id: "editorial-hero",
    name: "Editorial Hero",
    description: "Hero grandi per landing, magazine e contenuti full-width.",
    widths: [320, 640, 768, 1024, 1440, 1920],
    sizes: "100vw",
  },
  {
    id: "content-inline",
    name: "Content Inline",
    description: "Immagini dentro al contenuto con larghezza massima controllata.",
    widths: [320, 480, 768, 960, 1280],
    sizes: "(min-width: 1200px) 960px, 100vw",
  },
  {
    id: "ecommerce-gallery",
    name: "Ecommerce Gallery",
    description: "Gallery e schede prodotto con layout meta` viewport desktop.",
    widths: [320, 480, 640, 960, 1280],
    sizes: "(min-width: 1024px) 50vw, 100vw",
  },
  {
    id: "cards-grid",
    name: "Cards Grid",
    description: "Card, teaser e thumbnail responsive su griglie editoriali.",
    widths: [160, 320, 480, 640, 800],
    sizes: "(min-width: 1200px) 25vw, (min-width: 768px) 33vw, 100vw",
  },
];
