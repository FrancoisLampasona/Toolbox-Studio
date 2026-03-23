# Modulo: Editor Foto

> **Card Home**: Icona pennello | "Editor Foto" | "Crop, watermark, filtri, correzioni"

---

## Stato Reale Oggi

- [x] La base prodotto `Toolbox Creative Studio` con shell minima e primo modulo `optimize` e' gia' stata impostata.
- [x] Il flusso attuale resta centrato su ottimizzazione immagini, con scan, preset, preview e conversione batch.
- [ ] `Editor Foto` non e' ancora implementato come modulo reale nell'app.
- [ ] Crop manuale, watermark, correzioni base, filtri, EXIF manager e background removal sono ancora roadmap.
- [-] Alcune operazioni fotografiche possono essere considerate come evoluzione naturale del modulo immagini, ma non esistono ancora UI e comandi dedicati.

## Checklist Di Avanzamento

- [x] Definita la posizione del modulo all'interno della suite.
- [x] Separato il presente dal futuro, senza dare per pronti i tool di editing.
- [ ] Progettare il primo sottopannello di editing da collegare al modulo `optimize` o a un nuovo modulo `editor`.
- [ ] Definire quali funzioni entrano nel primo MVP di editing foto.
- [ ] Implementare backend dedicato per crop, watermark e correzioni.
- [ ] Aggiungere UI e persistenza per preset di editing.

---

## Descrizione

Editor fotografico integrato per operazioni comuni che evitano di dover aprire Photoshop per task semplici. Questo doc descrive la direzione futura: oggi la parte realmente disponibile e' ancora il modulo `optimize`, mentre l'editing foto e' una roadmap da costruire sopra la base Toolbox Creative Studio.

---

## Feature

### Crop Manuale Interattivo

Canvas con l'immagine e handles trascinabili per definire l'area di crop.

**Interfaccia:**
```
+------------------------------------------------+
| Aspect Ratio: [1:1] [4:3] [16:9] [9:16] [Free]|
| [x] Griglia dei terzi                          |
+------------------------------------------------+
|                                                |
|    +--[handle]----------[handle]--+            |
|    |  ........................... |            |
|    |  :     :     :     :       :|            |
|    |  :.....:.....:.....:.......:| <- Griglia  |
|    |  :     :     :     :       :|    dei terzi|
|    |  :.....:.....:.....:.......:|
|    |  :     :     :     :       :|            |
|    +--[handle]----------[handle]--+            |
|                                                |
+------------------------------------------------+
| Zoom: [- ====|======== +]  Pan: [Spazio+drag] |
| Dimensione risultante: 1200 x 800             |
+------------------------------------------------+
```

**Funzionalita':**
- **Preset aspect ratio**: 1:1, 4:3, 3:2, 16:9, 9:16, 4:5, Custom
- **Griglia dei terzi** sovrapposta (toggle on/off)
- **Griglia golden ratio** (opzionale)
- **Zoom** con scroll + pan con spazio+drag
- **Preview** dimensione risultante in tempo reale
- **Batch crop**: applica stesso crop (relativo) a tutte le immagini selezionate

### Watermark Batch

Applica un watermark (logo o testo) a tutte le foto selezionate.

**Watermark Logo:**
- Carica PNG/SVG trasparente come watermark
- 9 posizioni predefinite (griglia 3x3) + posizione custom con drag
- Opacita' regolabile: 10-100%
- Dimensione relativa: % della larghezza immagine (es. 20%)
- Margine dal bordo configurabile

**Watermark Testo:**
- Testo libero (es. "2026 Pizzeria Mario")
- Font: selezione tra font di sistema
- Dimensione, colore, opacita'
- Ombra (offset, blur, colore)
- Rotazione (es. -45° per watermark diagonale)

**Preview:** anteprima in tempo reale su una delle foto selezionate.

**Batch:** click "Applica a tutte" → processa tutte le foto con lo stesso watermark.

### Correzioni Base

Slider per correzioni fotografiche fondamentali. Anteprima in tempo reale.

| Correzione | Range | Default |
|-----------|-------|---------|
| Luminosita' | -100 / +100 | 0 |
| Contrasto | -100 / +100 | 0 |
| Saturazione | -100 / +100 | 0 |
| Temperatura | -100 (freddo) / +100 (caldo) | 0 |
| Esposizione | -2.0 / +2.0 EV | 0 |
| Nitidezza | 0 / 200% | 0 |
| Vignettatura | 0 / 100% | 0 |

**Auto-enhance:** bottone che analizza l'immagine e applica correzioni automatiche (livelli, bilanciamento bianco, contrasto).

**Batch:** applica le stesse correzioni a tutte le foto selezionate.

### Filtri Preset

Filtri predefiniti applicabili con un click.

**Filtri inclusi:**
- **B&W Classic**: bianco e nero ad alto contrasto
- **B&W Soft**: bianco e nero morbido
- **Sepia**: tonalita' seppia vintage
- **Vintage**: colori desaturati + grana + vignettatura
- **Film Kodak**: simulazione pellicola calda
- **Film Fuji**: simulazione pellicola fredda
- **High Key**: luminoso e ariosi
- **Low Key**: scuro e drammatico
- **Brand Warm**: tonalita' calda brandizzata
- **Brand Cool**: tonalita' fredda brandizzata

**Filtri custom:**
- Salva una combinazione di correzioni come filtro personalizzato
- Dai un nome e un'icona
- Riutilizzabile su qualsiasi progetto

**Intensita':** slider 0-100% per regolare l'intensita' del filtro.

### EXIF Manager

Visualizzazione e gestione completa dei metadati delle immagini.

**Visualizzazione:**
```
+------------------------------------------+
| EXIF Data - hero.jpg                      |
|                                          |
| Camera:     Canon EOS R5                 |
| Obiettivo:  RF 24-70mm f/2.8            |
| Focale:     35mm                         |
| Apertura:   f/4.0                        |
| Shutter:    1/250s                       |
| ISO:        400                          |
| Data:       2026-03-15 14:30:22          |
| GPS:        45.4642, 9.1900 (Milano)    |
| Dimensioni: 8192 x 5464                 |
| Copyright:  Studio Fotografico XYZ      |
|                                          |
| [Strip Tutto] [Strip GPS] [Modifica]    |
+------------------------------------------+
```

**Operazioni:**
- **Strip completo**: rimuove tutti i metadati (privacy + riduzione peso 10-50KB)
- **Strip selettivo**: rimuovi solo GPS (privacy), tieni copyright
- **Modifica campi**: editor per copyright, autore, descrizione, keywords
- **Batch strip**: rimuovi metadati da tutte le foto selezionate
- **Export EXIF**: esporta metadati come CSV

### Background Removal (AI)

Rimozione automatica dello sfondo per foto prodotto.

**Workflow:**
1. Carica foto prodotto
2. Click "Rimuovi sfondo" → l'AI segmenta il soggetto
3. Preview con scacchiera trasparente
4. Refinement manuale con pennello (aggiungi/rimuovi aree)
5. Sostituisci sfondo: trasparente / bianco / colore / gradiente / immagine

**Opzioni sfondo:**
- Trasparente (PNG/WebP)
- Bianco puro (#ffffff) - standard e-commerce
- Colore solido (picker)
- Gradiente (2 colori + direzione)
- Immagine custom come sfondo

**Implementazione:** `rembg` (Python) o modello ONNX integrato in Rust.

### Raddrizzamento e Rotazione

Strumenti per correggere l'orientamento delle foto.

- **Auto-detect orizzonte**: analizza l'immagine e raddrizza automaticamente
- **Slider rotazione fine**: -45° a +45° con step 0.1°
- **Linea guida**: trascina una linea sull'orizzonte della foto, l'app calcola la rotazione
- **Rotazione 90°**: CW / CCW con un click
- **Flip**: orizzontale / verticale
- **Batch**: applica stessa rotazione a tutte le selezionate

---

## Implementazione Tecnica

| Feature | Crate/Lib Rust | Complessita' |
|---------|---------------|-------------|
| Crop interattivo | Frontend canvas + `image` crate | Media |
| Watermark logo | `image` crate (overlay compositing) | Media |
| Watermark testo | `imageproc` + `rusttype` crate | Media |
| Correzioni base | `image` crate (pixel manipulation) | Media |
| Filtri | Lookup tables (LUT) precompilate | Bassa |
| EXIF read/write | `kamadak-exif` o `rexiv2` crate | Media |
| EXIF strip | Ricodifica senza metadati | Bassa |
| Background removal | ONNX Runtime (`ort` crate) + U2Net model | Alta |
| Raddrizzamento | `imageproc` crate (affine transform) | Media |

## Presente Vs Roadmap

### Presente

- `optimize` copre gia' conversione, preset, resize e preview crop.
- La struttura della suite e' stata iniziata, ma non esiste ancora una UI di editing foto dedicata.

### Roadmap

- Editor foto separato o sottosezione evoluta dentro la suite.
- Crop manuale reale con handles e zoom/pan.
- Watermark batch e correzioni base.
- EXIF manager e background removal come step successivi, non come feature già pronte.
