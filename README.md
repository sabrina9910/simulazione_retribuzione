# RAL → Netto (Milano) — Prototipo

Demo: https://sabrina9910.github.io/simulazione_retribuzione/  
Repo: https://github.com/sabrina9910/simulazione_retribuzione

Calcolatore (didattico) che stima **netto annuo** e **netto mensile** a partire dalla RAL e mostra il breakdown: INPS lavoratore, IRPEF (lorda/netta) e addizionali (regionale + comunale).

> Disclaimer: calcolo annuale semplificato; il netto reale può variare per conguagli, mensilità, detrazioni effettive e altre componenti.

## Come provarlo
- Clicca **Carica esempio**
- Vai nella tab **Metodo** (formule + rounding)
- Apri **Fonti** (parametri + link)

## Run locale
```bash
python -m http.server 8000


==========================================================================================================================================

## Logica dei JSON (composizione a livelli)

L’idea è **comporre** i parametri finali come somma di più livelli, così puoi aggiornare singole parti (nazionale / regione / comune) senza toccare tutto.

### 1) `national.json`
Contiene le **regole comuni Italia**, ad esempio:
- rounding (policy + decimali)
- scaglioni IRPEF
- detrazione lavoro dipendente (prototipo)
- INPS extra (soglia + aliquota)

Nota: nei JSON lo scaglione “senza limite” è rappresentato con `upTo: null` (nel codice JS verrà interpretato come `Infinity`).

### 2) `addreg/<regione>.json`
Contiene **solo** l’addizionale regionale della regione scelta:
- `method` (tipo di calcolo)
- soglie/aliquote/detrazioni regionali (se previste)

### 3) `addcom/<prov>/<comune-codice>.json`
Contiene **solo** l’addizionale comunale del comune scelto:
- `rate` (aliquota)
- `exemptionThreshold` (soglia di esenzione)
- modalità soglia: `franchigia` oppure `notch`
- metadati del comune (nome, provincia, codice catastale)

### `profiles.json` (indice dei profili)
`profiles.json` è un file “indice”: un `profileId` (es. `it-2026-milano`) punta ai 2 file territoriali corretti:
- `addregRef` → file regionale
- `addcomRef` → file comunale

### Merge (in futuro)
Quando (in futuro) verranno caricati a runtime, l’idea è un merge con questa priorità:
**national < addreg < addcom** (ed eventuali override utente per ultimi).

---

## Come ho trovato/organizzato i dati (in pratica)

- Ho separato i parametri per **Nazione / Regione / Comune** perché hanno frequenza di aggiornamento diversa e così i diff su GitHub restano piccoli e facili da revisionare.
- Nei file dove un dato non è ancora verificato/definitivo uso `null` + un campo `note` o `lookup` per ricordare cosa completare (nei JSON non uso commenti).
- `schemaVersion` e `lastUpdated` servono per tenere traccia dell’evoluzione dello schema e delle modifiche nel tempo.
