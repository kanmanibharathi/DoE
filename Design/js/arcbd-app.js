/**
 * Augmented Randomized Complete Block Design (ARCBD) Design Generator
 * Implementation based on FielDHub ARCBD logic.
 */

class ARCBDGenerator {
    constructor() {
        this.initEventListeners();
        this.mulberry = null;
    }

    initEventListeners() {
        document.getElementById('generate-btn').addEventListener('click', () => this.generate());
        document.getElementById('export-btn').addEventListener('click', () => this.exportCSV());
//         document.getElementById('copy-btn').addEventListener('click', () => this.copyToClipboard());
//         document.getElementById('download-map-btn').addEventListener('click', () => this.downloadMap());
// 
//         // Tab switching
//         document.querySelectorAll('.tab').forEach(tab => {
//             tab.addEventListener('click', (e) => {
//                 document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
//                 document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
//                 e.target.classList.add('active');
//                 document.getElementById(e.target.dataset.tab).classList.add('active');
//             });
        });
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
        const linesCount = parseInt(document.getElementById('lines-input').value);
        const checksCount = parseInt(document.getElementById('checks-input').value);
        const bCount = parseInt(document.getElementById('blocks-input').value);
        const lCount = parseInt(document.getElementById('locations-input').value);
        const startPlot = parseInt(document.getElementById('plot-input').value);
        const planter = document.getElementById('planter-input').value;
        let seed = parseInt(document.getElementById('seed-input').value);

        if (isNaN(seed)) seed = Math.floor(Math.random() * 999999);
        this.mulberry = this.mulberry32(seed);

        // Logic
        // all_genotypes = lines + checks * b
        // plots_per_block = ceil(all_genotypes / b)
        const totalPlotsNeeded = linesCount + (checksCount * bCount);
        const plotsPerBlock = Math.ceil(totalPlotsNeeded / bCount);
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
        let fillerIdx = 0;

        for (let i = 0; i < bCount; i++) {
            const blockContent = [...checks]; // Every block gets all checks

            // How many lines go in this block?
            // Normally lines divided by blocks.
            const baseLinesPerBlock = Math.floor(linesCount / bCount);
            let linesInThisBlock = baseLinesPerBlock;
            if (i < (linesCount % bCount)) linesInThisBlock++;

            for (let j = 0; j < linesInThisBlock; j++) {
                if (lineIdx < lines.length) {
                    blockContent.push(lines[lineIdx++]);
                }
            }

            // Fillers - R distributes them. We can distribute them to keep block sizes equal.
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
        const { blocks, plotsPerBlock, totalFieldPlots, fillerCount, seed, startPlot, planter } = this.currentDesign;

        // Update Stats
        document.getElementById('info-plots-per-block').textContent = plotsPerBlock;
        document.getElementById('info-total-plots').textContent = totalFieldPlots;
        document.getElementById('info-fillers').textContent = fillerCount;
        document.getElementById('info-seed').textContent = seed;

        document.getElementById('results').style.display = 'block';

        // Render Table
        const tbody = document.querySelector('#field-book-table tbody');
        tbody.innerHTML = '';
        const fieldBookData = [];

        let currentPlot = startPlot;
        blocks.forEach((block, bIdx) => {
            const blockId = bIdx + 1;

            // Logic for serpentine vs cartesian plot numbering
            let blockPlots = [...block];
            const isSerpentine = planter === 'serpentine';

            // If serpentine, reverse alternate blocks for plot numbering logic
            // In our simple display we just increment plot as we go.

            blockPlots.forEach((item, pIdx) => {
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
            // Skip to next hundred if needed (often done in R) but we'll stick to sequential for now 
            // unless we want to mimic the plotNumber increment logic from the R code.
            // In R: plotNumber = seq(101, 1000*(l+1), 1000)
            // But within a location it's usually consecutive.
        });

        this.fieldBookData = fieldBookData;

        // Render Map
        const mapContainer = document.getElementById('map-container');
        mapContainer.innerHTML = '';

        const matrixGrid = document.createElement('div');
        matrixGrid.className = 'matrix-grid';
        // Let's assume Each block is a horizontal row for visualization
        matrixGrid.style.gridTemplateColumns = `repeat(${plotsPerBlock}, 1fr)`;

        blocks.forEach((block, bIdx) => {
            const blockContainer = document.createElement('div');
            blockContainer.className = 'block-container';
            blockContainer.style.gridColumn = `1 / span ${plotsPerBlock}`;
            blockContainer.style.display = 'contents';

            // Serpentine check
            let displayBlock = [...block];
            if (planter === 'serpentine' && (bIdx % 2 !== 0)) {
                displayBlock.reverse();
            }

            displayBlock.forEach((item, pIdx) => {
                const cell = document.createElement('div');
                cell.className = `cell ${item.type.toLowerCase()}`;

                // We need to calculate the actual plot number for this cell based on movement
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

    exportCSV() {
        if (!this.fieldBookData) return;
        let csv = 'Plot,Block,Type,Entry,Name\n';
        this.fieldBookData.forEach(row => {
            csv += `${row.plot},${row.block},${row.type},${row.entry},"${row.name}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('hidden', '');
        a.setAttribute('href', url);
        a.setAttribute('download', 'ARCBD_FieldBook.csv');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    copyToClipboard() {
        if (!this.fieldBookData) return;
        let text = 'Plot\tBlock\tType\tEntry\tName\n';
        this.fieldBookData.forEach(row => {
            text += `${row.plot}\t${row.block}\t${row.type}\t${row.entry}\t${row.name}\n`;
        });

        navigator.clipboard.writeText(text).then(() => {
            alert('Copied to clipboard!');
        });
    }

    downloadMap() {
        const container = document.getElementById('map-container');
        html2canvas(container, {
            backgroundColor: '#1e293b',
            scale: 2
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'ARCBD_FieldMap.png';
            link.href = canvas.toDataURL();
            link.click();
        });
    }
}

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ARCBDGenerator();
});
