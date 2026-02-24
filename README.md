# RAL → Netto (Milano) — Prototipo

Demo: <DEMO_URL>
Repo: <REPO_URL>

Calcolatore che stima netto annuo e mensile da RAL e mostra INPS lavoratore, IRPEF (lorda/netta) e addizionali (Lombardia/Milano).
Disclaimer: calcolo annuale semplificato; il netto reale può variare mese per mese.

## Come provarlo
Apri la demo e clicca:
- “Carica esempio”
- “Apri fonti” (parametri + link)
- tab “Metodo” (formule e rounding)

## Run locale (se serve)
`python -m http.server 8000` → http://localhost:8000

## Trade-off: perché NON ho messo un file JSON di config
Avrei potuto spostare i parametri (aliquote, soglie, link fonti) in un file JSON esterno e caricarlo a runtime.  
Ho scelto di NON farlo in questo prototipo per mantenere la demo più semplice e robusta (meno moving parts, meno rischi di bug di caricamento su hosting statico).

### A cosa servirebbe (se lo implementassi)
- Aggiornare i parametri per anno (es. 2027) senza toccare la logica di calcolo.
- Rendere più chiaro il versioning dei parametri (diff su GitHub).
- Supportare più comuni/regioni/anni selezionando un “profilo” di parametri.