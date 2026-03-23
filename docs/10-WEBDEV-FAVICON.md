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
- [x] Genera `safari-pinned-tab.svg` e aggiorna lo snippet Safari
- [x] Genera `browserconfig.xml` e tile Windows base

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
- `safari-pinned-tab.svg`
- `browserconfig.xml`

## Snippet Generato

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="mask-icon" href="/safari-pinned-tab.svg" color="#111827">
<meta name="msapplication-config" content="/browserconfig.xml">
<meta name="msapplication-TileColor" content="#111827">
<meta name="theme-color" content="#111827">
```

## Roadmap Da Qui

- Varianti brand kit condivise
- Export preset per progetto/cliente
- Integrazione futura con `Brand Kit / Collaborazione`
