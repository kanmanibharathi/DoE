/**
 * Rectangular Lattice Design Generator
 * Validates t = s(s-1) and k = s-1
 */

class RectangularLatticeGenerator {
    constructor() {
        this.initEventListeners();
        this.mulberry = null;
    }

    initEventListeners() {
        const tInput = document.getElementById('t-input');
        const kInput = document.getElementById('k-input');

        tInput.addEventListener('input', () => {
            const t = parseInt(tInput.value);
            const s = Math.round(Math.sqrt(t)) + 1; // Solve t = s(s-1) approx
            if (s * (s - 1) === t) {
                kInput.value = s - 1;
                document.getElementById('t-validation').style.display = 'none';
            } else {
                document.getElementById('t-validation').style.display = 'block';
            }
        });

        document.getElementById('generate-btn').addEventListener('click', () => this.generate());
        document.getElementById('export-btn').addEventListener('click', () => this.exportCSV());
//         document.getElementById('copy-btn').addEventListener('click', () => this.copyToClipboard());
//         document.getElementById('download-map-btn').addEventListener('click', () => this.downloadMap());
// 
//         document.querySelectorAll('.tab').forEach(tab => {
//             tab.addEventListener('click', (e) => {
//                 document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
//                 document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
//                 e.target.classList.add('active');
//                 document.getElementById(e.target.dataset.tab).classList.add('active');
//             });
        });
    }

    mulberry32(a) {
        return function () {
            let t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }

    shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(this.mulberry() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    generate() {
        const t = parseInt(document.getElementById('t-input').value);
        const r = parseInt(document.getElementById('r-input').value);
        const lCount = parseInt(document.getElementById('loc-input').value);
        const startPlot = parseInt(document.getElementById('plot-input').value);
        let seed = parseInt(document.getElementById('seed-input').value);

        // Calculate s from t = s(s-1)
        // s^2 - s - t = 0 => s = (1 + sqrt(1 + 4t)) / 2
        const s = (1 + Math.sqrt(1 + 4 * t)) / 2;
        if (s % 1 !== 0) {
            alert("Invalid number of treatments. t must satisfy t = s(s-1). Examples: 6, 12, 20, 30, 42, 56, 72...");
            return;
        }

        const k = s - 1;
        if (isNaN(seed)) seed = Math.floor(Math.random() * 999999);
        this.mulberry = this.mulberry32(seed);

        const trtNamesRaw = document.getElementById('trt-names').value.split('\n').filter(x => x.trim() !== '');
        const treatments = [];
        for (let i = 1; i <= t; i++) {
            treatments.push({
                entry: i,
                name: trtNamesRaw[i - 1] || `G-${i}`
            });
        }

        const locationsData = [];
        for (let loc = 1; loc <= lCount; loc++) {
            const locReps = [];
            for (let repNum = 1; repNum <= r; repNum++) {
                // Generate a randomized allocation for this replicate
                // For a simple lattice visualization/prototype, we shuffle and group
                // In a real lattice, the grouping logic determines efficiency.
                // We'll mimic the R field book output style.
                let repTrts = [...treatments];
                this.shuffle(repTrts);

                const iblocks = [];
                for (let i = 0; i < s; i++) {
                    const blockTrts = repTrts.slice(i * k, (i + 1) * k);
                    iblocks.push(blockTrts);
                }
                locReps.push(iblocks);
            }
            locationsData.push(locReps);
        }

        const lambda = (r * (k - 1)) / (t - 1);

        this.currentDesign = {
            t, r, k, s, lCount, startPlot, seed, lambda, locationsData
        };

        this.render();
    }

    render() {
        const { t, r, k, s, lCount, startPlot, seed, lambda, locationsData } = this.currentDesign;

        document.getElementById('info-s').textContent = s;
        document.getElementById('info-k').textContent = k;
        document.getElementById('info-lambda').textContent = lambda.toFixed(4);
        document.getElementById('info-total').textContent = t * r * lCount;

        document.getElementById('results').style.display = 'block';

        // Render Table
        const tbody = document.querySelector('#field-book-table tbody');
        tbody.innerHTML = '';
        const fieldBookRows = [];

        let globalId = 1;
        locationsData.forEach((locReps, lIdx) => {
            let currentPlot = startPlot + (lIdx * 1000); // Standard R offset
            locReps.forEach((rep, rIdx) => {
                rep.forEach((block, bIdx) => {
                    block.forEach((trt, pIdx) => {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${globalId}</td>
                            <td>Loc ${lIdx + 1}</td>
                            <td>${currentPlot}</td>
                            <td>${rIdx + 1}</td>
                            <td>${bIdx + 1}</td>
                            <td>${trt.entry}</td>
                            <td>${trt.name}</td>
                        `;
                        tbody.appendChild(tr);
                        fieldBookRows.push({
                            id: globalId++,
                            location: lIdx + 1,
                            plot: currentPlot++,
                            rep: rIdx + 1,
                            iblock: bIdx + 1,
                            entry: trt.entry,
                            name: trt.name
                        });
                    });
                });
            });
        });

        this.fieldBookData = fieldBookRows;

        // Render Map
        const mapContainer = document.getElementById('map-container');
        mapContainer.innerHTML = '';

        locationsData.forEach((locReps, lIdx) => {
            const locDiv = document.createElement('div');
            locDiv.innerHTML = `<h3 style="margin: 2rem 0 1rem; color: var(--text-dim);">Location ${lIdx + 1}</h3>`;

            locReps.forEach((rep, rIdx) => {
                const repGroup = document.createElement('div');
                repGroup.className = 'replicate-group';
                repGroup.innerHTML = `<div class="replicate-title">Replicate ${rIdx + 1}</div>`;

                const blocksGrid = document.createElement('div');
                blocksGrid.className = 'blocks-grid';

                rep.forEach((block, bIdx) => {
                    const blockRow = document.createElement('div');
                    blockRow.className = 'block-row';
                    blockRow.innerHTML = `<div class="block-label">Block ${bIdx + 1}</div>`;

                    const plotsContainer = document.createElement('div');
                    plotsContainer.className = 'plots-container';

                    block.forEach((trt, pIdx) => {
                        const cell = document.createElement('div');
                        cell.className = 'plot-cell';
                        cell.innerHTML = `
                            <div class="plot-num">${trt.entry}</div>
                            <div class="trt-name">${trt.name}</div>
                        `;
                        plotsContainer.appendChild(cell);
                    });

                    blockRow.appendChild(plotsContainer);
                    blocksGrid.appendChild(blockRow);
                });

                repGroup.appendChild(blocksGrid);
                locDiv.appendChild(repGroup);
            });
            mapContainer.appendChild(locDiv);
        });
    }

    exportCSV() {
        if (!this.fieldBookData) return;
        let csv = 'ID,Location,Plot,Replicate,IBlock,Entry,Treatment\n';
        this.fieldBookData.forEach(row => {
            csv += `${row.id},${row.location},${row.plot},${row.rep},${row.iblock},${row.entry},"${row.name}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Rectangular_Lattice_FieldBook.csv';
        a.click();
    }

    copyToClipboard() {
        if (!this.fieldBookData) return;
        let text = 'Plot\tRep\tBlock\tEntry\tName\n';
        this.fieldBookData.forEach(row => {
            text += `${row.plot}\t${row.rep}\t${row.iblock}\t${row.entry}\t${row.name}\n`;
        });
        navigator.clipboard.writeText(text).then(() => alert('Copied to clipboard!'));
    }

    downloadMap() {
        const container = document.getElementById('map-container');
        html2canvas(container, {
            backgroundColor: '#1e293b',
            scale: 2,
            padding: 20
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'Rectangular_Lattice_Map.png';
            link.href = canvas.toDataURL();
            link.click();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new RectangularLatticeGenerator();
});
