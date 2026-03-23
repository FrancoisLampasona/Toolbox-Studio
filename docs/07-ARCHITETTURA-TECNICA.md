# Architettura Tecnica

---

## Stato Reale Oggi

- [x] La base reale del progetto e' `Toolbox Creative Studio` con primo modulo `optimize` gia' costruito.
- [x] Il backend ha gia' scan, conversione, progress e settings leggeri.
- [x] Esistono gia' shell minima, Home base, registry minimo e routing Home > optimize / wordpress / srcset / favicon.
- [x] La Home e' stata ridisegnata: layout centrato, card uguali, gradient accent bar, titolo "Cosa vuoi fare?", roadmap muted, footer compatto.
- [x] La Home espone anche una roadmap separata e non cliccabile per i moduli futuri, senza fingere che siano gia' live.
- [x] La scansione del modulo immagini e' metadata-first con probing parallelo e thumbnail hydration separata.
- [x] Il frontend espone path input ricordati, output persistito e stato footer distinto per scan / thumbnail / convert.
- [x] Il frontend usa virtualizzazione reale della griglia per alleggerire i batch grandi.
- [x] I moduli reali usano un layout a colonne ridimensionabili con persistenza locale e fallback adattivo tablet/mobile.
- [x] Il backend espone un comando dedicato per export CSV del summary batch.
- [x] Il backend salva profili locali di optimize nello storage leggero dell'app con comandi dedicati.
- [x] Il backend risolve i nomi output da naming pattern persistiti e li applica direttamente in conversione.
- [x] Il backend esporta e importa profili JSON con collision handling sui nomi importati.
- [x] La shell e il modulo optimize usano drag & drop nativo Tauri nel percorso oggi realmente disponibile.
- [x] `WordPress Media` e' ora agganciato al registry e al routing come secondo modulo reale della suite.
- [x] Il backend salva ora anche profili custom WordPress e impostazioni leggere del modulo.
- [x] `WordPress Media` supporta import/export JSON dei profili tema con collision handling.
- [x] `Srcset Generator` e `Favicon Generator` sono ora agganciati al registry e al routing come terzo e quarto modulo reale.
- [-] L'architettura a moduli qui descritta e' la direzione target, ma non tutta la suite esiste ancora nel codice.
- [ ] Home dashboard completa e routing di tutti i moduli futuri sono ancora da costruire.
- [ ] SQLite, profili condivisi, log attivita' e moduli extra non sono pronti.

## Checklist Di Avanzamento

- [x] Identificata la base reale gia' disponibile nel repo.
- [x] Distinta la parte gia' costruita dalla roadmap.
- [x] Estrarre e stabilizzare una shell minima di suite nel frontend.
- [x] Rifinire la dashboard principale: redesign completo con layout centrato, card uguali, accent bar, gradient text, sezione roadmap muted.
- [x] Separare scansione metadati e caricamento miniature per migliorare la velocita' percepita.
- [x] Introdurre storage leggero per path e preferenze operative del primo modulo.
- [x] Introdurre un primo export report CSV senza aggiungere storage pesante o moduli nuovi.
- [x] Ridurre il carico iniziale della griglia sui batch grandi con virtualizzazione reale.
- [x] Introdurre drag & drop nativo nel percorso Home optimize e nel modulo immagini.
- [x] Introdurre profili locali riutilizzabili senza aprire ancora il capitolo database.
- [x] Introdurre naming pattern persistito e preview output senza creare un modulo separato prematuro.
- [x] Chiudere collision-safe naming e import/export JSON profili.
- [x] Chiudere la virtualizzazione reale della griglia.
- [x] Aggiungere test backend mirati per collision-safe naming e import/export profili.
- [x] Aggiungere un registry moduli reale con piu' di un modulo live.
- [x] Estendere lo storage leggero ai profili e alle preferenze operative di `WordPress Media`.
- [x] Estendere routing, storage leggero e shell fino a quattro moduli reali.
- [ ] Estendere navigazione e shell ai moduli futuri.
- [ ] Introdurre storage strutturato solo quando serve davvero.
- [ ] Espandere i moduli uno alla volta senza fingere che siano gia' pronti.

## Sistema a Moduli

Ogni card della Home corrisponde a un **modulo indipendente**. Architettura pluggabile dove ogni modulo e' un pacchetto autocontenuto. Al momento, nel prodotto reale, la base effettiva e' formata da `optimize` e da un primo `WordPress Media` agganciato alla stessa suite `Toolbox Creative Studio`.

### Struttura di un Modulo

```
src/modules/
  optimize/              <- Modulo "Ottimizza Immagini"
    index.tsx            <- Componente React principale
    components/          <- Componenti specifici del modulo
    hooks/               <- Custom hooks del modulo
    config.ts            <- Metadata modulo (nome, icona, route)

src-tauri/src/modules/
  optimize/
    mod.rs               <- Comandi Tauri del modulo
    processor.rs         <- Logica di processing
```

### Registro Moduli

Array centralizzato con metadata di ogni modulo:

```typescript
// src/modules/registry.ts
export interface ModuleConfig {
  id: string;
  name: string;
  description: string;
  icon: string;           // Emoji o path SVG
  category: "webdev" | "editing" | "utility";
  route: string;          // es. "/optimize"
  component: React.LazyComponent;
  enabled: boolean;
  badge?: string;         // "Nuovo", "Beta"
  priority: number;       // Ordine nella griglia
}

export const modules: ModuleConfig[] = [
  {
    id: "optimize",
    name: "Ottimizza Immagini",
    description: "Converti e comprimi per PageSpeed 100",
    icon: "gauge",
    category: "webdev",
    route: "/optimize",
    component: lazy(() => import("./optimize")),
    enabled: true,
    priority: 0,
  },
  // ... altri moduli
];
```

### Abilitazione/Disabilitazione

- L'utente puo' disabilitare moduli non necessari dalle Settings
- Moduli disabilitati non appaiono nella Home
- Riduce il "rumore" per chi usa solo alcune funzionalita'
- Esiste gia' un registry live minimo nel frontend, ma non ancora completo.

---

## Routing Frontend

### React Router

Navigazione tra Home e moduli tramite React Router.

```
/                     → Home Dashboard (griglia card)
/optimize             → Modulo Ottimizza Immagini
/wordpress            → Modulo WordPress Media
/favicon              → Modulo Favicon Generator
/srcset               → Modulo Srcset Generator
/social               → Modulo Social Media Images
/editor               → Modulo Editor Foto
/video                → Modulo Video Tools
/watermark            → Modulo Watermark Batch
/automation           → Modulo Automazione
/exif                 → Modulo EXIF Manager
/brand                → Modulo Brand Kit
/settings             → Impostazioni App
```

### Stato Reale Del Routing

- Oggi esiste un routing reale tra Home, `optimize`, `WordPress Media`, `Srcset Generator` e `Favicon Generator`.
- La Home a card centrata e il passaggio fra Home e modulo sono presenti con animazione stagger e gradient accent.
- L'elenco completo dei moduli sopra resta futuro solo in parte — oggi sono reali `optimize`, `WordPress Media`, `Srcset Generator` e `Favicon Generator`.

### Transizioni

- **Home → Modulo**: slide-in da destra (o fade-in)
- **Modulo → Home**: slide-out verso destra (o fade-out)
- Durata: 200-300ms, easing: ease-out
- Implementazione: `framer-motion` o CSS transitions con React Router

### State Preservation

Quando l'utente torna alla Home e poi rientra nel modulo, lo stato viene preservato:

- File caricati rimangono in memoria
- Selezioni e impostazioni mantenute
- Risultati dell'ultima conversione ancora visibili
- Implementazione: stato a livello App con Context o Zustand (non nel componente modulo)

---

## Processing Backend

### Architettura Comandi Tauri

Ogni modulo registra i propri comandi Tauri nel `lib.rs`:

```rust
// src-tauri/src/lib.rs
mod modules;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Modulo Optimize
            modules::optimize::scan_images,
            modules::optimize::convert_images,
            // Modulo Favicon
            modules::favicon::generate_favicons,
            // Modulo Video
            modules::video::compress_video,
            modules::video::extract_frame,
            // ... etc
        ])
        .run(tauri::generate_context!())
}
```

### Stato Reale Del Backend

- I comandi attuali coprono scan, conversione, output, settings leggeri e import/export JSON dei profili.
- `scan_paths` e' il flusso principale; `scan_images` resta un helper dev.
- La conversione riceve ora `output_dir` in modo esplicito, quindi non dipende piu' solo da path hardcoded.
- Il naming output collision-safe nei batch e' risolto in modo deterministico senza cambiare la grafica.

### Parallel Processing

Il crate `rayon` (gia' nelle dipendenze) per processamento parallelo:

```rust
use rayon::prelude::*;

// Processa N file in parallelo usando tutti i core
let results: Vec<ConvertResult> = files
    .par_iter()
    .map(|file| process_image(file, &output_dir, &options))
    .collect();
```

- Thread pool automatico basato su numero di core CPU
- Ideale per batch di molte immagini piccole
- Per file grandi (video), meglio un singolo FFmpeg con multi-threading interno

### GPU Acceleration (Futuro)

Per operazioni pixel-intensive su grandi immagini:

- **wgpu** crate per compute shaders cross-platform
- Operazioni candidabili: resize, filtri, color correction, blur
- Fallback CPU automatico se GPU non disponibile
- Priorita' bassa: CPU e' sufficiente per la maggior parte dei casi

### FFmpeg Integration (Video)

Due strategie per il backend video:

**1. FFmpeg di sistema (raccomandato inizialmente):**
```rust
let output = std::process::Command::new("ffmpeg")
    .args(["-i", input_path, "-c:v", "libx264", "-crf", "23", output_path])
    .output()?;
```
- Verifica presenza: `which ffmpeg`
- Guida installazione se mancante
- Stesso pattern gia' usato per `sips` (HEIC)

**2. FFmpeg bundled (futuro):**
- `ffmpeg-sidecar` crate per includere FFmpeg nell'app
- Pro: zero configurazione per l'utente
- Contro: +40-80MB dimensione app

---

## Storage Locale

### SQLite Database

Questo blocco resta architettura futura, non implementazione attuale.

Per dati strutturati e query veloci.

```sql
-- Profili di conversione
CREATE TABLE profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    config JSON NOT NULL,
    created_at DATETIME,
    updated_at DATETIME
);

-- Log attivita'
CREATE TABLE activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user TEXT,
    module TEXT,
    operation TEXT,
    files_count INTEGER,
    input_size INTEGER,
    output_size INTEGER,
    config JSON,
    status TEXT
);

-- Preferenze utente
CREATE TABLE preferences (
    key TEXT PRIMARY KEY,
    value JSON
);

-- Brand kit
CREATE TABLE brand_kits (
    id TEXT PRIMARY KEY,
    name TEXT,
    config JSON,
    created_at DATETIME
);
```

**Crate:** `rusqlite` o `sqlx` (async).

### Stato Reale Dello Storage

- Nel prodotto corrente non usiamo ancora SQLite.
- Le preferenze minime vengono salvate in JSON dentro la app data dir.
- I profili locali di `optimize`, `WordPress Media` e le preferenze operative di `srcset` / `favicon` vivono nello stesso `settings.json` applicativo.
- La cache thumbnail vive nella cache dir dell'app.
- La smoke checklist ufficiale del modulo optimize vive in [08 - QA Optimize](08-QA-OPTIMIZE.md).
- La Home Dashboard e' stata ridisegnata con layout centrato, card uguali e sezione roadmap muted.
- Il prossimo modulo reale della suite diventa `Social Media Images`.

### File System

Per asset binari e file di configurazione:

```
~/.toolbox-creative-studio/
  settings.json        <- Preferenze app + profili locali optimize
  db.sqlite            <- Database (roadmap)
  brands/              <- Brand kit assets (loghi, font)
  cache/               <- Cache thumbnail
  locales/             <- File traduzione
```

### Tauri Store Plugin

Per settings leggeri (tema, lingua, modulo default, ultimo path usato):

```rust
// Tauri store plugin per key-value semplici
app.store("settings.json")
```

---

## Auto-Update

### Tauri Updater Plugin

Aggiornamenti automatici integrati:

- Check aggiornamenti all'avvio (opzionale, disattivabile)
- Notifica discreta: "Nuova versione disponibile (v1.2.0)"
- Download in background
- Changelog in-app: "Cosa c'e' di nuovo"
- Canali: `stable` (default), `beta` (opt-in)

**Implementazione:**
```toml
# src-tauri/Cargo.toml
[dependencies]
tauri-plugin-updater = "2"
```

---

## Build & Distribution

### Piattaforme Target

| Piattaforma | Formato | Signing | Note |
|------------|---------|---------|------|
| macOS | .dmg | Apple Developer ID | Gatekeeper notarization |
| macOS (Apple Silicon) | .dmg (aarch64) | Apple Developer ID | Build nativo ARM |
| Windows | .msi / .exe (NSIS) | Code signing cert | SmartScreen trust |
| Linux | .AppImage | - | Universale |
| Linux | .deb | - | Debian/Ubuntu |

### CI/CD Pipeline

```yaml
# GitHub Actions
on: push
jobs:
  build:
    strategy:
      matrix:
        os: [macos-latest, macos-13, windows-latest, ubuntu-latest]
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: npm ci
      - run: npx tauri build
      - uses: actions/upload-artifact@v4
```

### Dimensione App Target

| Componente | Peso stimato |
|-----------|-------------|
| Tauri runtime | ~5 MB |
| Rust backend (tutti i moduli) | ~10-15 MB |
| Frontend (React bundle) | ~2-3 MB |
| FFmpeg (se bundled) | ~40-80 MB |
| **Totale senza FFmpeg** | **~20 MB** |
| **Totale con FFmpeg** | **~80-100 MB** |

---

## Testing

### Unit Test (Rust)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resize_cover() {
        let img = DynamicImage::new_rgba8(4000, 3000);
        let options = ConvertOptions { width: 1920, height: 1080, ... };
        let result = resize_image(&img, &options);
        assert_eq!(result.dimensions(), (1920, 1080));
    }

    #[test]
    fn test_webp_lossy_quality() {
        // Verifica che quality 80 produca file piu' piccoli di quality 100
    }
}
```

### Integration Test (Comandi Tauri)

```rust
#[cfg(test)]
mod integration {
    #[test]
    fn test_scan_recursive() {
        // Crea struttura cartelle temp con immagini
        // Verifica che scan_paths trovi tutte le immagini ricorsivamente
    }

    #[test]
    fn test_convert_batch() {
        // Converti N file con M preset
        // Verifica output: N * M file creati, dimensioni corrette
    }
}
```

### E2E Test (UI)

```typescript
// Con WebDriver / Playwright
test("home to optimize module flow", async () => {
  // 1. App si apre sulla Home
  // 2. Click card "Ottimizza Immagini"
  // 3. Verifica navigazione al modulo
  // 4. Aggiungi file
  // 5. Seleziona preset
  // 6. Click CONVERTI
  // 7. Verifica progress bar
  // 8. Verifica file output creati
});
```

### Benchmark

```rust
#[bench]
fn bench_resize_1000_images() {
    // Misura tempo per processare 1000 immagini
    // Confronta sequential vs parallel (rayon)
}
```
