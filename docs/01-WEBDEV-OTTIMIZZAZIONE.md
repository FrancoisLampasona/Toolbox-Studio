# Modulo: Ottimizza Immagini

> **Card Home**: Icona velocimetro | "Ottimizza Immagini" | "Converti e comprimi per PageSpeed 100"

---

## Checklist Stato

- [x] Conversione batch multi-formato: WebP, AVIF, JPEG, PNG
- [x] Resize con preset WordPress e dimensioni custom
- [x] Cover/Fit, preview crop e progress real-time
- [x] La shell minima della suite e il routing Home > modulo esistono gia'
- [x] Scansione metadata-first parallela: la lista compare subito senza aspettare tutte le miniature
- [x] Progress delle miniature nel footer durante la hydration post-scan
- [x] Persistenza leggera di output/input recenti e preferenze base del modulo attiva
- [x] I percorsi input ricordati sono visibili nel pannello impostazioni e si possono svuotare
- [x] La griglia usa virtualizzazione reale sui batch grandi
- [x] Export CSV del batch disponibile dal pannello destro dopo la conversione
- [x] Profili locali salvabili nel pannello destro per cliente/progetto
- [x] Import/export JSON dei profili locali disponibile nel pannello destro
- [x] Naming pattern output con preview e token base disponibile
- [x] Drop diretto di file/cartelle dentro il modulo optimize disponibile
- [x] Drop dalla Home sulla card del modulo disponibile
- [x] Collision-safe naming finale chiuso con suffissi deterministici quando serve
- [x] Import/export JSON dei profili disponibile con collision handling sui nomi importati
- [x] Qualita' per-file sul preview attivo disponibile senza perdere la qualita' globale
- [x] Box `Peso finale` disponibile con input/output batch e dettaglio file attivo
- [x] `Srcset Generator` e' stato promosso a modulo dedicato della suite
- [ ] Auto-Quality e placeholder non sono ancora implementati
- [ ] Il modulo resta singolo e non e' ancora spezzato in sotto-moduli interni

## Stato Attuale (Implementato)

- Il modulo e' gia' utilizzabile come primo blocco reale della suite.
- Conversione batch multi-formato: **WebP lossy**, **AVIF**, **JPEG**, **PNG**
- Resize con 11 preset WordPress (Hero, Blog, WooCommerce, Thumbnail, Logo, Content)
- Quality slider 1-100% con anteprima crop in tempo reale
- Modalita' resize: **Cover** (crop centrato) e **Fit** (mantiene aspect ratio)
- Dimensioni custom (larghezza x altezza libere)
- Multi-preset: genera piu' varianti dimensionali in un solo batch
- Scansione ricorsiva cartelle + aggiunta file singoli
- Scansione metadata-first in parallelo: prima metadati e griglia, poi hydration delle thumbnail
- Progresso real-time distinto nel footer per scansione, hydration miniature e conversione
- Virtualizzazione reale della griglia quando il batch supera la soglia grande
- Summary finale nel footer con conteggio onesto di varianti/sorgenti e metriche adattate ai multi-preset
- Drag & drop nativo Tauri dentro il modulo per aggiungere file e cartelle alla sessione corrente
- Drag & drop dalla Home sulla card dedicata per aprire optimize con quei path
- Gestione errori visiva (badge rosso su card con errore)
- Anteprima crop nella colonna destra con overlay aree tagliate
- Percorsi input ricordati visibili nel pannello impostazioni con azione "Svuota sorgenti"
- Cartella output ricordata tra le sessioni e modificabile dal pannello
- Export CSV del batch direttamente dal pannello destro dopo la conversione
- Profili locali salvabili, applicabili, aggiornabili ed eliminabili dal pannello destro
- Naming output personalizzabile con token come `{nome}`, `{slug}`, `{preset}`, `{w}`, `{h}`, `{formato}`, `{n}`, `{profilo}`
- Qualita' globale piu' override per-file sul sorgente attivo direttamente dal pannello destro
- Box `Peso finale` con input/output batch e dettaglio del file attivo: dati reali dopo la conversione, stima prima della conversione
- HEIC/HEIF support su macOS (via sips)
- Input: JPG, PNG, HEIC, HEIF, TIF, TIFF

## Stato Reale Oggi

- Il cuore del modulo e' implementato e funzionante, e ora vive dentro una shell minima di suite con Home e modulo dedicato.
- Il miglioramento di velocita' gia' visibile in questo round e' lo split tra scansione metadati e caricamento miniature: la UI risponde prima sui batch medi.
- La gestione input/output e' ora usabile anche in sessioni ripetute grazie ai path ricordati e alla visibilita' dei percorsi nel pannello destro.
- Il modulo ha ora un primo layer di riuso concreto: profili locali che catturano output e impostazioni correnti senza introdurre database.
- Il naming non e' piu' fisso: il pannello destro permette di definire un pattern, vedere una preview e salvarlo dentro i profili locali.
- La qualita' non e' piu' solo globale: il file attivo nell'anteprima puo' ricevere un override dedicato, utile quando nello stesso batch vuoi per esempio un 60% e un 80%.
- Il pannello `Peso finale` da' subito feedback utile: sul batch mostra una stima rapida, sul file attivo usa una stima piu' accurata e poi i dati reali del backend appena il batch e' stato eseguito.
- Sui batch grandi il modulo ora alleggerisce davvero il rendering della griglia: le card vengono montate a finestra oltre la soglia definita, mantenendo stabile selezione, preview e hydration delle thumbnail.
- Per i report, oggi il primo step reale e' CSV-first: esportazione disponibile e dati summary piu' coerenti per i multi-preset; il PDF resta dopo.
- Il prossimo salto di UX piu' utile qui, dopo drag & drop, profili locali, JSON import/export e virtualizzazione, sara' rifinire ulteriormente la fluidita' dei batch grandi e la gestione delle collisioni edge-case senza rompere la semplicita' attuale.
- Le feature avanzate sotto restano roadmap e vanno lette come estensioni naturali del flusso attuale, non come parti gia' presenti.
- La parte `srcset` non vive piu' qui come estensione implicita: ora ha un modulo dedicato documentato in [09 - Srcset Generator](09-WEBDEV-SRCSET.md).
- La smoke checklist del milestone vive in [08 - QA Optimize](08-QA-OPTIMIZE.md) e descrive il perimetro di verifica su macOS.

---

## Feature Future

### Auto-Quality Mode (Budget di Peso)

Invece di impostare una quality fissa (es. 80%), l'utente imposta un **budget di peso massimo** per file.

- Slider "Peso massimo": 50KB, 100KB, 200KB, 500KB, 1MB
- L'app usa **binary search** sulla quality (da 95 a 20) per trovare la quality che produce un file entro il budget
- Mostra quality risultante per ogni file dopo la conversione
- Opzione "Strict" (mai superare) vs "Best effort" (piu' vicino possibile)

**Workflow UX:**
```
[x] Auto-Quality    Peso max: [200 KB ▾]
    Modalita': ( ) Strict  (x) Best effort
```

### PageSpeed Score Simulator

Dopo la conversione, mostra una **stima del punteggio PageSpeed** per le immagini.

- Calcolo basato su: peso totale immagini, formato usato, dimensioni vs viewport
- Score 0-100 con colori (rosso/arancione/verde)
- Suggerimenti: "Usa AVIF per risparmiare ulteriore 30%", "Riduci hero a 150KB"
- Non e' il vero Lighthouse, ma una stima utile basata sulle best practice Google

**Esempio output:**
```
+-------------------------------------------+
| PageSpeed Image Score: 94/100             |
|                                           |
| Peso totale: 1.2 MB (12 immagini)        |
| Formato: WebP (ottimo)                    |
| Hero: 180KB (ok, < 200KB)                |
| Suggerimento: Prova AVIF per -30%        |
+-------------------------------------------+
```

### Responsive Srcset Generator

Da **una singola foto** genera automaticamente tutte le varianti responsive necessarie.

- Breakpoint predefiniti: 320w, 640w, 768w, 1024w, 1280w, 1920w
- Breakpoint custom configurabili
- Per ogni breakpoint genera: AVIF + WebP + JPEG (fallback chain)
- Output: le immagini + **snippet HTML copiabile**

**Snippet generato:**
```html
<picture>
  <source type="image/avif"
    srcset="hero-320w.avif 320w, hero-640w.avif 640w, hero-1024w.avif 1024w, hero-1920w.avif 1920w"
    sizes="100vw">
  <source type="image/webp"
    srcset="hero-320w.webp 320w, hero-640w.webp 640w, hero-1024w.webp 1024w, hero-1920w.webp 1920w"
    sizes="100vw">
  <img src="hero-1024w.jpg"
    srcset="hero-320w.jpg 320w, hero-640w.jpg 640w, hero-1024w.jpg 1024w, hero-1920w.jpg 1920w"
    sizes="100vw"
    alt="Hero image"
    loading="lazy"
    decoding="async"
    width="1920" height="1080">
</picture>
```

**UX:** Bottone "Copia HTML" per copiare direttamente negli appunti.

### Lazy Loading Placeholders

Genera placeholder per il lazy loading delle immagini. Tre tipologie:

**BlurHash:**
- Stringa compatta (20-30 caratteri) che rappresenta una versione sfocata dell'immagine
- Decodificabile client-side in JavaScript (< 1KB di codice)
- Ideale per React/Next.js: `<Image placeholder="blur" blurDataURL="..." />`

**LQIP (Low Quality Image Placeholder):**
- JPEG minuscolo (20px di larghezza) codificato inline in base64
- Sfocato con CSS `filter: blur(20px)` e scalato al 100%
- Pesa 200-500 bytes, embedabile direttamente nell'HTML
- Output: stringa `data:image/jpeg;base64,...` copiabile

**Dominant Color:**
- Calcola il colore medio/dominante dell'immagine
- Output: valore HEX (es. `#3a7bd5`) da usare come `background-color` CSS
- Pesa 0 bytes aggiuntivi (e' solo CSS)

**UX:** Per ogni immagine convertita, mostra i 3 placeholder con bottone "Copia" per ognuno.

### Comparazione A/B (Before/After)

Slider interattivo che mostra originale vs ottimizzato.

- Immagine divisa a meta': sinistra originale, destra ottimizzata
- Slider trascinabile per confrontare
- Info sotto: peso originale, peso ottimizzato, risparmio %, quality usata
- Zoom sincronizzato per confrontare dettagli
- Toggle "Side by side" vs "Overlay slider"

### Large Batch Grid

Ottimizzazioni dedicate ai dataset piu' grandi, senza cambiare la direzione visiva del modulo.

- Virtualizzazione o finestratura della griglia per evitare di montare tutte le card insieme
- Priorita' ancora piu' aggressiva alle immagini visibili prima del resto della coda
- Possibile paginazione leggera o caricamento incrementale oltre la soglia dei batch medi
- Obiettivo: mantenere fluida la selezione e lo scroll anche quando il numero di immagini cresce molto

### Drag & Drop

Prossimo step di acquisizione file, senza cambiare il linguaggio visivo del modulo.

- Drop diretto di file o cartelle dentro il modulo optimize per avviare subito scan e hydration
- Drop dalla Home sulla card "Ottimizza Immagini" per aprire il modulo e passare i path in un solo gesto
- Focus tecnico: evitare doppie scansioni, tenere coerente il routing e non perdere lo stato quando la Home e il modulo restano montati

### Bulk Report

Primo step realistico: **CSV exportabile dal summary gia' esistente**. Il PDF resta uno step successivo.

Dopo un batch di conversione, genera un report esportabile.

**CSV:**
```csv
File Originale,Dimensioni Orig,Peso Orig,Formato Output,Dimensioni Output,Peso Output,Risparmio %
hero.jpg,4000x3000,3.2 MB,WebP,1920x1080,180 KB,94.5%
product1.png,2400x2400,5.1 MB,AVIF,600x600,45 KB,99.1%
```

**PDF:**
- Intestazione con logo, data, progetto
- Tabella riepilogativa
- Grafico a torta: risparmio totale
- Grafico a barre: peso per file (prima/dopo)
- Totale: "Risparmiati 45 MB su 50 immagini (-89%)"

---

## Implementazione Tecnica

| Feature | Crate/Lib Rust | Complessita' |
|---------|---------------|-------------|
| Auto-Quality | Binary search + encoder esistente | Roadmap |
| PageSpeed Sim | Calcolo puro, nessun crate | Roadmap |
| Srcset Generator | Reusa resize esistente + template HTML | Implementato come modulo dedicato |
| BlurHash | `blurhash` crate | Roadmap |
| LQIP | Reusa thumbnail generator (ridotto a 20px) | Roadmap |
| Dominant Color | `image` crate (media pixel) | Roadmap |
| Comparazione A/B | Solo frontend (React) | Roadmap |
| Bulk Report | `csv` crate prima, `printpdf` dopo | Prossimo step |
