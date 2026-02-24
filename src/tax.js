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

export function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}

export function round2(n) {
    const x = Number(n);
    const factor = 10 ** PARAMS.rounding.decimals;
    return Math.round((x + Number.EPSILON) * factor) / factor;
}

export function calcInps({ ral, inpsRate, applyExtra1Pct = true }) {
    const R = Math.max(0, Number(ral));
    const baseRate = clamp(Number(inpsRate ?? 0), 0, 0.3);
    const base = R * baseRate;

    if (!applyExtra1Pct) return base;

    const extraBase = Math.max(0, R - PARAMS.inpsExtra.threshold);
    const extra = extraBase * PARAMS.inpsExtra.rate;

    return base + extra;
}

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

export function calcAddizionaleRegionaleLombardia(imponibile) {
    const x = Math.max(0, Number(imponibile));
    const p = PARAMS.addRegionaleLombardia;

    const rate = (x <= p.threshold) ? p.rateLow : p.rateHigh;
    let add = x * rate;

    if (x >= p.detrazione.from && x <= p.detrazione.to) add -= p.detrazione.value;

    return Math.max(0, add);
}

export function calcAddizionaleComunaleMilano(imponibile, mode = "franchigia") {
    const x = Math.max(0, Number(imponibile));
    const p = PARAMS.addComunaleMilano;

    if (x <= p.threshold) return 0;

    if (mode === "notch") return x * p.rate;
    return (x - p.threshold) * p.rate;
}

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
