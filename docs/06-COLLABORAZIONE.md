# Modulo: Team & Brand

> **Card Home**: Icona persone | "Team & Brand" | "Profili condivisi, brand kit, log"

---

## Stato Reale Oggi

- [x] La base `Toolbox Creative Studio` con il modulo `optimize` e' gia' la fondazione reale del progetto.
- [x] I profili locali esistono gia' nel modulo `optimize`, ma restano solo locali.
- [x] I profili locali ora sono anche esportabili/importabili in JSON, base utile per la futura condivisione.
- [x] `Social Media Images` e' gia' un modulo reale della suite e copre i template social multi-piattaforma.
- [x] `Team & Brand` e' ora implementato come modulo operativo della suite.
- [x] Esiste un primo layer reale di brand kit locali con CRUD e persistenza minima.
- [ ] Profili condivisi, log attivita' e localizzazione reale restano non implementati.
- [-] Il documento ora descrive sia il layer brand gia' reale sia la parte collaborativa ancora futura.

## Checklist Di Avanzamento

- [x] Separata la visione collaborativa dal prodotto attuale.
- [x] Mantenuta la coerenza con il naming Toolbox Creative Studio.
- [x] Distinti profili locali gia' esistenti da profili condivisi ancora futuri.
- [x] Definito lo storage minimo per brand kit locali.
- [x] Stabilito il primo perimetro condivisibile: palette, font, logo, icona e watermark.
- [ ] Progettare log attivita' e multi-lingua senza appesantire la suite iniziale.

---

## Descrizione

Funzionalita' per l'uso aziendale multi-utente. Oggi il primo passo reale esiste: `Team & Brand` e' un modulo live con brand kit locali, e `Social Media Images` puo' gia' consumarli come sorgente automatica di base. Restano invece future la condivisione vera multiutente, i log e la localizzazione.

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
- **Social Media Images**: oggi usa preset locali e zone di layout; domani eredita colori, font e logo dal brand kit
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

Dimensioni e layout predefiniti per tutti i social. Questa parte e' oggi un modulo reale della suite (`Social Media Images`): qui documentiamo il ponte con il futuro Brand Kit, non una semplice idea roadmap.

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
- Il modulo reale usa gia' preset locali e naming coerente; il Brand Kit futuro servira' a sostituire i valori hardcoded con token condivisi.

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
- La suite oggi vive sui moduli `optimize` e `Social Media Images`, con una base backend condivisa.
- Il modulo social esiste gia' come esperienza reale; il brand kit e la collaborazione dovranno alimentarlo in un secondo passaggio.

### Roadmap

- Brand kit con asset condivisi.
- Profili condivisi tra colleghi.
- Log attivita' locale.
- Integrazione profonda dei template social con il brand kit.
- Localizzazione reale.
