/**
 * @file tax.js — Motore di calcolo fiscale (RAL → Netto Italia 2026)
 *
 * Contiene tutte le funzioni di calcolo PURE (senza accesso al DOM).
 * Ogni funzione prende numeri in input e ritorna numeri in output,
 * il che le rende facilmente testabili in isolamento.
 *
 * Flusso di calcolo:
 *   RAL → INPS → Imponibile IRPEF → IRPEF lorda → Detrazione →
 *   IRPEF netta → Addizionali → Netto annuo → Netto mensile
 */

// ─────────────────────────────────────────────────────────
//  PARAMETRI FISCALI 2026 (hardcoded per il prototipo)
// ─────────────────────────────────────────────────────────

/**
 * Parametri fiscali Italia 2026 usati dal calcolatore.
 * In futuro verranno caricati a runtime dai JSON in parameters(2026)/.
 *
 * @type {Object}
 * @property {number} year - Anno fiscale di riferimento
 * @property {Object} rounding - Policy di arrotondamento (centesimi dopo ogni step)
 * @property {Object} irpef - Scaglioni IRPEF con aliquote marginali
 * @property {Object} detrazioneLavDip - Detrazione lavoro dipendente (Art. 13 TUIR)
 * @property {Object} addRegionaleLombardia - Addizionale regionale Lombardia
 * @property {Object} addComunaleMilano - Addizionale comunale Milano
 * @property {Object} inpsExtra - Contributo INPS aggiuntivo 1% oltre soglia
 * @property {Object} sources - Link alle fonti ufficiali di ogni parametro
 */
export const PARAMS = {
    year: 2026,

    rounding: {
        policy: "ROUND_EACH_STEP",
        decimals: 2
    },

    irpef: {
        brackets: [
            { upTo: 28000, rate: 0.23 },
            { upTo: 50000, rate: 0.33 },
            { upTo: Infinity, rate: 0.43 }
        ]
    },

    detrazioneLavDip: {
        // Versione annualizzata (prototipo)
        // Fasce come da schema divulgativo più comune:
        // <= 15k: 1955
        // 15k-28k: 1910 + 1190 * (28000 - R)/13000
        // 28k-50k: 1910 * (50000 - R)/22000
        // > 50k: 0
        extra65: { from: 25000, to: 35000, value: 65 }
    },

    addRegionaleLombardia: {
        threshold: 28000,
        rateLow: 0.0173,
        rateHigh: 0.0333,
        detrazione: { from: 28001, to: 30000, value: 60 }
    },

    addComunaleMilano: {
        threshold: 23000,
        rate: 0.008
    },

    inpsExtra: {
        threshold: 56224,
        rate: 0.01
    },

    sources: {
        irpef: "https://www.informazionefiscale.it/IRPEF-scaglioni-aliquote-calcolo",
        addRegLombardia: "https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/addregirpef.php?reg=08",
        addComMEF: "https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/risultato.htm",
        addComGlossario: "https://www.coverflex.com/it/glossario-retribuzione/addizionale-comunale",
        inps: "https://www.inps.it/it/it/inps-comunica/notizie/dettaglio-news-page.news.2026.02.lavoratori-dipendenti-limite-minimo-di-retribuz.html"
    }
};

// ─────────────────────────────────────────────────────────
//  UTILITY
// ─────────────────────────────────────────────────────────

/**
 * Limita un numero all'intervallo [min, max].
 *
 * @param {number} n - Valore da limitare
 * @param {number} min - Limite inferiore
 * @param {number} max - Limite superiore
 * @returns {number} Il valore "clampato"
 *
 * @example
 * clamp(0.5, 0, 0.3)  // → 0.3
 * clamp(-5, 0, 100)    // → 0
 */
export function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}

/**
 * Arrotonda un numero a 2 decimali (centesimi di euro).
 * Usa la policy configurata in PARAMS.rounding.decimals.
 *
 * @param {number} n - Importo da arrotondare
 * @returns {number} Importo arrotondato
 *
 * @example
 * round2(1234.5678)  // → 1234.57
 */
export function round2(n) {
    const x = Number(n);
    const factor = 10 ** PARAMS.rounding.decimals;
    return Math.round((x + Number.EPSILON) * factor) / factor;
}

// ─────────────────────────────────────────────────────────
//  CALCOLI SINGOLI
// ─────────────────────────────────────────────────────────

/**
 * Calcola il contributo INPS lavoratore (9,19% standard + eventuale 1% extra).
 *
 * Il contributo extra dell'1% si applica sulla quota di RAL che eccede
 * la soglia (56.224€ nel 2026). Può essere disattivato dall'utente.
 *
 * @param {Object} params
 * @param {number} params.ral - Retribuzione Annua Lorda
 * @param {number} params.inpsRate - Aliquota INPS base (es. 0.0919 = 9,19%)
 * @param {boolean} [params.applyExtra1Pct=true] - Se applicare l'1% extra oltre soglia
 * @returns {number} Contributo INPS totale (NON arrotondato — chi chiama arrotonda)
 */
export function calcInps({ ral, inpsRate, applyExtra1Pct = true }) {
    const R = Math.max(0, Number(ral));
    const baseRate = clamp(Number(inpsRate ?? 0), 0, 0.3);
    const base = R * baseRate;

    if (!applyExtra1Pct) return base;

    const extraBase = Math.max(0, R - PARAMS.inpsExtra.threshold);
    const extra = extraBase * PARAMS.inpsExtra.rate;

    return base + extra;
}

/**
 * Calcola l'IRPEF lorda 2026 con scaglioni a aliquote marginali.
 *
 * Scaglioni 2026:
 *   - fino a 28.000€   → 23%
 *   - 28.001 – 50.000€ → 33%
 *   - oltre 50.000€    → 43%
 *
 * @param {number} imponibile - Reddito imponibile IRPEF (RAL − INPS)
 * @returns {number} IRPEF lorda calcolata per scaglioni
 *
 * @example
 * calcIrpefLorda2026(35000)  // → 28000*0.23 + 7000*0.33 = 8750
 */
export function calcIrpefLorda2026(imponibile) {
    const x = Math.max(0, Number(imponibile));
    const b = PARAMS.irpef.brackets;

    const s1 = b[0].upTo; // 28000
    const s2 = b[1].upTo; // 50000

    let tax = 0;

    if (x <= s1) return x * b[0].rate;
    tax += s1 * b[0].rate;

    if (x <= s2) return tax + (x - s1) * b[1].rate;
    tax += (s2 - s1) * b[1].rate;

    return tax + (x - s2) * b[2].rate;
}

/**
 * Calcola la detrazione per lavoro dipendente (Art. 13 TUIR — versione annualizzata).
 *
 * La detrazione decresce con l'aumentare del reddito e si azzera sopra 50.000€.
 * Tra 25.000€ e 35.000€ si aggiunge un bonus fisso di 65€.
 *
 * @param {number} reddito - Reddito imponibile IRPEF
 * @returns {number} Importo della detrazione (≥ 0)
 */
export function calcDetrazioneLavoroDipendente(reddito) {
    const R = Math.max(0, Number(reddito));
    let det = 0;

    if (R <= 15000) {
        det = 1955;
    } else if (R <= 28000) {
        det = 1910 + 1190 * ((28000 - R) / 13000);
    } else if (R <= 50000) {
        det = 1910 * ((50000 - R) / 22000);
    } else {
        det = 0;
    }

    const ex = PARAMS.detrazioneLavDip.extra65;
    if (R >= ex.from && R <= ex.to) det += ex.value;

    return Math.max(0, det);
}

/**
 * Calcola l'addizionale regionale IRPEF per la Lombardia.
 *
 * Due aliquote:
 *   - ≤ 28.000€ → 1,73%
 *   - > 28.000€ → 3,33%
 * Con detrazione di 60€ se l'imponibile è tra 28.001€ e 30.000€.
 *
 * @param {number} imponibile - Reddito imponibile IRPEF
 * @returns {number} Addizionale regionale (≥ 0)
 */
export function calcAddizionaleRegionaleLombardia(imponibile) {
    const x = Math.max(0, Number(imponibile));
    const p = PARAMS.addRegionaleLombardia;

    const rate = (x <= p.threshold) ? p.rateLow : p.rateHigh;
    let add = x * rate;

    if (x >= p.detrazione.from && x <= p.detrazione.to) add -= p.detrazione.value;

    return Math.max(0, add);
}

/**
 * Calcola l'addizionale comunale IRPEF per Milano (0,80%).
 *
 * Due modalità per la soglia di 23.000€:
 *   - "franchigia" → paghi solo sulla quota sopra 23k (più intuitivo)
 *   - "notch" → se superi 23k, paghi su tutto il reddito
 *
 * @param {number} imponibile - Reddito imponibile IRPEF
 * @param {"franchigia"|"notch"} [mode="franchigia"] - Modalità soglia
 * @returns {number} Addizionale comunale (≥ 0)
 */
export function calcAddizionaleComunaleMilano(imponibile, mode = "franchigia") {
    const x = Math.max(0, Number(imponibile));
    const p = PARAMS.addComunaleMilano;

    if (x <= p.threshold) return 0;

    if (mode === "notch") return x * p.rate;
    return (x - p.threshold) * p.rate;
}

// ─────────────────────────────────────────────────────────
//  CALCOLO COMPLETO: RAL → NETTO
// ─────────────────────────────────────────────────────────

/**
 * Funzione principale: calcola il netto partendo dalla RAL.
 *
 * Esegue l'intera catena di calcolo fiscale e ritorna un oggetto
 * con tutti i valori intermedi (utile per il breakdown dettagliato).
 *
 * @param {Object} input - Parametri di input dall'interfaccia utente
 * @param {number} input.ral - Retribuzione Annua Lorda (es. 35000)
 * @param {number} [input.mensilita=13] - Numero di mensilità (12 o 13)
 * @param {number} [input.inpsRate=0.0919] - Aliquota INPS lavoratore
 * @param {boolean} [input.applyExtra1PctInps=true] - Applica 1% extra INPS
 * @param {boolean} [input.useDetrazione=true] - Applica detrazione lavoro dipendente
 * @param {boolean} [input.useAddReg=true] - Applica addizionale regionale
 * @param {boolean} [input.useAddCom=true] - Applica addizionale comunale
 * @param {"franchigia"|"notch"} [input.comSogliaMode="franchigia"] - Modalità soglia comunale
 *
 * @returns {Object} Risultato completo con tutti i valori intermedi:
 *   - ral, mensilita, inps, imponibileIrpef
 *   - irpefLorda, detrazioneLavoroDipendente, irpefNetta
 *   - addizionaleRegionale, addizionaleComunale
 *   - tasse, trattenuteTotali, nettoAnnuo, nettoMensile
 *
 * @example
 * const result = computeNetto({ ral: 35000 });
 * console.log(result.nettoMensile); // → ~1.860€ circa
 */
export function computeNetto({
    ral,
    mensilita = 13,
    inpsRate = 0.0919,
    applyExtra1PctInps = true,
    useDetrazione = true,
    useAddReg = true,
    useAddCom = true,
    comSogliaMode = "franchigia"
}) {
    const RAL = Math.max(0, Number(ral));
    const M = Math.max(1, Number(mensilita));

    const inps = round2(calcInps({ ral: RAL, inpsRate, applyExtra1Pct: applyExtra1PctInps }));
    const imponibileIrpef = round2(Math.max(0, RAL - inps));

    const irpefLorda = round2(calcIrpefLorda2026(imponibileIrpef));
    const detrazione = useDetrazione ? round2(calcDetrazioneLavoroDipendente(imponibileIrpef)) : 0;
    const irpefNetta = round2(Math.max(0, irpefLorda - detrazione));

    const addReg = useAddReg ? round2(calcAddizionaleRegionaleLombardia(imponibileIrpef)) : 0;
    const addCom = useAddCom ? round2(calcAddizionaleComunaleMilano(imponibileIrpef, comSogliaMode)) : 0;

    const tasse = round2(irpefNetta + addReg + addCom);
    const trattenuteTotali = round2(inps + tasse);

    const nettoAnnuo = round2(Math.max(0, RAL - trattenuteTotali));
    const nettoMensile = round2(nettoAnnuo / M);

    return {
        ral: round2(RAL),
        mensilita: M,

        inpsRate: Number(inpsRate),
        applyExtra1PctInps,
        comSogliaMode,

        imponibileIrpef,
        inps,

        irpefLorda,
        detrazioneLavoroDipendente: detrazione,
        irpefNetta,

        addizionaleRegionale: addReg,
        addizionaleComunale: addCom,

        tasse,
        trattenuteTotali,

        nettoAnnuo,
        nettoMensile
    };
}
