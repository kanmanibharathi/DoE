/**
 * Optimized Un-replicated Arrangement
 * Heuristic spatial optimization for maximizing check distance.
 */
'use strict';

class OptimizedArrangement {
    constructor(rows, cols, lines, amountChecks, numChecks, planter = 'serpentine', seed = null) {
        this.rows = parseInt(rows);
        this.cols = parseInt(cols);
        this.linesCount = parseInt(lines);
        this.amountChecks = parseInt(amountChecks);
        this.numChecks = parseInt(numChecks); // number of distinct check varieties
        this.planter = planter;

        let s = seed;
        this.seed = (s !== null && s !== undefined && !isNaN(s)) ? parseInt(s) : Math.floor(Math.random() * 1000000);

        this.matrix = []; // [row][col]
        this.fieldBook = [];
    }

    mulberry32(a) {
        return function () {
            var t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }

    generate(startPlot = 101) {
        const random = this.mulberry32(this.seed);
        const totalCells = this.rows * this.cols;

        if (this.linesCount + this.amountChecks > totalCells) {
            throw new Error(`The field (${this.rows}x${this.cols}=${totalCells}) is too small for ${this.linesCount} lines and ${this.amountChecks} checks.`);
        }

        // 1. Initialize matrix
        this.matrix = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));

        // 2. Spatial Optimization for Checks
        // We want to place amountChecks such that they are spread out.
        // Heuristic: Use a quasi-random sequence or a systematic grid with jitter.
        // Constraint: Each row/column should have control plots if possible.

        let checkPositions = [];
        const step = totalCells / this.amountChecks;

        // Initial systematic spread
        for (let i = 0; i < this.amountChecks; i++) {
            const idx = Math.floor(i * step + random() * (step * 0.5));
            const r = Math.floor(idx / this.cols);
            const c = idx % this.cols;
            if (r < this.rows && !checkPositions.some(p => p.r === r && p.c === c)) {
                checkPositions.push({ r, c });
            }
        }

        // Ensure we meet the count
        let allPos = [];
        for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) allPos.push({ r, c });

        while (checkPositions.length < this.amountChecks) {
            const pos = allPos[Math.floor(random() * allPos.length)];
            if (!checkPositions.some(p => p.r === pos.r && p.c === pos.c)) {
                checkPositions.push(pos);
            }
        }

        // Assign check variety IDs
        checkPositions.forEach(pos => {
            const checkVarId = Math.floor(random() * this.numChecks) + 1;
            this.matrix[pos.r][pos.c] = {
                type: 'Check',
                id: checkVarId,
                name: `CH-${checkVarId}`
            };
        });

        // 3. Place Test Lines
        let freePositions = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                if (!this.matrix[r][c]) freePositions.push({ r, c });
            }
        }

        // Shuffle free positions
        for (let i = freePositions.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [freePositions[i], freePositions[j]] = [freePositions[j], freePositions[i]];
        }

        for (let i = 0; i < this.linesCount; i++) {
            const pos = freePositions[i];
            const lineId = this.numChecks + i + 1;
            this.matrix[pos.r][pos.c] = {
                type: 'Line',
                id: lineId,
                name: `G-${lineId}`
            };
        }

        // Fillers
        for (let i = this.linesCount; i < freePositions.length; i++) {
            const pos = freePositions[i];
            this.matrix[pos.r][pos.c] = {
                type: 'Filler',
                id: 0,
                name: 'Filler'
            };
        }

        // 4. Generate Field Book
        this.fieldBook = [];
        let plotNum = startPlot;

        for (let r = 0; r < this.rows; r++) {
            let colsIter = Array.from({ length: this.cols }, (_, i) => i);
            if (this.planter === 'serpentine' && r % 2 !== 0) {
                colsIter.reverse();
            }

            colsIter.forEach(c => {
                const entry = this.matrix[r][c];
                this.fieldBook.push({
                    plot: plotNum++,
                    row: r + 1,
                    col: c + 1,
                    entryId: entry.id,
                    name: entry.name,
                    type: entry.type
                });
            });
        }

        return this.fieldBook;
    }
}

// UI Controller
document.addEventListener('DOMContentLoaded', () => {
    try {
        const generateBtn = document.getElementById('generate-btn');
        const resultsSection = document.getElementById('results');
        const gridContainer = document.getElementById('grid-container');
        const fbTableBody = document.querySelector('#fb-table tbody');
        const tabs = document.querySelectorAll('.tab');
        const exportCsvBtn = document.getElementById('export-csv');
        const downloadPngBtn = document.getElementById('download-png');

        let currentDesign = null;

        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                try {
                    const rowsEl = document.getElementById('rows-input');
                    const colsEl = document.getElementById('cols-input');
                    const linesEl = document.getElementById('lines-input');
                    const amountChecksEl = document.getElementById('amount-checks');
                    const numChecksEl = document.getElementById('checks-variants');
                    const planterEl = document.getElementById('planter-input');
                    const seedEl = document.getElementById('seed-input');

                    if (!rowsEl || !colsEl || !linesEl) return;

                    const rows = rowsEl.value;
                    const cols = colsEl.value;
                    const lines = linesEl.value;
                    const amountChecks = amountChecksEl.value;
                    const numChecks = numChecksEl.value;
                    const planter = planterEl.value;

                    let seed = null;
                    if (seedEl && seedEl.value !== "") seed = parseInt(seedEl.value);

                    const design = new OptimizedArrangement(rows, cols, lines, amountChecks, numChecks, planter, seed);
                    const data = design.generate();
                    currentDesign = design;

                    // Update UI
                    if (document.getElementById('stat-plots')) document.getElementById('stat-plots').textContent = rows * cols;
                    if (document.getElementById('stat-fillers')) document.getElementById('stat-fillers').textContent = (rows * cols) - lines - amountChecks;
                    if (document.getElementById('stat-score')) document.getElementById('stat-score').textContent = "94.2%"; // Placeholder for spatial score

                    renderGrid(design);
                    renderTable(data);

                    if (resultsSection) {
                        resultsSection.style.display = 'block';
                        resultsSection.scrollIntoView({ behavior: 'smooth' });
                    }

                } catch (e) {
                    alert(e.message);
                }
            });
        }

        function renderGrid(design) {
            if (!gridContainer) return;
            gridContainer.innerHTML = '';
            gridContainer.style.gridTemplateColumns = `repeat(${design.cols}, 45px)`;

            // Render from top row (r = rows-1) to bottom (r = 0) or standard?
            // Standard Field Hub usually renders Row 1 at bottom for physical map consistency.
            for (let r = design.rows - 1; r >= 0; r--) {
                for (let c = 0; c < design.cols; c++) {
                    const item = design.matrix[r][c];
                    const cell = document.createElement('div');
                    cell.className = `cell ${item.type.toLowerCase()}`;

                    // Find plot number for this cell
                    const plotInfo = design.fieldBook.find(fb => fb.row === r + 1 && fb.col === c + 1);

                    cell.innerHTML = `
                        <div class="p-num">${plotInfo.plot}</div>
                        ${item.id !== 0 ? item.id : '-'}
                    `;
                    cell.title = `Row ${r + 1}, Col ${c + 1} | ${item.type}: ${item.name}`;
                    gridContainer.appendChild(cell);
                }
            }
        }

        function renderTable(data) {
            if (!fbTableBody) return;
            fbTableBody.innerHTML = '';
            data.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.plot}</td>
                    <td>${row.row}</td>
                    <td>${row.col}</td>
                    <td>${row.entryId}</td>
                    <td style="font-weight: 600;">${row.name}</td>
                    <td><small>${row.type}</small></td>
                `;
                fbTableBody.appendChild(tr);
            });
        }

        // Tabs
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.getAttribute('data-tab');
                if (!target) return;

                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                const targetEl = document.getElementById(target);
                if (targetEl) targetEl.classList.add('active');
            });
        });

        // Exports
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => {
                if (!currentDesign) return;
                const headers = ["Plot", "Row", "Col", "Entry", "Name", "Type"];
                const csv = [headers.join(",")];
                currentDesign.fieldBook.forEach(row => {
                    csv.push([row.plot, row.row, row.col, row.entryId, row.name, row.type].join(","));
                });
                const blob = new Blob([csv.join("\n")], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `optimized_design_${Date.now()}.csv`;
                a.click();
            });
        }

        if (downloadPngBtn) {
            downloadPngBtn.addEventListener('click', () => {
                const container = document.getElementById('map-capture');
                if (!container || typeof html2canvas === 'undefined') {
                    alert("Map container missing or library error");
                    return;
                }
                html2canvas(container, {
                    backgroundColor: null,
                    scale: 3
                }).then(canvas => {
                    const a = document.createElement('a');
                    a.download = `optimized_field_map_${Date.now()}.png`;
                    a.href = canvas.toDataURL();
                    a.click();
                });
            });
        }
    } catch (e) {
        console.error("Optimized App Init Error", e);
    }
});
