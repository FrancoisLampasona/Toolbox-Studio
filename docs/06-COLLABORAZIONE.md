# Modulo: Team & Brand

> **Card Home**: Icona persone | "Team & Brand" | "Profili condivisi, brand kit, log"

---

## Stato Reale Oggi

- [x] La base `Toolbox Creative Studio` con il modulo `optimize` e' gia' la fondazione reale del progetto.
- [x] I profili locali esistono gia' nel modulo `optimize`, ma restano solo locali.
- [x] I profili locali ora sono anche esportabili/importabili in JSON, base utile per la futura condivisione.
- [ ] `Team & Brand` non e' ancora implementato come modulo operativo.
- [ ] Non esistono ancora brand kit, profili condivisi, log attivita' o localizzazione reale.
- [-] Il documento descrive la direzione futura e le priorita', non lo stato del prodotto già pronto.

## Checklist Di Avanzamento

- [x] Separata la visione collaborativa dal prodotto attuale.
- [x] Mantenuta la coerenza con il naming Toolbox Creative Studio.
- [x] Distinti profili locali gia' esistenti da profili condivisi ancora futuri.
- [ ] Definire lo storage minimo per brand kit e profili.
- [ ] Stabilire cosa deve essere condiviso davvero nella prima versione.
- [ ] Progettare log attivita' e multi-lingua senza appesantire la suite iniziale.

---

## Descrizione

Funzionalita' per l'uso aziendale multi-utente. Al momento questa e' ancora una roadmap: il prodotto reale e' la base `Toolbox Creative Studio / optimize` con shell minima gia' presente e profili locali gia' funzionanti, quindi qui teniamo separati in modo netto il presente e il futuro condiviso.

---

## Feature

### Brand Kit Aziendale

Kit centralizzato con tutti gli asset del brand, utilizzabile da tutti i moduli.

**Contenuto del Brand Kit:**
```
+------------------------------------------+
| Brand Kit: [Studio Creativo XYZ ▾]       |
+------------------------------------------+
|                                          |
| COLORI                                   |
| Primario:    [#2563EB] ████████         |
| Secondario:  [#7C3AED] ████████         |
| Accento:     [#F59E0B] ████████         |
| Testo:       [#1F2937] ████████         |
| Background:  [#F9FAFB] ████████         |
|                                          |
| LOGO                                    |
| [Logo Colore]  [Logo B&W]  [Icona]     |
| [Logo Oriz.]   [Logo Vert.] [Favicon]  |
|                                          |
| FONT                                    |
| Titoli:    Montserrat Bold              |
| Testo:     Inter Regular                |
| Accent:    Playfair Display Italic      |
|                                          |
| WATERMARK                               |
| Default: logo-watermark.png             |
| Opacita': 30%   Posizione: Basso-Dx    |
|                                          |
| [Esporta Kit] [Importa Kit]            |
+------------------------------------------+
```

**Utilizzo cross-modulo:**
- **Watermark**: usa il logo del brand kit come watermark predefinito
- **Filtri**: i filtri "Brand Warm" / "Brand Cool" usano i colori del kit
- **Template social**: colori e font dal kit applicati automaticamente
- **Favicon**: genera favicon dal logo del kit

**Import/Export:**
- Esporta come file `.toolbox-brand.zip` (JSON config + asset files)
- Importa da file o da URL condiviso
- Versioning: storico modifiche al kit

### Profili Condivisi

Sincronizzazione dei profili di conversione tra colleghi.

**Meccanismo:**
1. **Cartella condivisa**: configura un path condiviso (Dropbox, Google Drive, NAS, server)
2. L'app scrive/legge i profili da questa cartella
3. Quando un collega crea o modifica un profilo, tutti lo vedono al prossimo refresh

**Struttura cartella condivisa:**
```
/Shared/Toolbox Creative Studio/
  profiles/
    pizzeria-mario.json
    ecommerce-moda.json
    blog-viaggi.json
  brands/
    studio-xyz.toolbox-brand.zip
  templates/
    instagram-post.json
    facebook-cover.json
```

**Interfaccia:**
```
+------------------------------------------+
| Profili Condivisi                         |
| Cartella: [/Volumes/NAS/Toolbox] [...]  |
+------------------------------------------+
| Nome              | Autore    | Modif.   |
|-------------------|-----------|----------|
| Pizzeria Mario    | Marco     | 2 ore fa|
| E-commerce Moda   | Laura     | ieri    |
| Blog Viaggi       | Tu        | 1 sett. |
+------------------------------------------+
| [Sincronizza] [Pubblica Profilo]        |
+------------------------------------------+
```

**Conflitti:** se due persone modificano lo stesso profilo, l'app mostra un diff e chiede quale tenere.

### Log Attivita'

Registro locale di tutte le operazioni effettuate.

**Informazioni registrate:**
- Data e ora
- Utente (nome macchina)
- Operazione (conversione, watermark, crop, ecc.)
- File processati (lista)
- Impostazioni usate (profilo, quality, formato)
- Risultato (successo/errore, peso risparmiato)

**Interfaccia:**
```
+----------------------------------------------------------+
| Log Attivita'                                             |
| Filtri: [Tutti ▾] [Tutte le date ▾] [Tutti gli utenti ▾]|
+----------------------------------------------------------+
| 23/03/2026 15:30 | Marco | Conversione                   |
| 12 file → WebP Q80 | Profilo: Pizzeria Mario            |
| Risparmiati: 45 MB (-89%)                                |
|----------------------------------------------------------|
| 23/03/2026 14:15 | Laura | Watermark                     |
| 8 file → Logo 30% basso-dx                              |
|----------------------------------------------------------|
| 22/03/2026 11:00 | Marco | Conversione                   |
| 25 file → AVIF Q75 | Profilo: E-commerce Moda           |
| Risparmiati: 120 MB (-94%)                               |
+----------------------------------------------------------+
| [Esporta CSV] [Pulisci Log]                              |
+----------------------------------------------------------+
```

**Storage:** SQLite locale, con opzione di esportare come CSV.

### Template Social Media

Dimensioni e layout predefiniti per tutti i social.

**Preset per piattaforma:**

| Piattaforma | Tipo | Dimensione |
|------------|------|-----------|
| **Instagram** | Post quadrato | 1080x1080 |
| | Post verticale | 1080x1350 |
| | Story/Reel | 1080x1920 |
| | Profilo | 320x320 |
| **Facebook** | Post | 1200x630 |
| | Cover | 820x312 |
| | Evento | 1920x1005 |
| | Profilo | 170x170 |
| **Twitter/X** | Post | 1200x675 |
| | Header | 1500x500 |
| | Profilo | 400x400 |
| **LinkedIn** | Post | 1200x627 |
| | Banner | 1584x396 |
| | Profilo | 400x400 |
| **YouTube** | Thumbnail | 1280x720 |
| | Banner | 2560x1440 |
| **Pinterest** | Pin | 1000x1500 |
| **TikTok** | Video cover | 1080x1920 |
| **WhatsApp** | Profilo | 640x640 |
| **Telegram** | Sticker | 512x512 |

**Template con zone:**
- Zone predefinite per posizionare testo e logo
- Applicazione colori e font dal Brand Kit
- Batch: genera stessa immagine per tutti i social in un click

### Multi-Lingua

Supporto multilingua per l'intera interfaccia.

**Lingue:**
| Lingua | Codice | Stato |
|--------|--------|-------|
| Italiano | it | Default |
| English | en | P1 |
| Deutsch | de | P2 |
| Francais | fr | P2 |
| Espanol | es | P3 |

**Implementazione:**
- File JSON per ogni lingua: `locales/it.json`, `locales/en.json`, ecc.
- Struttura chiave-valore con namespace per modulo
- Selezione lingua nelle Settings
- Auto-detect lingua di sistema all'avvio

**Esempio `locales/it.json`:**
```json
{
  "home": {
    "title": "Cosa vuoi fare?",
    "search": "Cerca moduli..."
  },
  "optimize": {
    "title": "Ottimizza Immagini",
    "quality": "Qualita'",
    "convert": "CONVERTI",
    "scanning": "Scansione in corso..."
  }
}
```

---

## Implementazione Tecnica

| Feature | Tecnologia | Complessita' |
|---------|-----------|-------------|
| Brand Kit | JSON config + file assets in cartella | Media |
| Profili condivisi | File JSON su path condiviso + file watcher | Media |
| Log attivita' | SQLite (`rusqlite` crate) | Media |
| Template social | Preset dimensioni + canvas rendering | Media |
| Multi-lingua | `i18next` (frontend) + JSON files | Bassa |

## Presente Vs Roadmap

### Presente

- Nessun sistema collaborativo e nessun brand kit sono pronti nel codice attuale.
- La suite oggi vive sul modulo optimize e sulla sua base backend.

### Roadmap

- Brand kit con asset condivisi.
- Profili condivisi tra colleghi.
- Log attivita' locale.
- Template social e localizzazione.
