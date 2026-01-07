/**
 * Rectangular Lattice Design Generator
 * Validates t = s(s-1) and k = s-1
 */
'use strict';

class RectangularLatticeGenerator {
    constructor() {
        this.initEventListeners();
        this.mulberry = null;
        this.currentDesign = null;
        this.fieldBookData = null;
    }

    initEventListeners() {
        const tInput = document.getElementById('t-input');
        const kInput = document.getElementById('k-input');
        const genBtn = document.getElementById('generate-btn');
        const expBtn = document.getElementById('export-btn');

        if (tInput && kInput) {
            tInput.addEventListener('input', () => {
                const t = parseInt(tInput.value);
                const s = Math.round(Math.sqrt(t)) + 1; // Solve t = s(s-1) approx
                if (s * (s - 1) === t) {
                    kInput.value = s - 1;
                    if (document.getElementById('t-validation')) document.getElementById('t-validation').style.display = 'none';
                } else {
                    if (document.getElementById('t-validation')) document.getElementById('t-validation').style.display = 'block';
                }
            });
        }

        if (genBtn) {
            genBtn.addEventListener('click', () => {
                try {
                    this.generate();
                } catch (e) {
                    console.error(e);
                    alert("Error: " + e.message);
                }
            });
        }

        if (expBtn) {
            expBtn.addEventListener('click', () => this.exportCSV());
        }

        const tabs = document.querySelectorAll('.tab');
        if (tabs) {
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                    tab.classList.add('active');
                    const targetId = tab.getAttribute('data-tab');
                    const content = document.getElementById(targetId);
                    if (content) content.classList.add('active');
                });
            });
        }
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
        const tInput = document.getElementById('t-input');
        const rInput = document.getElementById('r-input');
        const locInput = document.getElementById('loc-input');
        const plotInput = document.getElementById('plot-input');
        const seedInput = document.getElementById('seed-input');
        const trtNamesInput = document.getElementById('trt-names');

        if (!tInput || !rInput) return;

        const t = parseInt(tInput.value);
        const r = parseInt(rInput.value);
        const lCount = parseInt(locInput.value);
        const startPlot = parseInt(plotInput.value);

        const rawSeed = seedInput.value;
        let seed = (rawSeed !== "" && rawSeed !== null) ? parseInt(rawSeed) : Math.floor(Math.random() * 999999);

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

        const trtNamesRaw = trtNamesInput ? trtNamesInput.value.split('\n').filter(x => x.trim() !== '') : [];
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
                let repTrts = [...treatments];
                this.shuffle(repTrts);

                const iblocks = [];
                // Divide k into blocks of size k (actually blockSize = k). 
                // Number of blocks = s. Total treatments = s * k = s(s-1) = t. Correct.
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
        if (!this.currentDesign) return;
        const { t, r, k, s, lCount, startPlot, seed, lambda, locationsData } = this.currentDesign;

        if (document.getElementById('info-s')) document.getElementById('info-s').textContent = s;
        if (document.getElementById('info-k')) document.getElementById('info-k').textContent = k;
        if (document.getElementById('info-lambda')) document.getElementById('info-lambda').textContent = lambda.toFixed(4);
        if (document.getElementById('info-total')) document.getElementById('info-total').textContent = t * r * lCount;

        const results = document.getElementById('results');
        if (results) results.style.display = 'block';

        // Render Table
        const tbody = document.querySelector('#field-book-table tbody');
        if (tbody) {
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
        }

        // Render Map
        const mapContainer = document.getElementById('map-container');
        if (mapContainer) {
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
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        if (document.getElementById('generate-btn')) {
            window.app = new RectangularLatticeGenerator();
        }
    } catch (e) {
        console.error("Rectangular Lattice Init Error", e);
    }
});
