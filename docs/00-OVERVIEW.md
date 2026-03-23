# Toolbox Creative Studio - Vision & Roadmap

## Da Tool a Suite: Toolbox Creative Studio

## Checklist Stato

- [x] La suite si chiama `Toolbox Creative Studio` e il primo modulo è `ConvertitoreClickoso`
- [x] Il modulo immagini esiste e copre il flusso base di scan, preview e conversione
- [x] La shell minima della suite e il routing Home > modulo esistono gia'
- [x] La dashboard principale e' stata ridisegnata: layout centrato, card uguali per modulo, titolo "Cosa vuoi fare?", gradient accent bar, roadmap muted
- [x] La Home mostra una sezione `Roadmap prossima` separata e non cliccabile, senza simulare moduli finti
- [x] I moduli reali usano ora colonne adattive e ridimensionabili trascinando i separatori
- [x] La persistenza leggera di path e preferenze base e' stata introdotta
- [x] La scansione del modulo immagini e' ora metadata-first e piu' rapida sui batch medi
- [x] Il footer distingue scansione, caricamento miniature e conversione
- [x] I percorsi sorgente ricordati sono visibili e svuotabili dal modulo immagini
- [x] La griglia immagini usa virtualizzazione reale sui batch grandi
- [x] Il modulo immagini puo' esportare un report CSV del batch concluso
- [x] Il modulo immagini supporta profili locali salvabili per cliente/progetto
- [x] Il modulo immagini supporta import/export JSON dei profili locali con collision handling
- [x] Il modulo immagini supporta naming pattern con preview output e token base
- [x] Drop diretto nel modulo optimize disponibile
- [x] Drag & drop dalla Home sulla card "Ottimizza Immagini" disponibile
- [x] `WordPress Media` esiste in una prima versione reale con profili built-in e conversione batch dedicata
- [x] `WordPress Media` supporta ora profili custom locali, import/export JSON e persistenza leggera delle impostazioni
- [x] `Srcset Generator` esiste ora come terzo modulo reale della suite con snippet HTML, preset responsive e conversione batch
- [x] `Favicon Generator` esiste ora come quarto modulo reale della suite con PNG, ICO, manifest e snippet head
- [x] `Social Media Images` esiste ora come quinto modulo reale della suite per template social e batch multi-piattaforma
- [x] `Watch Folder / Automazione` esiste ora come sesto modulo reale con cartella sorvegliata, riuso profili optimize e stato live
- [x] `Batch Rename` esiste ora come settimo modulo reale con preview naming, collision handling e rinomina in-place
- [x] `Video Tools` esiste ora come ottavo modulo reale con stato FFmpeg, compressione batch e poster frame
- [x] `Team & Brand` esiste ora come nono modulo reale con brand kit locali e persistenza minima
- [x] `Optimize` mostra ora il peso finale stimato/reale e supporta qualita' diverse per file selezionato
- [x] `Social Media Images` puo' ora consumare un Brand Kit locale come sorgente automatica di base
- [x] `Favicon Generator` copre ora anche Safari pinned tab e browserconfig Windows
- [ ] SQLite, profili condivisi e log attivita' restano roadmap

Toolbox Creative Studio nasce come tool verticale per ottimizzare immagini per siti WordPress. La vision e' trasformarlo in una **suite modulare** per creativi digitali e web developer: un coltellino svizzero aziendale dove ogni funzionalita' e' un modulo accessibile dalla Home.

## Stato Reale Oggi

- Il prodotto e' ancora centrato sul modulo immagini, ma la suite ha ora una shell minima reale con Home e routing base.
- La base tecnica e' solida per il primo modulo, con Tauri + React + Rust gia' in uso.
- L'esperienza del modulo immagini e' piu' matura: scansione metadata-first, progress separato per le miniature, gestione visibile dei path recenti, virtualizzazione reale sui batch grandi ed export CSV del batch.
- Il modulo immagini ha ora anche profili locali riutilizzabili: salvataggio, applicazione, aggiornamento ed eliminazione senza uscire dal pannello destro.
- Il modulo immagini ha ora anche import/export JSON dei profili locali, con collision handling sui nomi importati e rigenerazione degli id locali.
- Il flusso cliente/progetto e' piu' concreto: il modulo immagini ha naming pattern persistito, preview del nome finale e riuso attraverso i profili locali.
- Il milestone corrente e' la stabilizzazione di `optimize`: collision-safe naming, import/export profili JSON e virtualizzazione reale della griglia sono ora chiusi a livello codice.
- La Home Dashboard e' stata ridisegnata da zero: layout centrato (max-width 960px), titolo con gradient text, card modulo uguali con accent bar colorata, sezione "In arrivo" muted, footer compatto. Rimossi hero gigante, signal grid, session card, workflow steps, production notes.
- La Home distingue presente e futuro: card cliccabili per i moduli reali, pill non cliccabili per la roadmap.
- La Home scala bene con piu' moduli: il grid `repeat(auto-fill, minmax(340px, 1fr))` si adatta da 2 a 3+ colonne automaticamente.
- La shell e il modulo immagini supportano ora il drag & drop nel percorso reale gia' disponibile: Home verso optimize e drop diretto dentro il modulo.
- `WordPress Media` e' ora il secondo modulo reale della suite: profili built-in e custom, selezione componenti, naming WordPress, fallback multi-formato base e conversione batch.
- `Srcset Generator` e' ora il terzo modulo reale: preset responsive, larghezze custom, snippet `img/srcset` o `picture`, copy snippet ed export CSV del batch.
- `Favicon Generator` e' ora il quarto modulo reale: genera `favicon.ico`, PNG 16/32, apple-touch, Android icons, `site.webmanifest` e snippet head.
- `Social Media Images` e' ora il quinto modulo reale: template social per piattaforma, varianti batch e preset multi-canale.
- `Watch Folder / Automazione` e' ora il sesto modulo reale: osserva una cartella locale, riusa i job di optimize, tiene una coda operativa e puo' spostare gli originali in `Processati`.
- `Batch Rename` e' ora il settimo modulo reale: anteprima naming, collision-safe suffix, rinomina in-place e stato batch direttamente nella suite.
- `Video Tools` e' ora l'ottavo modulo reale: FFmpeg di sistema, target 60/70/80/90 per file, peso finale stimato/reale ed estrazione poster frame.
- `Team & Brand` e' ora il nono modulo reale: CRUD di brand kit locali, preview palette/font/logo e base condivisibile via JSON.
- In `Optimize`, il pannello destro mostra ora il peso finale batch/file e la qualita' puo' essere personalizzata per il file attivo senza toccare quella globale.
- `Social Media Images` puo' ora leggere i brand kit locali e applicarli al modulo per precompilare asset path, alt text e contesto visuale.
- `Favicon Generator` genera anche `safari-pinned-tab.svg`, `browserconfig.xml` e tile Windows insieme allo snippet head aggiornato.
- L'espansione dei moduli si ferma qui per questo round: il focus torna su stabilita', polish e chiusura dei flussi gia' presenti.

---

## Architettura UX: Home Dashboard

All'avvio l'app mostra una **Home Dashboard** con card cliccabili organizzate per categoria.

### Layout Home

```
+----------------------------------------------------------+
|  [Logo] Toolbox Creative Studio          [Search]    [Settings]   |
+----------------------------------------------------------+
|                                                          |
|  WEB DEVELOPMENT                                         |
|  +----------------+  +----------------+  +-----------+   |
|  | Ottimizza      |  | WordPress      |  | Favicon   |   |
|  | Immagini       |  | Media          |  | Generator |   |
|  | Converti e     |  | Preset per     |  | Tutte le  |   |
|  | comprimi per   |  | temi e plugin  |  | dimensioni|   |
|  | PageSpeed 100  |  | WP             |  | in un     |   |
|  |                |  |                |  | click     |   |
|  +----------------+  +----------------+  +-----------+   |
|  +----------------+  +----------------+                  |
|  | Srcset         |  | Social Media   |                  |
|  | Generator      |  | Images         |                  |
|  | Responsive     |  | OG, Twitter,   |                  |
|  | images auto    |  | IG, LinkedIn   |                  |
|  +----------------+  +----------------+                  |
|                                                          |
|  EDITING                                                 |
|  +----------------+  +----------------+  +-----------+   |
|  | Editor Foto    |  | Video Tools    |  | Watermark |   |
|  | Crop, filtri,  |  | Comprimi,      |  | Batch     |   |
|  | correzioni     |  | converti,      |  | Logo su   |   |
|  |                |  | estrai frame   |  | tutte le  |   |
|  |                |  |                |  | foto      |   |
|  +----------------+  +----------------+  +-----------+   |
|                                                          |
|  UTILITA'                                                |
|  +----------------+  +----------------+  +-----------+   |
|  | Automazione    |  | Team & Brand   |  | EXIF      |   |
|  | Watch folder,  |  | Profili        |  | Manager   |   |
|  | profili,       |  | condivisi,     |  | Visualizza|   |
|  | batch rename   |  | brand kit      |  | e strip   |   |
|  +----------------+  +----------------+  +-----------+   |
|                                                          |
+----------------------------------------------------------+
|  v1.0.0  |  Ultimi: hero.jpg, product.png  |  Feedback  |
+----------------------------------------------------------+
```

### Dettagli Card

Ogni card ha:
- **Icona grande** (emoji o SVG custom) che identifica il modulo
- **Titolo** breve e chiaro
- **Descrizione** di una riga che spiega cosa fa
- **Badge "Nuovo"** per moduli appena aggiunti
- **Contatore** opzionale (es. "3 file in coda" per watch folder)

### Navigazione

- **Click su card** → transizione animata (slide/fade) → schermata modulo full-screen
- Ogni modulo ha il **suo layout ottimizzato** per il task specifico
- **Bottone back** (freccia) in alto a sinistra per tornare alla Home
- **Breadcrumb**: Home > Ottimizza Immagini
- Opzione di **pinnare un modulo** come default all'avvio (per chi usa sempre lo stesso)
- Stato attuale: la Home espone gia' hero, metriche rapide, recente contesto operativo e card modulo piu' curate

### Accesso Rapido

- **Search bar** nella Home per cercare tra moduli e azioni
- **Ultimi file usati** nel footer per accesso rapido
- **Roadmap di questo round**: drag & drop sulla card "Ottimizza Immagini" per aprire direttamente il modulo con quei file
- **QA smoke**: vedi [08 - QA Optimize](08-QA-OPTIMIZE.md)

---

## Mappa Moduli (Priorita')

| Priorita' | Modulo | Stato |
|-----------|--------|-------|
| **P0** | Ottimizza Immagini (Convertitore) | Implementato |
| **P0** | Shell minima Toolbox Creative Studio | Parziale |
| **P1** | Favicon Generator | Implementato |
| **P1** | Responsive Srcset Generator | Implementato |
| **P1** | Social Media Images | Implementato |
| **P2** | Watch Folder / Automazione | Implementato |
| **P2** | Batch Rename | Implementato |
| **P2** | Team & Brand (brand kit locali) | Implementato |
| **P2** | Profili Cliente/Progetto | Parziale (locali in optimize) |
| **P2** | Watermark Batch | Roadmap |
| **P2** | EXIF Manager | Roadmap |
| **P2** | WordPress Media (profili tema) | Parziale |
| **P3** | Editor Foto (crop, filtri, correzioni) | Roadmap |
| **P2** | Video Tools (compressione, frame extraction) | Implementato |
| **P3** | Background Remover (AI) | Roadmap |
| **P3** | Brand Kit / Team condiviso, log e sync multiutente | Roadmap |

---

## Stack Tecnico

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Rust (Tauri v2)
- **Image Processing**: image crate, webp crate, ravif (AVIF)
- **Video Processing**: FFmpeg (bundled o system)
- **Storage**: JSON leggero oggi, SQLite solo se servira' davvero per profili condivisi, log e query
- **Distribution**: macOS .dmg, Windows .msi, Linux .AppImage

## Note Operative

- La coerenza grafica va mantenuta: la suite deve riusare l'atmosfera attuale, non rimpiazzarla.
- La shell va introdotta per gradi, partendo da Home + modulo optimize, senza forzare una riscrittura totale.
- Il primo salto di qualita' deve essere nella struttura e nella velocita', non nel numero di feature.

---

## Documenti Correlati

- [01 - Ottimizzazione Web](01-WEBDEV-OTTIMIZZAZIONE.md)
- [02 - WordPress Media](02-WEBDEV-WORDPRESS.md)
- [03 - Workflow & Automazione](03-WEBDEV-WORKFLOW.md)
- [09 - Srcset Generator](09-WEBDEV-SRCSET.md)
- [10 - Favicon Generator](10-WEBDEV-FAVICON.md)
- [11 - Social Media Images](11-WEBDEV-SOCIAL.md)
- [12 - Batch Rename](12-WEBDEV-BATCH-RENAME.md)
- [04 - Editing Foto](04-EDITING-FOTO.md)
- [05 - Editing Video](05-EDITING-VIDEO.md)
- [06 - Collaborazione & Brand](06-COLLABORAZIONE.md)
- [07 - Architettura Tecnica](07-ARCHITETTURA-TECNICA.md)
