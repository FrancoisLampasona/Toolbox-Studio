# Modulo: Video Tools

> **Card Home**: Icona ciak | "Video Tools" | "Comprimi, converti, estrai frame"

---

## Stato Reale Oggi

- [x] La base `Toolbox Creative Studio`, la shell minima e il primo modulo `optimize` esistono gia' come fondazione reale del progetto.
- [ ] `Video Tools` non e' ancora implementato nel frontend o nel backend.
- [ ] Non esiste ancora integrazione FFmpeg, non esiste ancora transcodifica, non esiste ancora estrazione frame.
- [-] Le specifiche qui sotto sono intenzionali e utili per la roadmap, ma non vanno lette come funzionalita' gia' pronte.

## Checklist Di Avanzamento

- [x] Delineato il perimetro funzionale del futuro modulo video.
- [x] Distinto chiaramente il presente della suite dalla roadmap video.
- [ ] Definire il primo MVP video da costruire dopo la base optimize.
- [ ] Stabilire strategia FFmpeg di sistema vs bundled.
- [ ] Implementare backend Tauri per compressione e resize.
- [ ] Aggiungere UI per preset video e progress reale.

---

## Descrizione

Strumenti per lavorare con i video nel contesto web e social media. Questo modulo e' ancora roadmap: oggi l'app reale si ferma alla base `Toolbox Creative Studio / optimize`, quindi questa sezione serve a descrivere la direzione futura senza confonderla con lo stato corrente.

---

## Feature

### Compressione Video per Web

Comprimi video per il caricamento su siti web mantenendo qualita' visiva.

**Formati supportati:**
| Input | Output Container | Output Codec |
|-------|-----------------|-------------|
| MP4, MOV, AVI, MKV, WebM | MP4 | H.264, H.265/HEVC |
| FLV, WMV, 3GP | WebM | VP9, AV1 |

**Preset Quality:**
| Preset | CRF | Uso tipico | Peso stimato (1min 1080p) |
|--------|-----|-----------|--------------------------|
| Alta | 18 | Portfolio, showreel | ~50 MB |
| Media | 23 | Blog, landing page | ~25 MB |
| Web | 28 | Background video, inline | ~12 MB |
| Ultra-light | 35 | Preview, placeholder | ~5 MB |

**Target File Size Mode:**
- Imposta peso massimo (es. "max 5 MB")
- L'app calcola il bitrate necessario automaticamente
- Utile per limiti upload (WordPress default: 64MB, ma molti hosting 10-20MB)

**Audio:**
- Codec: AAC
- Bitrate: 64 / 128 / 192 / 256 kbps
- Opzione "Muto" (rimuovi traccia audio, peso -30-50%)
- Opzione "Normalizza volume"

**Interfaccia:**
```
+--------------------------------------------+
| Video: promo-ristorante.mov                |
| Durata: 00:45  |  Risoluzione: 4K         |
| Peso: 380 MB   |  Codec: ProRes           |
+--------------------------------------------+
|                                            |
| Preset: [Web ▾]   Codec: [H.264 ▾]       |
| Container: [MP4 ▾]                        |
|                                            |
| Audio: [128 kbps ▾]  [ ] Muto            |
|                                            |
| Peso stimato: ~12 MB (-97%)               |
|                                            |
| [Comprimi]                                |
+--------------------------------------------+
```

### Resize Video per Social

Ridimensiona e adatta video per le specifiche di ogni piattaforma social.

**Preset Social:**
| Piattaforma | Nome | Aspect | Risoluzione |
|------------|------|--------|-------------|
| YouTube | Video | 16:9 | 1920x1080 |
| YouTube | Shorts | 9:16 | 1080x1920 |
| Instagram | Post | 1:1 | 1080x1080 |
| Instagram | Story/Reel | 9:16 | 1080x1920 |
| Instagram | Landscape | 1.91:1 | 1080x566 |
| TikTok | Video | 9:16 | 1080x1920 |
| Facebook | Post | 1:1 | 1080x1080 |
| Facebook | Cover | 820:312 | 820x312 |
| LinkedIn | Post | 1:1 | 1080x1080 |
| LinkedIn | Banner | 4:1 | 1584x396 |
| Twitter/X | Post | 16:9 | 1280x720 |

**Modalita' padding:**
- **Barre nere**: letterbox/pillarbox classico
- **Blur background**: sfondo sfocato dell'immagine stessa (stile Instagram)
- **Colore solido**: sfondo con colore a scelta
- **Crop center**: taglia i bordi per riempire (come Cover per le foto)

**Preview:** anteprima del risultato prima di confermare.

### Estrazione Frame

Estrai immagini fisse da un video.

**Modalita':**

**Frame Singolo:**
- Timeline scrubber per navigare il video
- Preview del frame corrente
- "Estrai questo frame" → salva come PNG/JPEG
- Ideale per: scegliere thumbnail per video YouTube

**Frame Multipli (Intervallo):**
- Estrai 1 frame ogni N secondi (configurabile)
- Es: 1 frame/secondo per 45 secondi = 45 immagini
- Ideale per: time-lapse, contact sheet, storyboard

**Frame Migliori (Auto):**
- Analisi automatica: seleziona i frame meno mossi/sfocati
- Numero di frame desiderato (es. "i 10 migliori")
- Algoritmo: calcolo nitidezza Laplaciana + varianza

**Output:** le immagini estratte possono essere passate direttamente al modulo "Ottimizza Immagini".

### Video to GIF / WebP Animato

Converti porzioni di video in GIF o WebP animato per il web.

**Interfaccia:**
```
+--------------------------------------------+
| [=====|=========IN========OUT==========]   |  <- Timeline
|  00:00        00:12      00:18    00:45   |
+--------------------------------------------+
| Preview:                                   |
| [Frame animato qui]                        |
+--------------------------------------------+
| Formato: [GIF ▾]  [WebP Animato ▾]       |
| FPS: [15 ▾]  Larghezza: [480px]          |
| Loop: [Infinito ▾]                        |
|                                            |
| Peso stimato: ~2.4 MB                     |
| [Genera]                                  |
+--------------------------------------------+
```

**Opzioni:**
- **Intervallo**: punto IN e punto OUT sulla timeline
- **FPS**: 5, 10, 15, 20, 24, 30
- **Larghezza massima**: auto-calcola altezza per mantenere aspect ratio
- **Palette**: ottimizzata per GIF (256 colori con dithering)
- **Loop**: infinito, N volte, nessuno
- **Velocita'**: 0.5x, 1x, 1.5x, 2x

**GIF vs WebP Animato:**
| | GIF | WebP Animato |
|---|-----|-------------|
| Peso | Pesante | ~50% piu' leggero |
| Colori | 256 | 16.7M |
| Trasparenza | 1 bit | 8 bit (alpha) |
| Compatibilita' | Universale | Tutti i browser moderni |

### Trim / Cut

Taglia porzioni di video senza re-encoding (quando possibile).

- **Timeline** con marcatori IN e OUT trascinabili
- **Preview** in tempo reale del segmento selezionato
- **Fast trim** (senza re-encoding): tagli su keyframe, istantaneo, qualita' identica
- **Precise trim** (con re-encoding): taglio al frame esatto, richiede encoding
- **Multi-segment**: seleziona piu' porzioni da tenere, scarta il resto

### Poster Frame Selector

Scegli il frame da usare come thumbnail/poster del video.

- Scrubber sulla timeline
- "Migliori suggeriti" (frame nitidi e rappresentativi)
- Esporta come immagine ottimizzata (passa al modulo Ottimizza)
- Genera automaticamente con le dimensioni per YouTube (1280x720)

### Sottotitoli Burn-in

Incorpora sottotitoli direttamente nel video.

**Input:** file `.srt` o `.vtt`

**Personalizzazione:**
- Font e dimensione
- Colore testo e colore sfondo (semi-trasparente)
- Posizione: basso, centro, alto
- Margine dal bordo
- Stile: normale, outline, ombra

**Use case:** Video per social media che vengono guardati in muto (80% degli utenti).

---

## Implementazione Tecnica

**Backend principale: FFmpeg**

FFmpeg viene utilizzato come backend per tutte le operazioni video. Due approcci:

1. **FFmpeg bundled**: incluso nel pacchetto dell'app (~40-80MB extra)
   - Pro: funziona ovunque senza configurazione
   - Contro: peso dell'app aumenta significativamente

2. **FFmpeg di sistema**: usa l'installazione FFmpeg dell'utente
   - Pro: nessun peso aggiuntivo
   - Contro: richiede installazione separata
   - L'app verifica la presenza di FFmpeg e guida l'installazione se mancante

**Approccio consigliato:** Opzione 2 con guida installazione (brew install ffmpeg / choco install ffmpeg).

## Presente Vs Roadmap

### Presente

- La suite ha solo la base optimize come modulo realmente costruito.
- Nessun comando video e nessuna UI video sono presenti ancora.

### Roadmap

- Compressione video web.
- Resize per social.
- Frame extraction e thumbnail poster.
- GIF/WebP animato, trim/cut e sottotitoli burn-in.

| Feature | Comando FFmpeg | Complessita' |
|---------|---------------|-------------|
| Compressione | `ffmpeg -i input -c:v libx264 -crf 23` | Media |
| Resize social | `ffmpeg -i input -vf "scale=1080:1080:force_original_aspect_ratio=..."` | Media |
| Frame extraction | `ffmpeg -i input -vf "select=eq(n\,FRAME)" -frames:v 1` | Bassa |
| GIF conversion | `ffmpeg -i input -vf "fps=15,scale=480:-1" -gifflags +transdiff` | Media |
| WebP animato | `ffmpeg -i input -vf "fps=15,scale=480:-1" -loop 0 output.webp` | Media |
| Trim | `ffmpeg -ss START -to END -i input -c copy` (fast) | Bassa |
| Sottotitoli | `ffmpeg -i input -vf "subtitles=subs.srt:force_style='...'"` | Media |
| Poster frame | `ffmpeg -i input -ss TIME -frames:v 1 output.jpg` | Bassa |

**Rust integration:** `std::process::Command` per chiamare FFmpeg (stesso pattern gia' usato per `sips` nel modulo HEIC).
