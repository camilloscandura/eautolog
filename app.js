const TARIFE = { 'Solar': 0.09, 'Tag': 0.31, 'Nacht': 0.18 };
let logs = JSON.parse(localStorage.getItem('ev_logs')) || [];
let sortCol = 'date', sortAsc = false;

// Datum auf heute setzen, falls Element existiert
const dateInput = document.getElementById('fDate');
if (dateInput) dateInput.valueAsDate = new Date();

const form = document.getElementById('addForm');
if (form) {
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        logs.push({
            id: Date.now().toString(),
            date: document.getElementById('fDate').value,
            kwh: parseFloat(document.getElementById('fKwh').value),
            type: document.getElementById('fType').value,
            paid: false
        });
        document.getElementById('fKwh').value = '';
        saveAndRender();
    });
}

function saveAndRender() {
    localStorage.setItem('ev_logs', JSON.stringify(logs));
    render();
}

// Global verfügbar machen für den Button-Klick
window.togglePaid = function(id) {
    // Finde den Eintrag egal ob id als String oder Number gespeichert ist
    const item = logs.find(x => String(x.id) === String(id));
    if (item) {
        item.paid = !item.paid;
        saveAndRender();
    } else {
        console.error("Eintrag mit ID nicht gefunden:", id);
    }
};

window.deleteItem = function(id) {
    logs = logs.filter(x => String(x.id) !== String(id));
    saveAndRender();
};

window.sortTable = function(col) {
    if (sortCol === col) sortAsc = !sortAsc;
    else { sortCol = col; sortAsc = true; }
    render();
};

window.resetFilter = function() {
    document.getElementById('fFrom').value = '';
    document.getElementById('fTo').value = '';
    render();
};

function render() {
    const tb = document.getElementById('tb');
    if (!tb) return;
    tb.innerHTML = '';

    const from = document.getElementById('fFrom').value;
    const to = document.getElementById('fTo').value;

    let filtered = logs.filter(x => {
        if (from && x.date < from) return false;
        if (to && x.date > to) return false;
        return true;
    });

    filtered.sort((a, b) => {
        let valA = a[sortCol], valB = b[sortCol];
        if (sortCol === 'rate') { valA = TARIFE[a.type] || 0; valB = TARIFE[b.type] || 0; }
        if (sortCol === 'cost') { valA = a.kwh * (TARIFE[a.type] || 0); valB = b.kwh * (TARIFE[b.type] || 0); }
        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
    });

    ['date','kwh','type','rate','cost'].forEach(c => {
        const el = document.getElementById('s-' + c);
        if (el) el.innerText = sortCol === c ? (sortAsc ? '▲' : '▼') : '';
    });

    let totKwh = 0, totCost = 0, paidCost = 0, unpaidCost = 0;

    filtered.forEach(x => {
        const rate = TARIFE[x.type] || 0;
        const cost = x.kwh * rate;
        totKwh += x.kwh;
        totCost += cost;
        if (x.paid) paidCost += cost; else unpaidCost += cost;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${x.date}</td>
            <td>${x.kwh.toFixed(1)} kWh</td>
            <td><span class="badge b-${x.type.toLowerCase()}">${x.type}</span></td>
            <td>${rate.toFixed(2)} €</td>
            <td><b>${cost.toFixed(2)} €</b></td>
            <td>
                <button type="button" onclick="togglePaid('${x.id}')" class="${x.paid ? 'paid-btn' : 'unpaid-btn'}">
                    ${x.paid ? '✓ Bezahlt' : '✗ Offen'}
                </button>
            </td>
            <td style="text-align:right">
                <button type="button" onclick="deleteItem('${x.id}')" class="del-btn" title="Löschen">🗑</button>
            </td>
        `;
        tb.appendChild(tr);
    });

    document.getElementById('kpiKosten').innerText = totCost.toFixed(2) + ' €';
    document.getElementById('kpiSplit').innerText = `Offen: ${unpaidCost.toFixed(2)} € | Bezahlt: ${paidCost.toFixed(2)} €`;
    document.getElementById('kpiKwh').innerText = totKwh.toFixed(1) + ' kWh';
    document.getElementById('kpiAvg').innerText = totKwh > 0 ? (totCost / totKwh).toFixed(2) + ' €' : '0,00 €';
}

window.exportCSV = function() {
    let csv = "\uFEFFDatum;kWh;Ladeart;Bezahlt\n";
    logs.forEach(x => {
        csv += `${x.date};${x.kwh};${x.type};${x.paid ? 'Ja' : 'Nein'}\n`;
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = 'ladelog.csv';
    a.click();
};

window.importCSV = function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const r = new FileReader();
    r.onload = function(evt) {
        const lines = evt.target.result.split(/\r\n|\n/);
        const imported = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const cols = line.includes(';') ? line.split(';') : line.split(',');
            if (cols.length < 3) continue;

            const date = cols[0].replace(/"/g, '').trim();
            const kwh = parseFloat(cols[1].replace(/"/g, '').replace(',', '.'));
            let type = cols[2].replace(/"/g, '').trim();
            
            let paid = false;
            if (cols.length >= 4) {
                const val4 = cols[3].replace(/"/g, '').trim();
                if (val4.toLowerCase() === 'ja' || val4.toLowerCase() === 'true' || val4 === '1') {
                    paid = true;
                }
            }

            if (date && !isNaN(kwh)) {
                imported.push({ id: (Date.now() + i).toString(), date, kwh, type, paid });
            }
        }

        if (imported.log !== 0 && imported.length > 0) {
            if (confirm(`${imported.length} Einträge gefunden.\n[OK] = Zusammenführen\n[Abbrechen] = Überschreiben`)) {
                logs = logs.concat(imported);
            } else {
                logs = imported;
            }
            saveAndRender();
        } else {
            alert('Keine gültigen Daten gefunden.');
        }
        e.target.value = '';
    };
    r.readAsText(file);
};

// Initialer Aufruf beim Laden
render();
