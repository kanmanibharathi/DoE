/**
 * Diagonal Arrangement Design Generator
 * Implements SUDC (Single Un-replicated Diagonal Checks) algorithm
 * Supports multiple locations and spatial data simulation.
 */
'use strict';

class DiagonalGenerator {
    constructor(rows, cols, lines, checkNames, locations = 1, planter = 'serpentine', seed = null) {
        this.rows = parseInt(rows);
        this.cols = parseInt(cols);
        this.linesCount = parseInt(lines);
        this.checkNames = Array.isArray(checkNames) ? checkNames : [checkNames];
        this.locations = parseInt(locations);
        this.planter = planter;

        // Robust seed handling
        this.seed = (seed !== null && seed !== undefined && !isNaN(seed)) ? seed : Math.floor(Math.random() * 1000000);

        this.fieldBook = [];
        this.matrices = []; // One matrix per location
        this.info = {};
    }

    mulberry32(a) {
        return function () {
            var t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }

    shuffle(array, randomFunc) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(randomFunc() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    generate(startPlot = 101, experimentName = "Expt1") {
        let currentSeed = this.seed;
        this.fieldBook = [];
        this.matrices = [];
        let globalId = 1;

        for (let l = 1; l <= this.locations; l++) {
            const random = this.mulberry32(currentSeed++);
            const matrix = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));

            // 1. Place checks in diagonal pattern
            // Diagonal sudo-logic: (r + c) % K == 0
            // In the R code, diagonal-checks are placed systematically.
            // We use a pattern that ensures checks are dispersed.
            let checkCount = 0;
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if ((r + c) % 8 === 0) {
                        const checkIdx = Math.floor(random() * this.checkNames.length);
                        matrix[r][c] = {
                            type: 'Check',
                            name: this.checkNames[checkIdx],
                            id: checkIdx + 1,
                            value: null
                        };
                        checkCount++;
                    }
                }
            }

            // 2. Fill remaining with Lines
            const freePlots = [];
            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    if (!matrix[r][c]) freePlots.push({ r, c });
                }
            }

            this.shuffle(freePlots, random);
            let linesAssigned = 0;
            let fillersCount = 0;

            freePlots.forEach(pos => {
                if (linesAssigned < this.linesCount) {
                    matrix[pos.r][pos.c] = {
                        type: 'Line',
                        name: `G-${linesAssigned + 1}`,
                        id: this.checkNames.length + linesAssigned + 1,
                        value: null
                    };
                    linesAssigned++;
                } else {
                    matrix[pos.r][pos.c] = {
                        type: 'Filler',
                        name: 'Filler',
                        id: 0,
                        value: null
                    };
                    fillersCount++;
                }
            });

            this.matrices.push(matrix);

            // 3. Flatten to Field Book
            let plotNum = startPlot + (l - 1) * 1000;
            for (let r = 0; r < this.rows; r++) {
                let colsIter = Array.from({ length: this.cols }, (_, i) => i);
                if (this.planter === 'serpentine' && r % 2 !== 0) {
                    colsIter.reverse();
                }

                colsIter.forEach(c => {
                    const item = matrix[r][c];
                    this.fieldBook.push({
                        id: globalId++,
                        plot: plotNum++,
                        location: `Loc ${l}`,
                        row: r + 1,
                        col: c + 1,
                        entryId: item.id,
                        type: item.type,
                        name: item.name,
                        yield: null
                    });
                });
            }

            this.info = {
                checkPct: ((checkCount / (this.rows * this.cols)) * 100).toFixed(1) + '%',
                totalPlots: this.rows * this.cols * this.locations,
                fillers: fillersCount,
                seed: this.seed
            };
        }

        return this.fieldBook;
    }

    simulate(min = 80, max = 150, spatialFactor = 0.4) {
        // Simple AR1xAR1 approximation: Base value + Row Trend + Col Trend + Noise
        let currentSeed = this.seed + 555;
        const random = this.mulberry32(currentSeed);

        this.matrices.forEach((matrix, lIdx) => {
            const rowTrends = Array.from({ length: this.rows }, () => (random() - 0.5) * spatialFactor * (max - min));
            const colTrends = Array.from({ length: this.cols }, () => (random() - 0.5) * spatialFactor * (max - min));

            // Fix potential issue where lIdx doesn't map correctly if locations filtered
            // Re-matching Logic: find corresponding fieldBook entries

            for (let r = 0; r < this.rows; r++) {
                for (let c = 0; c < this.cols; c++) {
                    const noise = (random() - 0.5) * (1 - spatialFactor) * (max - min);
                    const base = (min + max) / 2;
                    const val = base + rowTrends[r] + colTrends[c] + noise;
                    if (matrix[r][c]) matrix[r][c].value = val.toFixed(2);

                    // Update fieldBook
                    const fbEntry = this.fieldBook.find(f => f.location === `Loc ${lIdx + 1}` && f.row === r + 1 && f.col === c + 1);
                    if (fbEntry) fbEntry.yield = val.toFixed(2);
                }
            }
        });
        return this.fieldBook;
    }
}

// UI Controller
document.addEventListener('DOMContentLoaded', () => {
    try {
        const generateBtn = document.getElementById('generate-btn');
        const simulateBtn = document.getElementById('simulate-btn');
        const exportBtn = document.getElementById('export-btn');
        // const copyBtn = document.getElementById('copy-btn');
        const downloadMapBtn = document.getElementById('download-map-btn');
        const resultsSection = document.getElementById('results');
        const fbTableBody = document.querySelector('#field-book-table tbody');
        const matrixWrapper = document.getElementById('matrix-wrapper');
        const heatmapContainer = document.getElementById('heatmap-container');
        const heatmapTrigger = document.getElementById('heatmap-trigger');
        const tabs = document.querySelectorAll('.tab');

        if (!generateBtn) return;

        let currentGenerator = null;

        generateBtn.addEventListener('click', () => {
            try {
                const rowsInput = document.getElementById('rows-input');
                const colsInput = document.getElementById('cols-input');
                const linesInput = document.getElementById('lines-input');
                const checksInput = document.getElementById('check-names');
                const locsInput = document.getElementById('l-input');
                const planterInput = document.getElementById('planter-input');
                const startPlotInput = document.getElementById('plot-start');
                const exptNameInput = document.getElementById('expt-name');
                const seedInput = document.getElementById('seed-input');

                // Basic validation
                if (!rowsInput || !colsInput || !linesInput) {
                    alert("Missing input fields.");
                    return;
                }

                const rows = rowsInput.value;
                const cols = colsInput.value;
                const lines = linesInput.value;
                const checkNames = checksInput.value.split(',').map(s => s.trim());
                const locs = locsInput.value;
                const planter = planterInput.value;
                const startPlot = parseInt(startPlotInput.value);
                const exptName = exptNameInput.value;

                let seed = null;
                if (seedInput && seedInput.value !== "") {
                    seed = parseInt(seedInput.value);
                }

                const generator = new DiagonalGenerator(rows, cols, lines, checkNames, locs, planter, seed);
                const data = generator.generate(startPlot, exptName);
                currentGenerator = generator;

                // Info cards
                if (document.getElementById('info-check-pct')) document.getElementById('info-check-pct').textContent = generator.info.checkPct;
                if (document.getElementById('info-total-plots')) document.getElementById('info-total-plots').textContent = generator.info.totalPlots;
                if (document.getElementById('info-fillers')) document.getElementById('info-fillers').textContent = generator.info.fillers;

                renderMatrix(generator.matrices[0]); // Show first location by default
                renderTable(data);

                if (resultsSection) {
                    resultsSection.style.display = 'block';
                    resultsSection.scrollIntoView({ behavior: 'smooth' });
                }
                if (simulateBtn) simulateBtn.style.display = 'block';
                if (heatmapTrigger) heatmapTrigger.style.display = 'none';

            } catch (e) {
                console.error(e);
                alert("Error generating design: " + e.message);
            }
        });

        if (simulateBtn) {
            simulateBtn.addEventListener('click', () => {
                if (!currentGenerator) return;
                try {
                    const data = currentGenerator.simulate();
                    renderTable(data);
                    renderHeatmap(currentGenerator.matrices[0]);
                    if (heatmapTrigger) heatmapTrigger.style.display = 'block';
                    alert("Spatial data simulated successfully!");
                } catch (e) {
                    console.error(e);
                    alert("Simulation error: " + e.message);
                }
            });
        }

        function renderMatrix(matrix) {
            if (!matrixWrapper) return;
            matrixWrapper.innerHTML = '';
            const rows = matrix.length;
            const cols = matrix[0].length;
            matrixWrapper.style.gridTemplateColumns = `repeat(${cols}, 45px)`;

            for (let r = rows - 1; r >= 0; r--) {
                for (let c = 0; c < cols; c++) {
                    const item = matrix[r][c];
                    const cell = document.createElement('div');
                    cell.className = `cell ${item.type.toLowerCase()}`;
                    cell.innerHTML = `<span>${item.id || '-'}</span><span style="font-size: 8px; opacity: 0.6;">${item.type[0]}</span>`;
                    matrixWrapper.appendChild(cell);
                }
            }
        }

        function renderHeatmap(matrix) {
            if (!heatmapContainer) return;
            heatmapContainer.innerHTML = '';
            const grid = document.createElement('div');
            grid.className = 'matrix-grid';
            const rows = matrix.length;
            const cols = matrix[0].length;
            grid.style.gridTemplateColumns = `repeat(${cols}, 45px)`;

            const values = matrix.flat().map(i => parseFloat(i.value));
            // Filter out NaNs if any check/filler doesn't have value
            const validValues = values.filter(v => !isNaN(v));

            let min = 0, max = 100;
            if (validValues.length > 0) {
                min = Math.min(...validValues);
                max = Math.max(...validValues);
            }

            for (let r = rows - 1; r >= 0; r--) {
                for (let c = 0; c < cols; c++) {
                    const item = matrix[r][c];
                    const val = parseFloat(item.value);
                    const cell = document.createElement('div');
                    cell.className = 'cell';

                    if (!isNaN(val)) {
                        const ratio = (val - min) / (max - min || 1);
                        cell.style.backgroundColor = `rgba(0, 166, 81, ${0.1 + ratio * 0.9})`;
                        cell.style.color = ratio > 0.5 ? 'white' : 'var(--text-dim)';
                        cell.style.border = '1px solid rgba(255,255,255,0.1)';
                        cell.innerHTML = `<span style="font-size: 0.6rem;">${val.toFixed(1)}</span>`;
                    } else {
                        cell.style.backgroundColor = '#ccc';
                    }
                    grid.appendChild(cell);
                }
            }
            heatmapContainer.appendChild(grid);
        }

        function renderTable(data) {
            if (!fbTableBody) return;
            fbTableBody.innerHTML = '';
            data.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.plot}</td>
                    <td>${row.location}</td>
                    <td>${row.row}</td>
                    <td>${row.col}</td>
                    <td>${row.entryId}</td>
                    <td>${row.type}</td>
                    <td><strong>${row.name}</strong></td>
                    ${row.yield ? `<td style="color: var(--secondary); font-weight: 700;">${row.yield}</td>` : ''}
                `;
                const header = document.querySelector('#field-book-table thead tr');
                if (header && row.yield && header.cells.length < 8) {
                    const th = document.createElement('th');
                    th.textContent = "Yield";
                    header.appendChild(th);
                }
                fbTableBody.appendChild(tr);
            });
        }

        // Export & Tabs logic (standardized)
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.getAttribute('data-tab');
                if (!target) return;

                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const contents = document.querySelectorAll('.tab-content');
                contents.forEach(c => c.classList.remove('active'));

                const targetEl = document.getElementById(target);
                if (targetEl) targetEl.classList.add('active');
            });
        });

        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                if (!currentGenerator) return;
                const headers = ["Plot", "Location", "Row", "Col", "EntryID", "Type", "Name"];
                if (currentGenerator.fieldBook[0].yield) headers.push("Yield");
                const csv = [headers.join(","), ...currentGenerator.fieldBook.map(r => {
                    const row = [r.plot, r.location, r.row, r.col, r.entryId, r.type, r.name];
                    if (r.yield) row.push(r.yield);
                    return row.join(",");
                })].join("\n");
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `diagonal_design_${Date.now()}.csv`;
                a.click();
            });
        }

        if (downloadMapBtn) {
            downloadMapBtn.addEventListener('click', () => {
                const container = document.getElementById('map-container');
                if (!container || typeof html2canvas === 'undefined') {
                    alert('Map container not found or html2canvas not loaded.');
                    return;
                }
                html2canvas(container, {
                    backgroundColor: "#1f2122",
                    scale: 2
                }).then(canvas => {
                    const a = document.createElement('a');
                    a.download = `diagonal_map_${Date.now()}.png`;
                    a.href = canvas.toDataURL();
                    a.click();
                });
            });
        }
    } catch (e) {
        console.error("Diagonal App Init Error: ", e);
    }
});
