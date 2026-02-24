import { computeNetto, PARAMS } from "./tax.js";

const eur = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

function $(id) { return document.getElementById(id); }
function toBool(v) { return v === "yes"; }
function row(label, value) {
    return `<tr><td>${label}</td><td style="text-align:right;">${value}</td></tr>`;
}

function setTab(active) {
    const isRes = active === "risultato";
    $("panelRisultato").style.display = isRes ? "block" : "none";
    $("panelMetodo").style.display = isRes ? "none" : "block";
    $("tabRisultato").classList.toggle("active", isRes);
    $("tabMetodo").classList.toggle("active", !isRes);
}

$("tabRisultato").addEventListener("click", () => setTab("risultato"));
$("tabMetodo").addEventListener("click", () => setTab("metodo"));

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

function hideComparison() {
    $("compareCard").style.display = "none";
    $("compareBody").innerHTML = "";
}

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

    $("results").style.display = "block";
    setTab("risultato");
    $("lordoAnnuo").textContent = eur.format(res.ral);

    const lordoMensile = res.ral / res.mensilita; // media
    $("lordoMensile").textContent = eur.format(lordoMensile);

    $("imponibileIrpefKpi").textContent = eur.format(res.imponibileIrpef);

}

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

$("calcBtn").addEventListener("click", () => {
    const inputs = readInputs();

    if (!Number.isFinite(inputs.ral) || inputs.ral <= 0) {
        alert("Inserisci una RAL valida (es. 35000).");
        return;
    }

    hideComparison();
    render(computeNetto(inputs));
});

$("compareBtn").addEventListener("click", () => {
    const inputs = readInputs();

    if (!Number.isFinite(inputs.ral) || inputs.ral <= 0) {
        alert("Inserisci una RAL valida prima di confrontare.");
        return;
    }

    render(computeNetto(inputs));
    renderComparison({ ...inputs });
});

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
}

$("resetBtn").addEventListener("click", resetParameters);

/* ===== Dialog fonti: popolamento dinamico ===== */
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
