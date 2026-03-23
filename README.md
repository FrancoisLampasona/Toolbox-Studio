# Toolbox Creative Studio

Suite desktop modulare per creativi digitali e web developer. Un coltellino svizzero aziendale dove ogni funzionalita e' un modulo accessibile dalla Home Dashboard.

Built with **Tauri v2** + **React 19** + **TypeScript** + **Rust**.

---

## Moduli Disponibili

| Modulo | Descrizione | Stato |
|--------|-------------|-------|
| **Ottimizza Immagini** | Conversione batch multi-formato (WebP, AVIF, JPEG, PNG), 11 preset WordPress, multi-preset, profili locali, naming pattern, export CSV | Implementato |
| **WordPress Media** | Profili tema built-in e custom, naming WordPress, snippet starter, conversione batch dedicata | Implementato |
| **Srcset Generator** | Varianti responsive, larghezze custom, snippet `img/srcset` e `picture`, copy snippet, export CSV | Implementato |
| **Favicon Generator** | PNG, ICO, apple-touch, Android icons, `site.webmanifest`, snippet head | Implementato |
| **Social Media Images** | OG, Twitter, Instagram, LinkedIn | Prossimo |

## Features

- **Home Dashboard** con card centrate e navigazione moduli
- **Scansione metadata-first** con thumbnail hydration separata
- **Virtualizzazione griglia** per batch grandi (react-window)
- **Profili locali** salvabili per cliente/progetto con import/export JSON
- **Naming pattern** con token e preview live
- **Drag & drop nativo** Tauri (Home e moduli)
- **Colonne ridimensionabili** con persistenza locale
- **HEIC/HEIF** su macOS (via sips)
- **Processing parallelo** con rayon

## Stack

- **Frontend**: React 19, TypeScript 5.6, Vite 6
- **Backend**: Rust, Tauri v2
- **Image Processing**: image crate, webp crate, ravif (AVIF), ico crate
- **Storage**: JSON leggero (settings + profili)

## Sviluppo

```bash
# Installa dipendenze
npm install

# Avvia in dev mode
npm run tauri dev

# Build produzione
npm run tauri build
```

### Prerequisiti

- Node.js 18+
- Rust (stable)
- Tauri CLI v2 (`npm install -g @tauri-apps/cli`)
- macOS / Windows / Linux

## Struttura Progetto

```
src/                          # Frontend React
  shell/                      # Home Dashboard, routing, shell
  optimize/                   # Modulo Ottimizza Immagini
  modules/
    wordpress/                # Modulo WordPress Media
    srcset/                   # Modulo Srcset Generator
    favicon/                  # Modulo Favicon Generator
    registry.ts               # Registro moduli

src-tauri/                    # Backend Rust
  src/
    commands/                 # Comandi Tauri (scan, convert, settings)
    processing/               # Processor, presets, cache

docs/                         # Documentazione architettura e moduli
```

## Licenza

Proprietario - Tutti i diritti riservati.
