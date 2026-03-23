use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preset {
    pub category: String,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub suffix: String,
}

pub fn get_presets() -> Vec<Preset> {
    vec![
        Preset {
            category: "Hero Banner".into(),
            name: "1920×1080".into(),
            width: 1920,
            height: 1080,
            suffix: "_hero".into(),
        },
        Preset {
            category: "Hero Banner".into(),
            name: "1920×600".into(),
            width: 1920,
            height: 600,
            suffix: "_hero_wide".into(),
        },
        Preset {
            category: "Hero Banner".into(),
            name: "1920×400".into(),
            width: 1920,
            height: 400,
            suffix: "_hero_slim".into(),
        },
        Preset {
            category: "Blog/Post".into(),
            name: "1200×800".into(),
            width: 1200,
            height: 800,
            suffix: "_blog".into(),
        },
        Preset {
            category: "Blog/Post".into(),
            name: "1024×768".into(),
            width: 1024,
            height: 768,
            suffix: "_post".into(),
        },
        Preset {
            category: "WooCommerce".into(),
            name: "600×600".into(),
            width: 600,
            height: 600,
            suffix: "_product".into(),
        },
        Preset {
            category: "WooCommerce".into(),
            name: "300×300".into(),
            width: 300,
            height: 300,
            suffix: "_product_sm".into(),
        },
        Preset {
            category: "Thumbnail".into(),
            name: "150×150".into(),
            width: 150,
            height: 150,
            suffix: "_thumb".into(),
        },
        Preset {
            category: "Thumbnail".into(),
            name: "100×100".into(),
            width: 100,
            height: 100,
            suffix: "_thumb_sm".into(),
        },
        Preset {
            category: "Logo".into(),
            name: "250×100".into(),
            width: 250,
            height: 100,
            suffix: "_logo".into(),
        },
        Preset {
            category: "Contenuto".into(),
            name: "800×600".into(),
            width: 800,
            height: 600,
            suffix: "_content".into(),
        },
    ]
}
