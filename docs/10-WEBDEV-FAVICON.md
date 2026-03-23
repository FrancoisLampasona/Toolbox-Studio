# Modulo: Favicon Generator

> **Card Home**: Icona F | "Favicon Generator" | "Pacchetto favicon, manifest e snippet head"

---

## Checklist Stato

- [x] Il modulo esiste come quarto modulo reale della suite
- [x] Genera davvero PNG 16x16 e 32x32
- [x] Genera `favicon.ico`
- [x] Genera `apple-touch-icon.png`
- [x] Genera icone Android 192x192 e 512x512
- [x] Genera `site.webmanifest`
- [x] Mostra e copia uno snippet `<head>` coerente con gli asset attivi
- [x] Ricorda localmente nome app, short name, colori, path asset e toggle principali
- [ ] SVG mask icon e varianti Safari pinned tab non sono ancora presenti
- [ ] Browserconfig / tile Windows avanzato non e' ancora presente

## Stato Reale Oggi

- Il modulo e' navigabile dalla Home della suite e usa la stessa shell ridimensionabile degli altri moduli.
- L'utente sceglie una sorgente principale, definisce nome app, short name, path asset, theme/background color e padding.
- Il backend genera un pacchetto pronto per il web in una cartella output selezionabile.
- Lo snippet head e' copiabile e il modulo mostra subito l'elenco dei file prodotti con peso finale.

## Pacchetto Live

- `favicon-16x16.png`
- `favicon-32x32.png`
- `favicon.ico`
- `apple-touch-icon.png`
- `android-chrome-192x192.png`
- `android-chrome-512x512.png`
- `site.webmanifest`

## Snippet Generato

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#111827">
```

## Roadmap Da Qui

- SVG e mask icon per Safari pinned tab
- Varianti brand kit condivise
- Export preset per progetto/cliente
- Integrazione futura con `Brand Kit / Collaborazione`
