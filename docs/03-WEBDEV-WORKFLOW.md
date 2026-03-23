# Modulo: Workflow & Automazione

> **Card Home**: Icona ingranaggio | "Automazione" | "Watch folder, profili, batch rename"

---

## Checklist Stato

- [x] Il modulo e' definito come area suite per automazioni e workflow ripetitivi
- [x] Esiste gia' una base concreta nel modulo immagini: summary batch + export CSV
- [-] Drag & drop base presente su Home optimize e modulo optimize, ma non ancora universale a livello app
- [-] Profili locali salvabili sono disponibili in optimize e WordPress Media; import/export JSON e naming pattern sono gia' attivi, mentre watch folder, batch rename e automazione dedicata restano roadmap
- [-] Naming pattern e batch rename base sono disponibili nel modulo optimize, ma manca ancora un flusso dedicato di rinomina avanzata
- [x] Import/export JSON dei profili e' disponibile nel modulo optimize
- [x] Virtualizzazione reale della griglia e' attiva nel modulo optimize
- [ ] CLI mode e upload FTP/SFTP non sono ancora presenti
- [ ] Persistenza strutturata e sincronizzazione profili non sono ancora disponibili

## Descrizione

Modulo per automatizzare e velocizzare il lavoro ripetitivo. Watch folder per conversione automatica, profili salvabili per cliente/progetto, batch rename intelligente, report esportabili e integrazione con pipeline di sviluppo.

## Stato Reale Oggi

- Il prodotto oggi non espone ancora questo modulo come esperienza funzionante.
- La direzione e' chiara, ma la base attuale resta concentrata sul modulo immagini e sulla shell minima della suite appena introdotta.
- Una parte del terreno e' gia' pronta: optimize e WordPress Media hanno summary batch, export CSV e profili locali, quindi il filone reportistica/workflow non parte piu' da zero.
- Anche la rinomina batch non parte piu' da zero: optimize espone un naming pattern con preview e token base, e oggi risolve anche le collisioni deterministiche nello stesso run.
- Anche il drag & drop ha ora una base concreta nel prodotto reale, ma limitata al percorso Home optimize + modulo optimize.
- Le funzionalita' qui sotto vanno lette come blocchi di implementazione successivi, da agganciare quando la base modulare sara' stabile.
- `WordPress Media`, `Srcset Generator` e `Favicon Generator` esistono ora come moduli reali della suite; il prossimo modulo dopo questo step diventa `Social Media Images`.

---

## Feature

### Drag & Drop Universale

Supporto drag & drop nativo in tutta l'app.

- **Sulla Home**: trascina file/cartelle su una card specifica → entra nel modulo con quei file gia' caricati
- **Nel modulo**: trascina nella griglia immagini per aggiungerle
- **Multi-selezione**: trascina piu' file/cartelle insieme
- Animazione visiva: la card si illumina quando ci passi sopra con il drop

**Implementazione:** Tauri `ondragdrop` event + gestione path files.

### Watch Folder (Hot Folder)

Cartella sorvegliata che processa automaticamente i file appena vengono aggiunti.

**Configurazione:**
```
+------------------------------------------+
| Watch Folder                              |
|                                          |
| Cartella: [/Users/me/Da-convertire] [...]|
| Output:   [/Users/me/Convertite]    [...]|
| Profilo:  [Pizzeria Mario ▾]            |
|                                          |
| [x] Attivo    [ ] Processa sottocartelle |
| [x] Notifica desktop al completamento   |
| [ ] Sposta originali in "Processati"    |
|                                          |
| Stato: In ascolto... (0 file in coda)   |
| Ultimo: hero.jpg → 3 varianti (2s fa)  |
+------------------------------------------+
```

**Comportamento:**
1. L'utente configura cartella sorgente + profilo di conversione
2. L'app monitora la cartella in background (filesystem watcher)
3. Quando un nuovo file appare, viene processato automaticamente col profilo scelto
4. Notifica desktop: "Convertito hero.jpg → 3 file (risparmio 85%)"
5. Opzionalmente sposta gli originali in una sottocartella "Processati"

**Use case tipico:** Fotografo scarica foto da camera → salva in cartella sorvegliata → automaticamente ottimizzate per il web.

### Profili Salvabili per Cliente/Progetto

Salva combinazioni complete di impostazioni come profili riutilizzabili.

Primo step reale gia' disponibile nel prodotto: il modulo `optimize` salva profili locali nel file impostazioni dell'app, e permette di applicarli, aggiornarli, eliminarli ed esportarli/importarli in JSON dal pannello destro. Restano roadmap le note e la condivisione tra colleghi.

**Un profilo contiene:**
- Nome progetto/cliente (es. "Pizzeria Mario")
- Lista preset dimensionali attivi
- Formato output (WebP/AVIF/JPEG/PNG)
- Quality
- Resize mode (Cover/Fit)
- Naming pattern
- Cartella output personalizzata (opzionale)
- Note/appunti

**Interfaccia:**
```
+------------------------------------------+
| Profili Salvati                           |
|                                          |
| [Pizzeria Mario]     Hero+Product  WebP  |
| [E-commerce Moda]    WooCommerce   AVIF  |
| [Blog Viaggi]        Blog+Thumb    WebP  |
| [Default Web]        Responsive    WebP  |
|                                          |
| [+ Nuovo Profilo] [Importa JSON]        |
+------------------------------------------+
```

**Import/Export:**
- Esporta profilo come file `.toolbox-profile.json`
- Importa profili da file o da URL
- Condividi profili con colleghi (vedi modulo Collaborazione)

**Stato reale del primo step:** oggi il modulo `optimize` salva gia' il naming pattern dentro i profili locali, quindi output path e regole di naming possono essere riusati insieme.
**Stato del secondo step:** import/export JSON e sincronizzazione profili sono ora disponibili; il passo successivo riguarda solo affinamenti di workflow e moduli nuovi.

### Batch Rename

Rinomina i file in batch con pattern intelligenti.

**Pattern con variabili:**
```
Pattern: {slug}-{w}x{h}
Preview: foto-ristorante-1920x600.webp
         menu-pranzo-600x600.webp
         team-chef-150x150.webp
```

**Variabili disponibili:**
| Variabile | Descrizione | Esempio |
|-----------|-------------|---------|
| `{nome}` | Nome originale | IMG_2847 |
| `{slug}` | Nome slugificato | foto-ristorante |
| `{w}` / `{h}` | Dimensioni | 1920 / 600 |
| `{formato}` | Estensione | webp |
| `{data}` | Data corrente | 2026-03-23 |
| `{n}` | Contatore | 001, 002, 003 |
| `{progetto}` | Nome dal profilo | pizzeria-mario |
| `{componente}` | Nome preset | hero |

**Funzioni di trasformazione:**
- **Slugify**: rimuove spazi, accenti, caratteri speciali → kebab-case
- **Lowercase**: tutto minuscolo
- **Contatore**: numera progressivamente i file

**Preview live**: tabella che mostra nome originale → nome risultante per ogni file, prima di applicare.

### Export Report

Genera report esportabili dopo ogni batch di conversione.

**Formato CSV:**
```csv
File Originale,Dimensioni Orig,Peso Orig,Preset,Formato,Dimensioni Output,Peso Output,Risparmio %
hero.jpg,4000x3000,3.2 MB,Hero Banner,WebP,1920x600,120 KB,96.3%
hero.jpg,4000x3000,3.2 MB,Hero Mobile,WebP,768x400,45 KB,98.6%
product1.png,2400x2400,5.1 MB,Product,AVIF,600x600,35 KB,99.3%
```

**Formato PDF:**
- Header: logo progetto + data + nome profilo usato
- Tabella riepilogativa con tutte le conversioni
- Grafico a torta: risparmio totale (MB risparmiati vs originali)
- Grafico a barre: confronto peso per file
- Footer: totali (N file, X MB risparmiati, Y% medio)

### CLI Mode

Interfaccia command-line per automazione e integrazione con build scripts.

**Comandi:**
```bash
# Converti con profilo salvato
convertitore convert --profile "Pizzeria Mario" --input ./foto --output ./dist/img

# Converti con opzioni inline
convertitore convert --input ./foto --format webp --quality 80 --preset hero,product

# Lista profili disponibili
convertitore profiles list

# Genera report
convertitore report --input ./dist/img --format csv --output report.csv

# Watch mode
convertitore watch --folder ./incoming --profile "Default Web"
```

**Output JSON** per parsing automatico:
```json
{
  "total_files": 12,
  "successful": 12,
  "failed": 0,
  "total_input_size": 52428800,
  "total_output_size": 2621440,
  "savings_percent": 95.0
}
```

**Integrazione npm scripts:**
```json
{
  "scripts": {
    "images": "convertitore convert --profile web --input src/img --output dist/img",
    "build": "npm run images && vite build"
  }
}
```

### FTP/SFTP Upload Diretto

Dopo la conversione, upload diretto al server del cliente.

**Configurazione nel profilo:**
```
+------------------------------------------+
| Upload Server                             |
|                                          |
| Protocollo: [SFTP ▾]                    |
| Host: [ftp.pizzeria-mario.it]           |
| Porta: [22]                              |
| Utente: [deploy]                         |
| Auth: [Chiave SSH ▾]                    |
| Chiave: [~/.ssh/id_rsa]                |
|                                          |
| Cartella remota:                         |
| [/var/www/html/wp-content/uploads/]     |
|                                          |
| [x] Crea sottocartella anno/mese        |
|     (es. /uploads/2026/03/)             |
| [ ] Sovrascrivi file esistenti          |
| [Test Connessione] [Salva nel Profilo]  |
+------------------------------------------+
```

**Post-conversione:**
- Bottone "Upload al server" appare dopo la conversione
- Progress bar per upload
- Report: N file caricati, X MB trasferiti
- Errori con retry automatico

---

## Implementazione Tecnica

| Feature | Crate/Lib | Complessita' |
|---------|-----------|-------------|
| Drag & Drop | Tauri `ondragdrop` | Parziale |
| Watch Folder | `notify` crate (filesystem watcher) | Roadmap |
| Profili | `serde_json` in `settings.json` locale + export/import JSON | Parziale |
| Batch Rename | String template + token naming | Parziale |
| Export CSV | `csv` crate | Implementato in optimize |
| Export PDF | `printpdf` o `genpdf` crate | Roadmap |
| CLI Mode | `clap` crate | Roadmap |
| FTP/SFTP | `ssh2` crate + `suppaftp` crate | Roadmap |
