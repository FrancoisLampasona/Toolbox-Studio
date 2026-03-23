export interface SocialVariantPreset {
  id: string;
  platformId: string;
  platformName: string;
  name: string;
  description: string;
  width: number;
  height: number;
  suffix: string;
  defaultEnabled?: boolean;
}

export interface SocialPlatformPreset {
  id: string;
  name: string;
  description: string;
  accent: string;
  badge: string;
  variantIds: string[];
  defaultVariantIds: string[];
}

export interface SocialPackPreset {
  id: string;
  name: string;
  description: string;
  variantIds: string[];
}

export const DEFAULT_SOCIAL_NAMING = "{preset}-{slug}-{w}x{h}";

export const SOCIAL_VARIANTS: SocialVariantPreset[] = [
  {
    id: "instagram-feed-square",
    platformId: "instagram",
    platformName: "Instagram",
    name: "Feed Square",
    description: "Post quadrato classico per feed e campagne visual.",
    width: 1080,
    height: 1080,
    suffix: "_instagram-feed-square",
    defaultEnabled: true,
  },
  {
    id: "instagram-feed-portrait",
    platformId: "instagram",
    platformName: "Instagram",
    name: "Feed Portrait",
    description: "Formato 4:5 che occupa piu' spazio nel feed.",
    width: 1080,
    height: 1350,
    suffix: "_instagram-feed-portrait",
  },
  {
    id: "instagram-story",
    platformId: "instagram",
    platformName: "Instagram",
    name: "Story / Reel",
    description: "Verticale 9:16 per stories, reel cover e ads.",
    width: 1080,
    height: 1920,
    suffix: "_instagram-story",
  },
  {
    id: "instagram-profile",
    platformId: "instagram",
    platformName: "Instagram",
    name: "Profile",
    description: "Avatar o immagine profilo pubblica.",
    width: 320,
    height: 320,
    suffix: "_instagram-profile",
  },
  {
    id: "facebook-feed",
    platformId: "facebook",
    platformName: "Facebook",
    name: "Feed Link",
    description: "Copertina per post con link e anteprima social.",
    width: 1200,
    height: 630,
    suffix: "_facebook-feed",
    defaultEnabled: true,
  },
  {
    id: "facebook-cover",
    platformId: "facebook",
    platformName: "Facebook",
    name: "Cover",
    description: "Cover pagina o eventi con impatto orizzontale.",
    width: 1920,
    height: 1005,
    suffix: "_facebook-cover",
  },
  {
    id: "facebook-profile",
    platformId: "facebook",
    platformName: "Facebook",
    name: "Profile",
    description: "Immagine profilo pagina o account brand.",
    width: 320,
    height: 320,
    suffix: "_facebook-profile",
  },
  {
    id: "linkedin-post",
    platformId: "linkedin",
    platformName: "LinkedIn",
    name: "Post",
    description: "Immagine post professionale e articolo.",
    width: 1200,
    height: 627,
    suffix: "_linkedin-post",
    defaultEnabled: true,
  },
  {
    id: "linkedin-banner",
    platformId: "linkedin",
    platformName: "LinkedIn",
    name: "Banner",
    description: "Header profilo o company page.",
    width: 1584,
    height: 396,
    suffix: "_linkedin-banner",
  },
  {
    id: "linkedin-profile",
    platformId: "linkedin",
    platformName: "LinkedIn",
    name: "Profile",
    description: "Foto profilo quadrata ad alta definizione.",
    width: 400,
    height: 400,
    suffix: "_linkedin-profile",
  },
  {
    id: "x-post",
    platformId: "x",
    platformName: "X",
    name: "Post",
    description: "Immagine card per post e link preview.",
    width: 1200,
    height: 675,
    suffix: "_x-post",
    defaultEnabled: true,
  },
  {
    id: "x-header",
    platformId: "x",
    platformName: "X",
    name: "Header",
    description: "Cover profilo piu' ampia e panoramica.",
    width: 1500,
    height: 500,
    suffix: "_x-header",
  },
  {
    id: "x-profile",
    platformId: "x",
    platformName: "X",
    name: "Profile",
    description: "Avatar quadrato per account social.",
    width: 400,
    height: 400,
    suffix: "_x-profile",
  },
  {
    id: "youtube-thumbnail",
    platformId: "youtube",
    platformName: "YouTube",
    name: "Thumbnail",
    description: "Miniatura principale video e copertina player.",
    width: 1280,
    height: 720,
    suffix: "_youtube-thumbnail",
    defaultEnabled: true,
  },
  {
    id: "youtube-banner",
    platformId: "youtube",
    platformName: "YouTube",
    name: "Banner",
    description: "Copertina canale larga.",
    width: 2560,
    height: 1440,
    suffix: "_youtube-banner",
  },
  {
    id: "youtube-profile",
    platformId: "youtube",
    platformName: "YouTube",
    name: "Profile",
    description: "Avatar canale o brand.",
    width: 800,
    height: 800,
    suffix: "_youtube-profile",
  },
];

export const SOCIAL_PLATFORMS: SocialPlatformPreset[] = [
  {
    id: "instagram",
    name: "Instagram",
    description: "Post, stories e avatar brand.",
    accent: "#ff5ea8",
    badge: "IG",
    variantIds: [
      "instagram-feed-square",
      "instagram-feed-portrait",
      "instagram-story",
      "instagram-profile",
    ],
    defaultVariantIds: ["instagram-feed-square"],
  },
  {
    id: "facebook",
    name: "Facebook",
    description: "Feed, cover e profilo pagina.",
    accent: "#5b8cff",
    badge: "FB",
    variantIds: ["facebook-feed", "facebook-cover", "facebook-profile"],
    defaultVariantIds: ["facebook-feed"],
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Post e cover professionali.",
    accent: "#2f8be0",
    badge: "IN",
    variantIds: ["linkedin-post", "linkedin-banner", "linkedin-profile"],
    defaultVariantIds: ["linkedin-post"],
  },
  {
    id: "x",
    name: "X",
    description: "Post, header e avatar.",
    accent: "#a8b0bd",
    badge: "X",
    variantIds: ["x-post", "x-header", "x-profile"],
    defaultVariantIds: ["x-post"],
  },
  {
    id: "youtube",
    name: "YouTube",
    description: "Thumbnail, banner e profilo canale.",
    accent: "#ff4d4d",
    badge: "YT",
    variantIds: ["youtube-thumbnail", "youtube-banner", "youtube-profile"],
    defaultVariantIds: ["youtube-thumbnail"],
  },
];

export const SOCIAL_PACKS: SocialPackPreset[] = [
  {
    id: "core",
    name: "Core Pack",
    description: "Un formato principale per ogni piattaforma.",
    variantIds: SOCIAL_PLATFORMS.flatMap((platform) => platform.defaultVariantIds),
  },
  {
    id: "full",
    name: "Full Pack",
    description: "Tutte le varianti disponibili.",
    variantIds: SOCIAL_VARIANTS.map((variant) => variant.id),
  },
  {
    id: "square",
    name: "Square Pack",
    description: "Solo asset quadrati e profilo.",
    variantIds: [
      "instagram-feed-square",
      "instagram-profile",
      "facebook-profile",
      "linkedin-profile",
      "x-profile",
      "youtube-profile",
    ],
  },
];

export const SOCIAL_DEFAULT_VARIANT_IDS = SOCIAL_PLATFORMS.flatMap(
  (platform) => platform.defaultVariantIds,
);
