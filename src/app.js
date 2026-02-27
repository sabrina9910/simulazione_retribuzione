/**
 * @file app.js — Controller UI per il calcolatore RAL → Netto
 *
 * Gestisce:
 *   1. Lettura degli input dall'interfaccia utente
 *   2. Chiamata alle funzioni di calcolo (importate da tax.js)
 *   3. Rendering dei risultati (KPI, tabelle, grafici, formule)
 *   4. Interazioni secondarie (confronto 12/13, dialog fonti, copia parametri)
 *   5. Demo iniziale con grafico lordo/netto al caricamento della pagina
 *
 * Architettura: questo file NON contiene logica di calcolo fiscale.
 * Tutta la matematica vive in tax.js (funzioni pure, testabili).
 */

import { computeNetto, PARAMS } from "./tax.js";

// ─────────────────────────────────────────────────────────
//  UTILITY
// ─────────────────────────────────────────────────────────

/** Formattatore per valuta italiana (€ con separatore migliaia) */
const eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

/**
 * Shortcut per document.getElementById.
 * @param {string} id - ID dell'elemento DOM
 * @returns {HTMLElement}
 */
function $(id) { return document.getElementById(id); }

/**
 * Converte una stringa "yes"/"no" in booleano.
 * @param {string} v - Valore dal <select>
 * @returns {boolean}
 */
function toBool(v) { return v === "yes"; }

/**
 * Genera una riga <tr> con label a sinistra e valore a destra.
 * Usata per costruire le tabelle di breakdown.
 *
 * @param {string} label - Descrizione della voce (es. "IRPEF lorda")
 * @param {string} value - Valore formattato (es. "€ 6.440,00")
 * @returns {string} HTML della riga <tr>
 */
function row(label, value) {
    return `<tr><td>${label}</td><td style="text-align:right;">${value}</td></tr>`;
}

// ─────────────────────────────────────────────────────────
//  GRAFICO A TORTA (CANVAS — nessuna libreria esterna)
// ─────────────────────────────────────────────────────────

/**
 * Disegna un grafico a ciambella (donut chart) nel <canvas> specificato.
 * Mostra visivamente la suddivisione RAL tra netto e trattenute.
 *
 * Colori:
 *   - Verde acqua → Netto in busta
 *   - Blu         → INPS lavoratore
 *   - Viola       → IRPEF netta
 *   - Arancio     → Addizionali (regionale + comunale)
 *
 * @param {string} canvasId - ID dell'elemento <canvas>
 * @param {Object} res - Risultato di computeNetto() con tutti i campi
 */
function drawDonutChart(canvasId, res) {
    const canvas = $(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    /* Dimensione logica fissa, pixel reali scaled per retina */
    const size = 260;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const outerR = 110;
    const innerR = 65;

    /* Fette: netto, INPS, IRPEF netta, addizionali */
    const addizionali = res.addizionaleRegionale + res.addizionaleComunale;
    const slices = [
        { value: res.nettoAnnuo, color: "#22d3a7", label: "Netto" },
        { value: res.inps, color: "#4aa3ff", label: "INPS" },
        { value: res.irpefNetta, color: "#a78bfa", label: "IRPEF" },
        { value: addizionali, color: "#f59e0b", label: "Addiz." }
    ];

    const total = slices.reduce((s, sl) => s + sl.value, 0);
    if (total === 0) return;

    let startAngle = -Math.PI / 2;

    for (const slice of slices) {
        const sweep = (slice.value / total) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR, startAngle, startAngle + sweep);
        ctx.arc(cx, cy, innerR, startAngle + sweep, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = slice.color;
        ctx.fill();
        startAngle += sweep;
    }

    /* Testo centrale: netto mensile */
    ctx.fillStyle = "#e7ecff";
    ctx.font = "bold 20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(eur.format(res.nettoMensile), cx, cy - 8);

    ctx.fillStyle = "#a9b4d0";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText("netto/mese", cx, cy + 12);
}

/**
 * Costruisce la legenda HTML sotto il grafico donut.
 *
 * @param {Object} res - Risultato di computeNetto()
 * @returns {string} HTML con pallini colorati + label + importo
 */
function buildChartLegend(res) {
    const addizionali = res.addizionaleRegionale + res.addizionaleComunale;
    const items = [
        { color: "#22d3a7", label: "Netto", value: res.nettoAnnuo },
        { color: "#4aa3ff", label: "INPS", value: res.inps },
        { color: "#a78bfa", label: "IRPEF netta", value: res.irpefNetta },
        { color: "#f59e0b", label: "Addizionali", value: addizionali }
    ];

    return items.map(it =>
        `<span class="legend-item">
            <span class="legend-dot" style="background:${it.color};"></span>
            ${it.label}: <strong>${eur.format(it.value)}</strong>
        </span>`
    ).join("");
}

// ─────────────────────────────────────────────────────────
//  TABS (Risultato / Metodo)
// ─────────────────────────────────────────────────────────

/**
 * Attiva una delle due tab (Risultato o Metodo) nella sezione output,
 * nascondendo l'altra.
 *
 * @param {"risultato"|"metodo"} active - Tab da mostrare
 */
function setTab(active) {
    const isRes = active === "risultato";
    $("panelRisultato").style.display = isRes ? "block" : "none";
    $("panelMetodo").style.display = isRes ? "none" : "block";
    $("tabRisultato").classList.toggle("active", isRes);
    $("tabMetodo").classList.toggle("active", !isRes);
}

$("tabRisultato").addEventListener("click", () => setTab("risultato"));
$("tabMetodo").addEventListener("click", () => setTab("metodo"));

// ─────────────────────────────────────────────────────────
//  RENDERING
// ─────────────────────────────────────────────────────────

/**
 * Renderizza il pannello "Metodo" con la lista numerata delle formule
 * usate nel calcolo, inclusi i parametri correnti.
 *
 * @param {Object} res - Risultato di computeNetto()
 */
function renderMethod(res) {
    const modeText = res.comSogliaMode === "notch"
        ? "notch (se superi la soglia, paghi su tutto)"
        : "franchigia (paghi solo oltre 23k)";

    const lines = [
        `Regola rounding: arrotondo a ${PARAMS.rounding.decimals} decimali dopo ogni step (policy: ${PARAMS.rounding.policy}).`,
        `INPS = RAL × aliquota_INPS, con extra ${Math.round(PARAMS.inpsExtra.rate * 100)}% sulla quota oltre ${eur.format(PARAMS.inpsExtra.threshold)} se attivo.`,
        `Imponibile IRPEF (sempl.) = RAL − INPS.`,
        `IRPEF lorda ${PARAMS.year} per scaglioni: 23% fino 28k, 33% 28k–50k, 43% oltre.`,
        `Detrazione lavoro dipendente: funzione annualizzata su imponibile (Art. 13, nel prototipo).`,
        `IRPEF netta = max(0, IRPEF lorda − detrazione).`,
        `Add. regionale Lombardia: ${(PARAMS.addRegionaleLombardia.rateLow * 100).toFixed(2)}% se imponibile <= 28k, altrimenti ${(PARAMS.addRegionaleLombardia.rateHigh * 100).toFixed(2)}%, −${eur.format(PARAMS.addRegionaleLombardia.detrazione.value)} tra 28.001–30.000.`,
        `Add. comunale Milano: ${(PARAMS.addComunaleMilano.rate * 100).toFixed(2)}%, soglia ${eur.format(PARAMS.addComunaleMilano.threshold)}, modalità: ${modeText}.`,
        `Netto annuo = RAL − (INPS + IRPEF netta + addizionali).`,
        `Netto mensile = Netto annuo / mensilità (${res.mensilita}).`
    ];

    $("methodBox").innerHTML = `<ol>${lines.map(l => `<li>${l}</li>`).join("")}</ol>`;
}

/**
 * Nasconde la card di confronto 12 vs 13 mensilità.
 */
function hideComparison() {
    $("compareCard").style.display = "none";
    $("compareBody").innerHTML = "";
}

/**
 * Renderizza il confronto fianco a fianco tra 12 e 13 mensilità.
 * Mostra netto annuo, netto mensile e la differenza per ogni opzione.
 *
 * @param {Object} baseInputs - Input utente (la proprietà mensilita verrà sovrascritta)
 */
function renderComparison(baseInputs) {
    const inputs12 = { ...baseInputs, mensilita: 12 };
    const inputs13 = { ...baseInputs, mensilita: 13 };

    const r12 = computeNetto(inputs12);
    const r13 = computeNetto(inputs13);

    const diff = r13.nettoMensile - r12.nettoMensile;

    const body = [];
    body.push(row("Netto annuo (12 mens.)", eur.format(r12.nettoAnnuo)));
    body.push(row("Netto mensile (12 mens.)", eur.format(r12.nettoMensile)));
    body.push(row("Netto annuo (13 mens.)", eur.format(r13.nettoAnnuo)));
    body.push(row("Netto mensile (13 mens.)", eur.format(r13.nettoMensile)));
    body.push(row("Differenza netto mensile (13 − 12)", eur.format(diff)));

    $("compareBody").innerHTML = body.join("");
    $("compareCard").style.display = "block";
}

/**
 * Renderizza tutti i risultati del calcolo nell'interfaccia:
 *   - KPI principali (netto annuo, mensile, trattenute)
 *   - Tabella breakdown dettagliato
 *   - Grafico donut con legenda
 *   - Tab metodo con formule
 *
 * @param {Object} res - Risultato completo di computeNetto()
 */
function render(res) {
    $("nettoAnnuo").textContent = eur.format(res.nettoAnnuo);
    $("nettoMensile").textContent = eur.format(res.nettoMensile);
    $("totTrattenute").textContent = eur.format(res.trattenuteTotali);

    const body = [];
    body.push(row("RAL (lordo annuo)", eur.format(res.ral)));
    body.push(row("Mensilità", String(res.mensilita)));

    body.push(row("INPS lavoratore", eur.format(res.inps)));
    body.push(row("Imponibile IRPEF (sempl.)", eur.format(res.imponibileIrpef)));

    body.push(row("IRPEF lorda", eur.format(res.irpefLorda)));
    body.push(row("Detrazione lavoro dipendente", `- ${eur.format(res.detrazioneLavoroDipendente)}`));
    body.push(row("IRPEF netta", eur.format(res.irpefNetta)));

    body.push(row("Addizionale regionale Lombardia", eur.format(res.addizionaleRegionale)));
    body.push(row("Addizionale comunale Milano", eur.format(res.addizionaleComunale)));

    body.push(row("Totale tasse (IRPEF netta + addizionali)", eur.format(res.tasse)));
    body.push(row("Totale trattenute (INPS + tasse)", eur.format(res.trattenuteTotali)));

    body.push(row("Netto annuo", eur.format(res.nettoAnnuo)));
    body.push(row("Netto per mensilità", eur.format(res.nettoMensile)));

    $("breakdownBody").innerHTML = body.join("");
    renderMethod(res);

    /* Grafico donut */
    drawDonutChart("breakdownChart", res);
    const legendEl = $("chartLegend");
    if (legendEl) legendEl.innerHTML = buildChartLegend(res);

    $("results").style.display = "block";
    setTab("risultato");
    $("lordoAnnuo").textContent = eur.format(res.ral);

    const lordoMensile = res.ral / res.mensilita; // media
    $("lordoMensile").textContent = eur.format(lordoMensile);

    $("imponibileIrpefKpi").textContent = eur.format(res.imponibileIrpef);

}

// ─────────────────────────────────────────────────────────
//  LETTURA INPUT
// ─────────────────────────────────────────────────────────

/**
 * Legge tutti i campi del form e ritorna un oggetto pronto
 * per essere passato a computeNetto().
 *
 * @returns {Object} Input normalizzati per il motore di calcolo
 */
function readInputs() {
    const ral = Number($("ral").value);
    const include13 = $("include13").checked;
    const mensilita = include13 ? 13 : 12;

    return {
        ral,
        mensilita,
        inpsRate: Number($("inpsRate").value),
        applyExtra1PctInps: toBool($("useInpsExtra").value),
        useDetrazione: toBool($("useDetrazione").value),
        useAddReg: toBool($("useAddReg").value),
        useAddCom: toBool($("useAddCom").value),
        comSogliaMode: $("comSogliaMode").value
    };
}

// ─────────────────────────────────────────────────────────
//  EVENT LISTENERS
// ─────────────────────────────────────────────────────────

/** Pulsante "Calcola": valida la RAL e renderizza i risultati */
$("calcBtn").addEventListener("click", () => {
    const inputs = readInputs();

    if (!Number.isFinite(inputs.ral) || inputs.ral <= 0) {
        alert("Inserisci una RAL valida (es. 35000).");
        return;
    }

    hideComparison();
    render(computeNetto(inputs));
});

/** Pulsante "Confronta 12 vs 13": calcola e mostra la comparazione */
$("compareBtn").addEventListener("click", () => {
    const inputs = readInputs();

    if (!Number.isFinite(inputs.ral) || inputs.ral <= 0) {
        alert("Inserisci una RAL valida prima di confrontare.");
        return;
    }

    render(computeNetto(inputs));
    renderComparison({ ...inputs });
});

/**
 * Pulsante "Carica esempio": inserisce RAL 35.000€ con tutti i parametri
 * standard e lancia immediatamente il calcolo.
 */
$("exampleBtn").addEventListener("click", () => {
    $("ral").value = "35000";
    $("include13").checked = true;

    $("inpsRate").value = "0.0919";
    $("useInpsExtra").value = "yes";

    $("useDetrazione").value = "yes";
    $("useAddReg").value = "yes";
    $("useAddCom").value = "yes";

    $("comSogliaMode").value = "franchigia";

    const inputs = readInputs();
    hideComparison();
    render(computeNetto(inputs));
});

/**
 * Ripristina tutti i campi ai valori di default e nasconde i risultati.
 */
function resetParameters() {
    $("ral").value = "";
    $("include13").checked = true;

    $("inpsRate").value = "0.0919";
    $("useInpsExtra").value = "yes";

    $("useDetrazione").value = "yes";
    $("useAddReg").value = "yes";
    $("useAddCom").value = "yes";

    $("comSogliaMode").value = "franchigia";

    hideComparison();
    $("results").style.display = "none";

    /* Ripristina la hero card con il grafico demo */
    const heroCard = $("heroCard");
    if (heroCard) heroCard.style.display = "block";
}

$("resetBtn").addEventListener("click", resetParameters);

// ─────────────────────────────────────────────────────────
//  DIALOG FONTI: popolamento dinamico
// ─────────────────────────────────────────────────────────

/**
 * Costruisce i contenuti della dialog "Fonti e parametri usati"
 * leggendo i parametri correnti da PARAMS e dallo stato UI.
 */
function buildSourcesDialogContent() {
    const inputs = readInputs();
    const mens = inputs.mensilita;
    const inpsRatePct = (inputs.inpsRate * 100).toFixed(2);

    $("sourcesMeta").textContent =
        `Anno parametri: ${PARAMS.year} · Mensilità correnti: ${mens} · Aliquota INPS impostata: ${inpsRatePct}% · Rounding: ${PARAMS.rounding.policy} (${PARAMS.rounding.decimals} decimali).`;

    // Parametri (numeri presi da PARAMS + alcune scelte UI)
    const p = [];
    p.push(`<ul>`);
    p.push(`<li><strong>IRPEF ${PARAMS.year}</strong>: 23% fino a 28.000€, 33% 28.001–50.000€, 43% oltre 50.000€.</li>`);
    p.push(`<li><strong>Lombardia (add. regionale)</strong>: ${(PARAMS.addRegionaleLombardia.rateLow * 100).toFixed(2)}% (≤ 28k) oppure ${(PARAMS.addRegionaleLombardia.rateHigh * 100).toFixed(2)}% (> 28k), detrazione ${eur.format(PARAMS.addRegionaleLombardia.detrazione.value)} tra 28.001–30.000€.</li>`);
    p.push(`<li><strong>Milano (add. comunale)</strong>: ${(PARAMS.addComunaleMilano.rate * 100).toFixed(2)}%, soglia ${eur.format(PARAMS.addComunaleMilano.threshold)}; modalità soglia selezionata: <strong>${inputs.comSogliaMode}</strong>.</li>`);
    p.push(`<li><strong>INPS extra</strong>: +${Math.round(PARAMS.inpsExtra.rate * 100)}% oltre ${eur.format(PARAMS.inpsExtra.threshold)}; toggle: <strong>${inputs.applyExtra1PctInps ? "ON" : "OFF"}</strong>.</li>`);
    p.push(`<li><strong>Rounding</strong>: arrotondo a ${PARAMS.rounding.decimals} decimali dopo ogni step (non solo alla fine).</li>`);
    p.push(`</ul>`);
    $("sourcesParams").innerHTML = p.join("");

    // Link fonti (presi da PARAMS.sources)
    const links = [];
    links.push(`<ul>`);
    links.push(`<li><a href="${PARAMS.sources.irpef}" target="_blank" rel="noreferrer">IRPEF ${PARAMS.year} + detrazione lavoro dipendente</a></li>`);
    links.push(`<li><a href="${PARAMS.sources.addRegLombardia}" target="_blank" rel="noreferrer">MEF – Addizionale regionale Lombardia</a></li>`);
    links.push(`<li><a href="${PARAMS.sources.addComMEF}" target="_blank" rel="noreferrer">MEF – Addizionale comunale (ricerca comune Milano)</a></li>`);
    links.push(`<li><a href="${PARAMS.sources.addComGlossario}" target="_blank" rel="noreferrer">Glossario addizionale comunale (UX)</a></li>`);
    links.push(`<li><a href="${PARAMS.sources.inps}" target="_blank" rel="noreferrer">INPS – comunicazioni/limiti 2026 (soglie)</a></li>`);
    links.push(`</ul>`);
    $("sourcesLinks").innerHTML = links.join("");
}

const dialog = $("sourcesDialog");

$("sourcesBtn").addEventListener("click", () => {
    buildSourcesDialogContent();
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "true");
});

$("closeSourcesBtn").addEventListener("click", () => {
    dialog.close();
});

// Chiudi cliccando fuori 
dialog.addEventListener("click", (e) => {
    const rect = dialog.getBoundingClientRect();
    const inDialog =
        rect.top <= e.clientY && e.clientY <= rect.bottom &&
        rect.left <= e.clientX && e.clientX <= rect.right;
    if (!inDialog) dialog.close();
});

// ─────────────────────────────────────────────────────────
//  COPIA PARAMETRI (clipboard)
// ─────────────────────────────────────────────────────────

/**
 * Costruisce il payload JSON con tutti i parametri e lo stato UI corrente,
 * utile per debug o per condividere una configurazione.
 *
 * @returns {Object} Oggetto con timestamp, PARAMS e stato UI
 */
function buildCopyPayload() {
    const inputs = readInputs();

    return {
        generatedAt: new Date().toISOString(),
        params: PARAMS,
        uiState: {
            mensilita: inputs.mensilita,
            include13: $("include13").checked,
            inpsRate: inputs.inpsRate,
            applyExtra1PctInps: inputs.applyExtra1PctInps,
            useDetrazione: inputs.useDetrazione,
            useAddReg: inputs.useAddReg,
            useAddCom: inputs.useAddCom,
            comSogliaMode: inputs.comSogliaMode
        }
    };
}

/**
 * Mostra un messaggio di stato nella dialog fonti (es. "Copiato!").
 * @param {string} msg - Messaggio da mostrare
 */
function setCopyStatus(msg) {
    const el = $("copyStatus");
    if (!el) return;
    el.textContent = msg;
}

$("copyParamsBtn").addEventListener("click", async () => {
    try {
        const payload = buildCopyPayload();
        const text = JSON.stringify(payload, null, 2);

        // Clipboard API: writeText (richiede secure context: HTTPS o localhost). [web:115]
        await navigator.clipboard.writeText(text);

        setCopyStatus("Copiato negli appunti (JSON).");
    } catch (err) {
        // Fallback: seleziona testo in una prompt-like via textarea temporanea
        try {
            const payload = buildCopyPayload();
            const text = JSON.stringify(payload, null, 2);

            const ta = document.createElement("textarea");
            ta.value = text;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.left = "-9999px";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);

            setCopyStatus("Copiato (fallback). Se non funziona, prova da localhost/HTTPS.");
        } catch (e2) {
            setCopyStatus("Copia non riuscita. Prova ad aprire il sito su localhost/HTTPS.");
        }
    }
});

// ─────────────────────────────────────────────────────────
//  DEMO INIZIALE: grafico + calcolo al caricamento
// ─────────────────────────────────────────────────────────

/**
 * All'avvio della pagina, mostra un calcolo di esempio (RAL 30.000€)
 * nella hero card con grafico donut — così il recruiter vede subito
 * cosa fa il tool senza dover cliccare nulla.
 */
function initHeroDemo() {
    const demoRAL = 30000;
    const demoResult = computeNetto({
        ral: demoRAL,
        mensilita: 13,
        inpsRate: 0.0919,
        applyExtra1PctInps: true,
        useDetrazione: true,
        useAddReg: true,
        useAddCom: true,
        comSogliaMode: "franchigia"
    });

    /* Aggiorna i KPI nella hero card */
    const heroNetto = $("heroNetto");
    const heroTrattenute = $("heroTrattenute");
    const heroLordo = $("heroLordo");

    if (heroNetto) heroNetto.textContent = eur.format(demoResult.nettoMensile);
    if (heroTrattenute) heroTrattenute.textContent = eur.format(demoResult.trattenuteTotali);
    if (heroLordo) heroLordo.textContent = eur.format(demoResult.ral);

    /* Disegna il donut nella hero card */
    drawDonutChart("heroChart", demoResult);

    const heroLegend = $("heroLegend");
    if (heroLegend) heroLegend.innerHTML = buildChartLegend(demoResult);
}

/* Lancia la demo hero al caricamento del DOM */
initHeroDemo();
