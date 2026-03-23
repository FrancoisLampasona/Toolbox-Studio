# Modulo: Batch Rename

> **Card Home**: Icona R | "Batch Rename" | "Preview naming, collisioni sicure e rinomina in-place"

---

## Checklist Stato

- [x] `Batch Rename` esiste come modulo reale della suite
- [x] Il modulo riusa la scansione immagini e la griglia gia' presenti negli altri workflow
- [x] Il pattern naming viene persistito nello storage leggero dell'app
- [x] Il contatore iniziale viene persistito nello storage leggero dell'app
- [x] L'anteprima naming viene generata davvero dal backend, non simulata solo in UI
- [x] Le collisioni nello stesso batch vengono risolte con suffissi `-001`, `-002`, ecc.
- [x] La rinomina applica un passaggio temporaneo per evitare conflitti tra file dello stesso batch
- [ ] Token avanzati, supporto file non-image e report dedicato della rinomina restano roadmap

## Descrizione

Modulo dedicato alla rinomina batch degli asset. L'obiettivo non e' solo cambiare il nome dei file, ma rendere prevedibile il naming di progetto: pattern coerenti, preview immediata, collisioni gestite e rinomina sicura sul filesystem.

## Stato Reale Oggi

- Il modulo e' gia' raggiungibile dalla Home della suite.
- Carica file o cartelle usando la stessa pipeline di scan del resto dell'app.
- Mostra un'anteprima reale del mapping `nome originale -> nome finale`.
- Rinomina i file **in-place** nella loro cartella attuale.
- Mantiene la selezione, l'anteprima e il batch aggiornati anche dopo la rinomina riuscita.

## Feature

### Preview Naming

Il modulo invia al backend la lista file selezionata, il pattern e il contatore iniziale. Il backend restituisce una preview gia' risolta, inclusi eventuali suffissi per collisione.

**Token base supportati oggi:**

| Token | Significato |
|------|-------------|
| `{nome}` | nome file originale senza estensione |
| `{slug}` | slug del nome originale |
| `{w}` / `{h}` | dimensioni immagine |
| `{formato}` | estensione corrente |
| `{n}` | contatore progressivo |

### Collision Handling

Se due file convergono sullo stesso nome finale:

1. il primo usa il nome desiderato
2. i successivi ricevono `-001`, `-002`, ecc.
3. la preview mostra gia' il nome finale risolto

### Rinomina Sicura

L'applicazione della rinomina usa un passaggio intermedio su nomi temporanei locali, cosi' evita conflitti quando due file dello stesso batch si scambiano o si sovrappongono nei nomi finali.

## Limiti Del Primo Cut

- Modulo orientato alle immagini supportate dalla suite, non ancora a file arbitrari.
- Nessun export CSV/PDF dedicato della rinomina.
- Nessun token avanzato come cartella, data o metadati EXIF.
- Nessuna modalita' `dry-run` da CLI.

## Prossimi Step

- [ ] Token avanzati (`{cartella}`, `{data}`, `{profilo}`, ecc.)
- [ ] Report dedicato della rinomina
- [ ] Supporto file non-image
- [ ] Preset naming salvabili e condivisibili
- [ ] Integrazione piu' profonda con `Automazione`
