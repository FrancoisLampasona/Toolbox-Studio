# Modulo: WordPress Media

> **Card Home**: Icona W (WordPress) | "WordPress Media" | "Preset per temi e plugin WP"

---

## Checklist Stato

- [x] Il modulo e' definito come estensione naturale della suite Toolbox Creative Studio
- [x] Il modulo e' esposto in UI come secondo modulo reale della suite
- [x] Esistono profili tema built-in con componenti attivabili
- [x] Il modulo converte davvero usando scan + convert del backend esistente
- [x] Naming WordPress con preview e snippet starter sono gia' disponibili
- [x] Profili custom WordPress locali salvabili dal modulo disponibili
- [x] Import/export JSON dei profili tema WordPress disponibili
- [x] Persistenza leggera delle impostazioni WordPress disponibile
- [x] Fallback multi-formato base AVIF + WebP + JPEG disponibile
- [-] Snippet PHP/HTML avanzati sono presenti in forma starter, ma non ancora come libreria completa
- [ ] WooCommerce optimizer e import ACF/Gutenberg non sono ancora presenti
- [ ] DB dedicato e condivisione profili restano roadmap

## Descrizione

Modulo dedicato al workflow WordPress. L'utente seleziona il tema/plugin che usa e ottiene i preset dimensionali esatti per ogni componente. Genera i file con naming convention compatibile con la Media Library e produce snippet PHP/HTML pronti all'uso.

## Stato Reale Oggi

- Il modulo esiste davvero nella Home della suite ed e' navigabile come secondo flusso reale dopo optimize.
- Oggi copre un workflow concreto: scegli un profilo built-in o custom, attiva i componenti, imposta slug progetto, naming, formato/quality e lancia la conversione batch.
- Il backend riusato e' lo stesso di optimize, quindi naming collision-safe, export CSV e motore di conversione sono gia' condivisi.
- Il modulo salva ora anche uno stato leggero locale: profilo selezionato, componenti attivi, slug progetto, naming, formato, quality e resize mode.
- I profili tema possono essere salvati come copie locali, esportati in JSON e reimportati con collision handling sui nomi.
- Il modulo espone uno snippet starter per temi che servono asset dal tema e, quando attivi la fallback chain, produce anche la preview `picture` AVIF/WebP/JPEG.
- Restano fuori da questo round: parser ACF/Gutenberg, snippet PHP piu' completi e tuning WooCommerce piu' intelligente.

---

## Feature

### Profili per Tema

L'utente crea (o importa) un **profilo per tema WordPress** che definisce tutte le dimensioni necessarie per ogni componente.

**Interfaccia:**
```
+------------------------------------------+
| Profilo Tema: [flavor developer ▾] [+Nuovo]|
+------------------------------------------+
| Componente        | Dimensione | Attivo  |
|-------------------|-----------|---------|
| Hero Banner       | 1920x600  | [x]    |
| Hero Mobile       | 768x400   | [x]    |
| Slider            | 1200x500  | [ ]    |
| Sidebar Widget    | 300x250   | [x]    |
| Footer Logo       | 200x60    | [x]    |
| Blog Featured     | 1200x800  | [x]    |
| Blog Thumbnail    | 400x300   | [x]    |
| Author Avatar     | 150x150   | [ ]    |
+------------------------------------------+
| [Importa JSON] [Esporta JSON] [Salva]   |
+------------------------------------------+
```

**Preset Tema Precaricati:**
- Generico WordPress (default WP sizes: 150x150, 300x300, 768x-, 1024x-)
- WooCommerce Standard
- Elementor Full Width
- L'utente puo' aggiungere profili custom locali salvando la configurazione corrente o importando JSON

**Flusso:**
1. Seleziona profilo tema built-in o custom
2. Attiva/disattiva i componenti di cui hai bisogno
3. Opzionalmente salva una copia locale o importa/esporta JSON
4. Carica le foto
5. Click "Genera" → crea tutte le varianti per ogni componente attivo

### Naming Convention per WP Media Library

Auto-rename dei file con pattern configurabile per mantenere ordine nella Media Library.

**Pattern disponibili:**
- `{progetto}-{componente}-{dimensioni}.{ext}`
- `{progetto}_{slug}_{w}x{h}.{ext}`
- Custom con variabili

**Variabili:**
| Variabile | Esempio | Descrizione |
|-----------|---------|-------------|
| `{progetto}` | pizzeria-mario | Nome progetto (slugificato) |
| `{componente}` | hero | Nome componente dal profilo |
| `{slug}` | foto-ristorante | Nome file slugificato |
| `{w}` | 1920 | Larghezza |
| `{h}` | 600 | Altezza |
| `{dimensioni}` | 1920x600 | Larghezza x Altezza |
| `{formato}` | webp | Estensione formato |
| `{data}` | 2026-03 | Anno-mese |
| `{n}` | 001 | Contatore progressivo |

**Preview in tempo reale:** mentre l'utente modifica il pattern, vede l'anteprima del nome risultante.

### WooCommerce Product Optimizer

Sottosezione dedicata alle foto prodotto e-commerce.

**Preset WooCommerce:**
| Nome | Dimensione | Uso |
|------|-----------|-----|
| Product Main | 600x600 | Immagine principale prodotto |
| Product Gallery | 1200x1200 | Galleria ad alta risoluzione |
| Product Thumbnail | 300x300 | Thumbnail nella lista |
| Cart Thumbnail | 100x100 | Icona nel carrello |
| Category Banner | 1200x400 | Banner categoria |

**Feature extra per prodotti:**
- **Sfondo bianco automatico**: rileva sfondo e lo rende bianco puro (#fff) per consistenza
- **Padding uniforme**: aggiunge margine interno per centrare il prodotto
- **Consistenza batch**: tutte le foto prodotto con stesse dimensioni, sfondo e margini
- **Ombra drop shadow**: aggiunge ombra leggera sotto il prodotto

### ACF / Gutenberg Sizes

Supporto per dimensioni custom definite nei plugin WordPress.

**ACF (Advanced Custom Fields):**
- Importa configurazione ACF (file JSON) per leggere i campi immagine e le dimensioni configurate
- Genera preset automaticamente dai campi ACF del tema

**Gutenberg Blocks:**
- Preset per blocchi standard:
  - Cover Block: 1920x1080 (full), 1200x600 (wide)
  - Media & Text: 600x400
  - Gallery: 800x600
  - Image: varie
- Preset per blocchi Elementor, WPBakery, Divi

### Multi-Formato con Fallback Automatico

Genera automaticamente la catena completa di formati per massima compatibilita'.

**Per ogni immagine genera:**
1. `.avif` (browser moderni - compressione migliore)
2. `.webp` (supporto ampio - buona compressione)
3. `.jpg` (fallback universale)

**Snippet PHP per WordPress:**
```php
function toolbox_picture($image_slug, $alt = '') {
    $base = get_template_directory_uri() . '/assets/img/';
    echo '<picture>';
    echo '<source srcset="' . $base . $image_slug . '.avif" type="image/avif">';
    echo '<source srcset="' . $base . $image_slug . '.webp" type="image/webp">';
    echo '<img src="' . $base . $image_slug . '.jpg" alt="' . esc_attr($alt) . '" loading="lazy">';
    echo '</picture>';
}
```

**Snippet HTML copiabile** con bottone clipboard per ogni immagine convertita.

---

## Implementazione Tecnica

| Feature | Backend | Frontend | Complessita' |
|---------|---------|----------|-------------|
| Profili tema | Storage leggero app + JSON import/export | Form editor leggero + select + lista | Parziale live |
| Naming convention | String template engine | Preview live | Live |
| WooCommerce optimizer | Image processing (background detection) | Preset UI | Roadmap |
| ACF import | JSON parser | File picker + preview | Roadmap |
| Multi-formato fallback | Reusa encoder esistenti (3 passate) | Preview snippet + chain AVIF/WebP/JPEG | Parziale live |
