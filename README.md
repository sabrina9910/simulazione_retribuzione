# 💰 Simulazione RAL → Netto Italia 2026  


![Live Demo](https://sabrina9910.github.io/simulazione_retribuzione/)

Questo progetto è un **prototipo web interattivo** che simula la proiezione di **retribuzione netta annuale** partendo da una **Retribuzione Annua Lorda (RAL)**, mostrando tutte le principali voci trattenute in busta paga (INPS, IRPEF, addizionali, detrazioni).

> Il prototipo è pensato per aiutare **candidati, HR e recruiter** a capire in modo semplice e trasparente il passaggio da lordo a netto in un caso standard italiano 2026.

---

## 🎯 Obiettivo del progetto

Lo scopo è rispondere in modo visibile e immediato alla domanda:

> **“Se la RAL è X, quanto percepisco realmente in busta paga in un anno e al mese?”**

In contesti come colloqui, offerte di lavoro o dashboard HR, questo calcolo aiuta a:

- spiegare la vera “dimensione” di uno stipendio;
- confrontare proposte economiche in modo più accurato;
- far capire al candidato quanto resta realmente della RAL.

---

## 🧠 Contesto e assunzioni

Il dominio fiscale italiano è complesso e variabile.  
Per questo esercizio ho scelto un **caso semplice e standard**, con le seguenti assunzioni:

- Dipendente **impiegato a tempo indeterminato** nel settore privato.  
- Dipendente **residente e lavorante a Milano (Lombardia)**.  
- **Nessuna agevolazione particolare** (niente figli, prima casa, detrazioni complesse, ecc.).  
- Altri casi particolari (TFR, conguagli, premi, assenze, ecc.) **non sono coperti**: il calcolo è un modello semplificato a scopo didattico e di prototipo.

Non è un sostituto di un sistema fiscale professionale, ma un **motore di simulazione trasparente e controllabile**.

---

## 📚 Logica di calcolo (modello 2026)

Il calcolo segue un flusso standard:

1. **Dal lordo al tassabile**  
   - Deduce i contributi INPS a carico del lavoratore (circa 9,19% della RAL, entro il massimale di contribuzione).

2. **Calcolo IRPEF lorda 2026**  
   - Applica gli scaglioni IRPEF 2026:
     - fino a 28.000 € → 23%  
     - 28.001–50.000 € → 33%  
     - oltre 50.000 € → 43%.

3. **Detrazione lavoro dipendente**  
   - Applica una detrazione standard per lavoro dipendente, che riduce l’IRPEF dovuta in base alla RAL.

4. **Addizionali locali**  
   - Aggiunge:
     - **addizionale regionale Lombardia**;
     - **addizionale comunale Milano**.

5. **Netto annuo → netto mensile**  
   - Divide il netto annuo in 12 mensilità (opzionalmente 13, se supportato nell’interfaccia).

---

## 🧩 Funzionalità principali

Il risultato è una **pagina web statica unica** dove:

- L’utente inserisce una **RAL** (es. 30.000 €, 40.000 €, 60.000 €).  
- Clicca **“Calcola”**.  
- Vede in pagina:
  - **Netto annuale** stimato.  
  - **Netto mensile** (12 mensilità).  
  - **Breakdown delle trattenute**:
    - contributi INPS;  
    - IRPEF lorda / netta;  
    - detrazione lavoro dipendente;  
    - addizionale regionale Lombardia;  
    - addizionale comunale Milano.

Il calcolo è eseguito lato client in JavaScript, senza dipendenze esterne.

---

## 🏗 Architettura del progetto

Il progetto è pensato come calcolatore semplice, modulare e testabile:

- **Frontend**: HTML5 + CSS3 + JavaScript (ES Modules), zero framework.  
- **Motore di calcolo** (`tax.js`):  
  - Funzioni pure (`computeNetto`, `calcInps`, `calcIrpefLorda2026`, ecc.).  
  - Nessun accesso al DOM, quindi facilmente testabile e riutilizzabile.  
- **Controller UI** (`app.js`):  
  - Legge l’input, chiama il motore fiscale e aggiorna la pagina con i risultati.  
- **Dati di configurazione**:  
  - JSON con aliquote 2026, scaglioni IRPEF, detrazioni e addizionali (nazionale, regionale, comunale), facilmente aggiornabili anno per anno.

Questa struttura:

- separa modello da presentazione;  
- facilita il testing delle formule;  
- permette di aggiungere nuove regioni o casi senza riscrivere l’UI.

---

## 🚀 Come usare il prototipo

1. **Apri online**  
   - La demo è ospitata su GitHub Pages:  
     [https://sabrina9910.github.io/simulazione_retribuzione/](https://sabrina9910.github.io/simulazione_retribuzione/)

2. **In locale**  
   - Scarica o clona il repository.  
   - Apri `index.html` nel browser (doppio click o trascina nel browser).  
   - Se il browser blocca i moduli ES6 da file locale, avvia un server semplice:
     ```bash
     python -m http.server 8000
     ```
     oppure
     ```bash
     npx -y serve .
     ```
   - Poi apri `http://localhost:8000`.

---

## ⚠️ Disclaimer

Il calcolo è **semplificato e deterministico**, pensato per scopi didattici e di portfolio.  
Il netto reale può variare in base a:

- conguagli, premi, TFR, assenze e altri fattori;  
- eventuali agevolazioni fiscali non considerate qui.

---

<p align="center">
  <em>Realizzato come esercizio di product building per Jet HR Inbox, per dimostrare competenze in ricerca, modellazione del dominio, architettura dati e sviluppo front‑end.</em>
</p>
