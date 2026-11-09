const TARIFE = { 'Solar': 0.09, 'Tag': 0.31, 'Nacht': 0.18 };
let logs = JSON.parse(localStorage.getItem('ev_logs')) || [];
let sortCol = 'date', sortAsc = false;

document.getElementById('fDate').valueAsDate = new Date();

document.getElementById('addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    logs.push({
        id: Date.now(),
        date: document.getElementById('fDate').value,
        kwh: parseFloat(document.getElementById('fKwh').value),
        type: document.getElementById('fType').value,
        note: document.getElementById('fNote').value,
        paid: false
    });
    document.getElementById('fKwh').value = '';
    document.getElementById('fNote').value = '';
    saveAndRender();
});

function saveAndRender() {
    localStorage.setItem('ev_logs', JSON.stringify(logs));
    render();
}

function togglePaid(id) {
    const item = logs.find(x => x.id === id);
    if (item) { item.paid = !item.paid; saveAndRender(); }
}

function deleteItem(id) {
    logs = logs.filter(x => x.id !== id);
    saveAndRender();
}

function sortTable(col) {
    if (sortCol === col) sortAsc = !sortAsc;
    else { sortCol = col; sortAsc = true; }
    render();
}

function resetFilter() {
    document.getElementById('fFrom').value = '';
    document.getElementById('fTo').value = '';
    render();
}

function render() {
    const tb = document.getElementById('tb');
    tb.innerHTML = '';

    const from = document.getElementById('fFrom').value;
    const to = document.getElementById('fTo').value;

    let filtered = logs.filter(x => {
        if (from && x.date < from) return false;
        if (to && x.date > to) return false;
        return true;
    });

    // Sortierung
    filtered.sort((a, b) => {
        let valA = a[sortCol], valB = b[sortCol];
        if (sortCol === 'rate') { valA = TARIFE[a.type]; valB = TARIFE[b.type]; }
        if (sortCol === 'cost') { valA = a.kwh * TARIFE[a.type]; valB = b.kwh * TARIFE[b.type]; }
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
                <button onclick="togglePaid(${x.id})" class="${x.paid ? 'paid-btn' : 'unpaid-btn'}">
                    ${x.paid ? '✓ Bezahlt' : '✗ Offen'}
                </button>
            </td>
            <td>${x.note || '-'}</td>
            <td style="text-align:right">
                <button onclick="deleteItem(${x.id})" class="del-btn" title="Löschen">🗑</button>
            </td>
        `;
        tb.appendChild(tr);
    });

    document.getElementById('kpiKosten').innerText = totCost.toFixed(2) + ' €';
    document.getElementById('kpiSplit').innerText = `Offen: ${unpaidCost.toFixed(2)} € | Bezahlt: ${paidCost.toFixed(2)} €`;
    document.getElementById('kpiKwh').innerText = totKwh.toFixed(1) + ' kWh';
    document.getElementById('kpiAvg').innerText = totKwh > 0 ? (totCost / totKwh).toFixed(2) + ' €' : '0,00 €';
}

function exportCSV() {
    let csv = "\uFEFFDatum;kWh;Ladeart;Bezahlt;Notiz\n";
    logs.forEach(x => {
        csv += `${x.date};${x.kwh};${x.type};${x.paid ? 'Ja' : 'Nein'};"${(x.note || '').replace(/"/g, '""')}"\n`;
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = 'ladelog.csv';
    a.click();
}

function importCSV(e) {
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
            
            // Abwärtskompatibler Bezahlt-Check
            let paid = false;
            let note = '';

            if (cols.length >= 4) {
                const val4 = cols[3].replace(/"/g, '').trim();
                if (val4.toLowerCase() === 'ja' || val4.toLowerCase() === 'true' || val4 === '1') {
                    paid = true;
                } else if (val4.toLowerCase() === 'nein' || val4.toLowerCase() === 'false' || val4 === '0') {
                    paid = false;
                } else {
                    note = val4; // Falls alte CSV-Spalte 4 Notiz war
                }
            }

            if (cols.length >= 5 && !note) {
                note = cols[4].replace(/"/g, '').trim();
            }

            if (date && !isNaN(kwh)) {
                imported.push({ id: Date.now() + i, date, kwh, type, paid, note });
            }
        }

        if (imported.length > 0) {
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
}

render();
