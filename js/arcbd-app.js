/**
 * Augmented Randomized Complete Block Design (ARCBD) Design Generator
 * Implementation based on FielDHub ARCBD logic.
 */
'use strict';

class ARCBDGenerator {
    constructor() {
        this.initEventListeners();
        this.mulberry = null;
        this.currentDesign = null;
        this.fieldBookData = null;
    }

    initEventListeners() {
        const generateBtn = document.getElementById('generate-btn');
        const exportBtn = document.getElementById('export-btn');

        if (generateBtn) generateBtn.addEventListener('click', () => {
            try {
                this.generate();
            } catch (e) {
                console.error(e);
                alert("Error generating design: " + e.message);
            }
        });

        if (exportBtn) exportBtn.addEventListener('click', () => this.exportCSV());

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

    // Mulberry32 PRNG
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
        const linesInput = document.getElementById('lines-input');
        const checksInput = document.getElementById('checks-input');
        const blocksInput = document.getElementById('blocks-input');
        const locsInput = document.getElementById('locations-input');
        const plotInput = document.getElementById('plot-input');
        const planterInput = document.getElementById('planter-input');
        const seedInput = document.getElementById('seed-input');

        if (!linesInput || !checksInput || !blocksInput) return;

        const linesCount = parseInt(linesInput.value);
        const checksCount = parseInt(checksInput.value);
        const bCount = parseInt(blocksInput.value);
        const lCount = parseInt(locsInput.value);
        const startPlot = parseInt(plotInput.value);
        const planter = planterInput ? planterInput.value : 'serpentine';

        const rawSeed = seedInput.value;
        let seed = (rawSeed !== "" && rawSeed !== null) ? parseInt(rawSeed) : Math.floor(Math.random() * 999999);

        if (isNaN(seed)) seed = Math.floor(Math.random() * 999999);
        this.mulberry = this.mulberry32(seed);

        // Logic
        // all_genotypes = lines + checks * b
        // plots_per_block = ceil(all_genotypes / b)
        const totalPlotsNeeded = linesCount + (checksCount * bCount);
        const plotsPerBlock = Math.ceil(totalPlotsNeeded / bCount);
        // This calculation might need refinement if (checks * b + lines) isn't evenly divisible? 
        // Actually ARCBD usually fits lines + checks. 
        // Checks are repeated in every block. Lines are appearing once only across the whole experiment (augmented).
        // Total plots = (Lines) + (Checks * Blocks).

        const totalFieldPlots = plotsPerBlock * bCount;
        const fillerCount = totalFieldPlots - totalPlotsNeeded;

        // Create Treatments
        const checks = [];
        for (let i = 1; i <= checksCount; i++) {
            checks.push({ entry: i, name: `Check ${i}`, type: 'Check' });
        }

        const lines = [];
        for (let i = 1; i <= linesCount; i++) {
            lines.push({ entry: checksCount + i, name: `Line ${checksCount + i}`, type: 'Test' });
        }
        this.shuffle(lines);

        // Distribute lines into blocks
        const blocks = [];
        let lineIdx = 0;

        // Distribute lines as evenly as possible first
        const linesPerBlockBase = Math.floor(linesCount / bCount);
        const remainderLines = linesCount % bCount;

        for (let i = 0; i < bCount; i++) {
            const blockContent = [...checks]; // Every block gets all checks

            // Determine how many lines in this block
            let linesInThisBlock = linesPerBlockBase;
            if (i < remainderLines) linesInThisBlock++;

            for (let j = 0; j < linesInThisBlock; j++) {
                if (lineIdx < lines.length) {
                    blockContent.push(lines[lineIdx++]);
                }
            }

            // Fillers - if block is still short of plotsPerBlock (due to unevenness calculation discrepancies if any)
            // But wait, standard ARCBD construction ensures lines are split.
            // If totalPlotsNeeded doesn't divide by bCount, we might have issue if we enforce Rectangular blocks.
            // Usually we want equal block sizes.

            while (blockContent.length < plotsPerBlock) {
                blockContent.push({ entry: 0, name: 'Filler', type: 'Filler' });
            }

            // Randomize within block
            this.shuffle(blockContent);
            blocks.push(blockContent);
        }

        this.currentDesign = {
            blocks,
            plotsPerBlock,
            totalFieldPlots,
            fillerCount,
            seed,
            locations: lCount,
            startPlot,
            planter
        };

        this.render();
    }

    render() {
        if (!this.currentDesign) return;
        const { blocks, plotsPerBlock, totalFieldPlots, fillerCount, seed, startPlot, planter } = this.currentDesign;

        // Update Stats
        const elPpB = document.getElementById('info-plots-per-block');
        const elTot = document.getElementById('info-total-plots');
        const elFil = document.getElementById('info-fillers');
        const elSeed = document.getElementById('info-seed');
        const resultsEl = document.getElementById('results');

        if (elPpB) elPpB.textContent = plotsPerBlock;
        if (elTot) elTot.textContent = totalFieldPlots;
        if (elFil) elFil.textContent = fillerCount;
        if (elSeed) elSeed.textContent = seed;

        if (resultsEl) {
            resultsEl.style.display = 'block';
            resultsEl.scrollIntoView({ behavior: 'smooth' });
        }

        // Render Table
        const tbody = document.querySelector('#field-book-table tbody');
        if (tbody) {
            tbody.innerHTML = '';
            const fieldBookData = [];

            let currentPlot = startPlot;
            blocks.forEach((block, bIdx) => {
                const blockId = bIdx + 1;

                // For table, we usually list in plot order.
                // If serpentine, the plot numbers follow snake path.
                // However, the `block` array is currently just randomized content.
                // We need to map `block` content to spatial plots.

                // If serpentine, and we map plots spatially 1..N, N..1
                // The plot numbers themselves increase spatially?
                // Standard convention: Plot 101, 102...
                // Serpentine means the planter drives one way then back. 
                // Does 'Plot 102' mean the second plot in the path, or the second plot to the right?
                // Usually Plot ID is spatial.
                // Let's assume Plot ID increments strictly by position in array for now for simplicity,
                // matching the other apps where we just output the list.

                let blockPlots = [...block];
                // Note: In ARCBD app original code, it didn't do the reverse logic in the *Table*, only in Map.
                // But normally we want table to reflect map.

                blockPlots.forEach((item) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${currentPlot}</td>
                        <td>${blockId}</td>
                        <td><span class="badge ${item.type.toLowerCase()}">${item.type}</span></td>
                        <td>${item.entry > 0 ? item.entry : '-'}</td>
                        <td>${item.name}</td>
                    `;
                    tbody.appendChild(tr);

                    fieldBookData.push({
                        plot: currentPlot,
                        block: blockId,
                        type: item.type,
                        entry: item.entry,
                        name: item.name
                    });

                    currentPlot++;
                });
            });
            this.fieldBookData = fieldBookData;
        }

        // Render Map
        const mapContainer = document.getElementById('map-container');
        if (mapContainer) {
            mapContainer.innerHTML = '';

            const matrixGrid = document.createElement('div');
            matrixGrid.className = 'matrix-grid';
            matrixGrid.style.gridTemplateColumns = `repeat(${plotsPerBlock}, 1fr)`;

            blocks.forEach((block, bIdx) => {
                // Serpentine visual adjustment
                let displayBlock = [...block];
                if (planter === 'serpentine' && (bIdx % 2 !== 0)) {
                    displayBlock.reverse();
                }

                displayBlock.forEach((item, pIdx) => {
                    const cell = document.createElement('div');
                    cell.className = `cell ${item.type.toLowerCase()}`;

                    // We try to reconstruct the plot number shown in the cell
                    // based on the previous simple sequential numbering.
                    // This is tricky if we don't store it. 
                    // Let's approximate:
                    // StartPlot + (BlockIndex * PlotsPerBlock) + (pIdx if normal, inverted if serpentine reverse)

                    let plotInBlockOffset = pIdx;
                    if (planter === 'serpentine' && (bIdx % 2 !== 0)) {
                        // If displayed reversed, the Item at pIdx=0 is actually the last one in physical order?
                        // If we reversed the array `displayBlock`, then the item at index 0 
                        // IS the one that was at index `length-1` in the original `block`.
                        // So its original index in `block` (which corresponds to sequential plot numbers) was `length-1`.
                        // Wait, `fieldBookData` was generated sequentially from `block` (unreversed).
                        // So `block[0]` has `Plot X`. `block[last]` has `Plot X+N`.
                        // If we display `block[last]` first (visual left), it should show `Plot X+N`.

                        // We need to find the item in valid objects to get its assigned plot.
                        // But `item` is just a plain object {entry, name...} which we reused.
                        // We should map back to field book data?
                    }

                    // Easier way: Store plot in item during table generation or find it.
                    // Let's just lookup roughly or recalculate.

                    // Actually, simpler: just display content. Plot numbers in map are nice but maybe not critical if complicated.
                    // But wait, the previous code tried to calc `actualPlot`.
                    // Let's use the same logic as previous code but correctly.

                    let actualPlot;
                    if (planter === 'serpentine') {
                        if (bIdx % 2 === 0) {
                            actualPlot = startPlot + (bIdx * plotsPerBlock) + pIdx;
                        } else {
                            actualPlot = startPlot + (bIdx * plotsPerBlock) + (plotsPerBlock - 1 - pIdx);
                        }
                    } else {
                        actualPlot = startPlot + (bIdx * plotsPerBlock) + pIdx;
                    }

                    cell.innerHTML = `
                        <div class="plot-id">${actualPlot}</div>
                        <div class="trt-name">${item.name}</div>
                    `;
                    matrixGrid.appendChild(cell);
                });
            });

            mapContainer.appendChild(matrixGrid);
        }
    }

    exportCSV() {
        if (!this.fieldBookData) return;
        let csv = 'Plot,Block,Type,Entry,Name\n';
        this.fieldBookData.forEach(row => {
            csv += `${row.plot},${row.block},${row.type},${row.entry},"${row.name}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'ARCBD_FieldBook.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
    try {
        if (document.getElementById('generate-btn')) {
            window.app = new ARCBDGenerator();
        }
    } catch (e) {
        console.error("ARCBD Init Error", e);
    }
});
