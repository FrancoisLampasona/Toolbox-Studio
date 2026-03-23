# Modulo: Srcset Generator

> **Card Home**: Icona S | "Srcset Generator" | "Varianti responsive e snippet HTML pronti"

---

## Checklist Stato

- [x] Il modulo esiste come terzo modulo reale della suite
- [x] Usa il backend di conversione esistente per generare batch responsive
- [x] Supporta preset responsive built-in e breakpoint custom
- [x] Supporta output AVIF, WebP e JPEG combinabili
- [x] Genera snippet `img/srcset` o `picture` copiabile
- [x] Mantiene persistenza leggera di width, sizes, alt, naming e formati attivi
- [x] Supporta export CSV del batch responsive
- [ ] Placeholder, blurhash e LQIP non sono ancora presenti
- [ ] Import automatico da componenti HTML/CSS o da DOM reale non e' ancora presente

## Stato Reale Oggi

- Il modulo e' gia' navigabile dalla Home e usa lo stesso layout a colonne della suite.
- L'utente puo' caricare file o cartelle, definire preset responsive o larghezze custom e scegliere i formati output.
- Il naming pattern e' persistito localmente e viene usato davvero in conversione.
- Il modulo genera uno snippet HTML coerente con i formati attivi e permette la copia negli appunti.
- La parte di performance segue gli stessi miglioramenti di `optimize`: scan metadata-first, hydration thumbnail e griglia alleggerita.

## Feature Live

### Preset Responsive

- `Editorial Hero`
- `Content Inline`
- `Gallery / Card`
- Breakpoint custom tramite input libero separato da virgole

### Snippet HTML

Se attivi piu' formati, il modulo genera uno `picture` con fallback progressivo.

```html
<picture>
  <source type="image/avif" srcset="hero-320w.avif 320w, hero-768w.avif 768w" sizes="100vw">
  <source type="image/webp" srcset="hero-320w.webp 320w, hero-768w.webp 768w" sizes="100vw">
  <img src="hero-768w.jpg" srcset="hero-320w.jpg 320w, hero-768w.jpg 768w" sizes="100vw" alt="Hero image" loading="lazy" decoding="async" width="768" height="432">
</picture>
```

### Output

- Varianti ordinate per larghezza
- Naming pattern con token base
- Export CSV del batch completato

## Roadmap Da Qui

- Placeholder blur / LQIP / dominant color
- Preset per framework e component library
- Template snippet per React / Next / Astro
- Import da HTML o da pattern di progetto
