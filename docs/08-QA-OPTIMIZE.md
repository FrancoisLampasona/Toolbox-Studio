# QA Optimize

## Milestone

Milestone di riferimento: `Stabilizzare Optimize`.

## Checklist Stato

- [x] La dashboard Home apre `Ottimizza Immagini` con routing reale
- [x] La scansione parte da metadata e riempie le miniature in modo progressivo
- [x] La conversione batch usa output esplicito e report CSV
- [x] I profili locali del modulo esistono e si possono salvare, aggiornare ed eliminare
- [x] I profili locali del modulo si possono anche esportare e importare in JSON
- [x] Il naming pattern e la preview output sono integrati nel pannello destro
- [x] Il naming collision-safe finale chiude le collisioni con suffissi deterministici
- [x] Import/export JSON dei profili e collision handling dei nomi sono disponibili
- [x] La virtualizzazione reale della griglia e' attiva sopra la soglia batch grande
- [x] Esistono test backend mirati per collision-safe naming e import/export profili
- [ ] Smoke test manuale macOS completato sul batch reale

## Smoke Matrix

| Scenario | Cosa verificare | Stato attuale |
|----------|-----------------|---------------|
| Avvio app | Home dashboard centrata visibile, card modulo con accent bar e gradient text senza glitch | Coperto dal codice |
| Home -> Optimize | Click sulla card e drop sulla card aprono il modulo e passano i path una sola volta | Coperto dal codice |
| Batch piccolo | Scan, preview, selezione, convert e summary restano fluidi | Coperto dal codice |
| Batch grande 100-150 immagini | Scroll fluida, toolbar stabile, miniature non bloccano la UI | Coperto dal codice, serve smoke reale |
| Naming pattern | Preview aggiornata e token base applicati al nome output | Coperto dal codice |
| Collisioni output | Due operazioni che convergono sullo stesso nome non collidono nello stesso run | Coperto dal codice |
| Profili locali | Salvataggio, aggiornamento ed eliminazione funzionano senza perdere il resto dello stato | Coperto dal codice |
| Import/export profili | JSON import/export da pannello destro e collision handling dei nomi | Coperto dal codice |
| HEIC su macOS | Aggiunta e conversione file HEIC/HEIF funzionano su macOS | Coperto dal codice |
| File non supportati | L'errore resta per-item e non blocca l'intero batch | Coperto dal codice |
| Report CSV | Export del report dal summary scrive un file valido | Coperto dal codice |

## Verifica Automatica

- [x] `cargo test` verde con test unitari su collision-safe naming e bundle profili JSON
- [x] `cargo check` verde
- [x] `npm run build` verde

## Criteri Di Uscita

- `npm run build` verde
- `cargo check` verde
- smoke test manuale su macOS senza crash o regressioni visive
- collisioni output risolte in modo deterministico nel run
- profili esportabili/importabili dal modulo optimize
- griglia stabile su batch grandi

## Note

- `WordPress Media` e` ora il secondo modulo reale della suite; questa checklist resta dedicata solo a optimize.
- Questa checklist descrive il perimetro di verifica del modulo optimize, non la roadmap completa della suite.
