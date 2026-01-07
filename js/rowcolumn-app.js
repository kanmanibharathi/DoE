/**
 * Row-Column Design Generator Logic
 * Implements a heuristic randomization approach for resolvable Row-Column designs.
 */

class RowColumnGenerator {
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
        const rowsPerRep = parseInt(document.getElementById('rows-input').value);
        const r = parseInt(document.getElementById('reps-input').value);
        const lCount = parseInt(document.getElementById('loc-input').value);
        const iterations = parseInt(document.getElementById('iter-input').value);
        const startPlot = parseInt(document.getElementById('plot-input').value);
        let seed = parseInt(document.getElementById('seed-input').value);

        if (t % rowsPerRep !== 0) {
            alert(`Number of treatments (${t}) must be divisible by the number of rows (${rowsPerRep}).`);
            return;
        }

        const colsPerRep = t / rowsPerRep;
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
                // Initialize replicate with a random shuffle
                let repTrts = [...treatments];
                this.shuffle(repTrts);

                // Arrange into rows and columns
                let grid = [];
                for (let rIdx = 0; rIdx < rowsPerRep; rIdx++) {
                    grid.push(repTrts.slice(rIdx * colsPerRep, (rIdx + 1) * colsPerRep));
                }

                // Optimization Heuristic (Simple approach: Shuffle rows and columns multiple times)
                // In a real RowCol design, we'd calculate A-Efficiency and swap.
                // For this generator, we will perform row-wise and column-wise randomization
                // to mimic the "Resolvable Row-Column" property.
                for (let iter = 0; iter < iterations / 100; iter++) {
                    // Randomly swap two elements in a column (maintaining resolvable property)
                    const c = Math.floor(this.mulberry() * colsPerRep);
                    const r1 = Math.floor(this.mulberry() * rowsPerRep);
                    const r2 = Math.floor(this.mulberry() * rowsPerRep);
                    [grid[r1][c], grid[r2][c]] = [grid[r2][c], grid[r1][c]];
                }

                locReps.push(grid);
            }
            locationsData.push(locReps);
        }

        this.currentDesign = {
            t, rowsPerRep, colsPerRep, r, lCount, startPlot, seed, iterations, locationsData
        };

        this.render();
    }

    render() {
        const { t, rowsPerRep, colsPerRep, r, lCount, startPlot, seed, locationsData } = this.currentDesign;

        document.getElementById('info-rows').textContent = rowsPerRep;
        document.getElementById('info-cols').textContent = colsPerRep;
        document.getElementById('info-total').textContent = t * r * lCount;

        document.getElementById('results').style.display = 'block';

        // Render Table
        const tbody = document.querySelector('#field-book-table tbody');
        tbody.innerHTML = '';
        const fieldBookRows = [];

        let globalId = 1;
        locationsData.forEach((locReps, lIdx) => {
            let locStartPlot = startPlot + (lIdx * 1000);
            locReps.forEach((repGrid, rIdx) => {
                const repId = rIdx + 1;
                // Field orientation: Rows then Columns
                repGrid.forEach((row, rowIdx) => {
                    const rowNum = rowIdx + 1;
                    row.forEach((trt, colIdx) => {
                        const colNum = colIdx + 1;
                        const plot = locStartPlot + (rIdx * t) + (rowIdx * colsPerRep) + colIdx;

                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td>${globalId}</td>
                            <td>Loc ${lIdx + 1}</td>
                            <td>${plot}</td>
                            <td>${repId}</td>
                            <td>${rowNum}</td>
                            <td>${colNum}</td>
                            <td>${trt.entry}</td>
                            <td>${trt.name}</td>
                        `;
                        tbody.appendChild(tr);

                        fieldBookRows.push({
                            id: globalId++,
                            location: lIdx + 1,
                            plot: plot,
                            rep: repId,
                            row: rowNum,
                            column: colNum,
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
            const locHeader = document.createElement('h3');
            locHeader.style.margin = '2rem 0 1rem';
            locHeader.style.color = 'var(--text-dim)';
            locHeader.textContent = `Location ${lIdx + 1}`;
            mapContainer.appendChild(locHeader);

            locReps.forEach((repGrid, rIdx) => {
                const repDiv = document.createElement('div');
                repDiv.className = 'replicate-group';
                repDiv.innerHTML = `<div class="replicate-title">Replicate ${rIdx + 1}</div>`;

                const grid = document.createElement('div');
                grid.className = 'matrix-grid';
                grid.style.gridTemplateColumns = `repeat(${colsPerRep}, 1fr)`;

                let locStartPlot = startPlot + (lIdx * 1000);
                repGrid.forEach((row, rowIdx) => {
                    row.forEach((trt, colIdx) => {
                        const plot = locStartPlot + (rIdx * t) + (rowIdx * colsPerRep) + colIdx;
                        const cell = document.createElement('div');
                        cell.className = 'cell';
                        cell.innerHTML = `
                            <div class="cell-plot">${plot}</div>
                            <div class="trt-name">${trt.name}</div>
                        `;
                        grid.appendChild(cell);
                    });
                });

                repDiv.appendChild(grid);
                mapContainer.appendChild(repDiv);
            });
        });
    }

    exportCSV() {
        if (!this.fieldBookData) return;
        let csv = 'ID,Location,Plot,Rep,Row,Column,Entry,Treatment\n';
        this.fieldBookData.forEach(row => {
            csv += `${row.id},${row.location},${row.plot},${row.rep},${row.row},${row.column},${row.entry},"${row.name}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'RowColumn_FieldBook.csv';
        a.click();
    }

    copyToClipboard() {
        if (!this.fieldBookData) return;
        let text = 'Plot\tRep\tRow\tCol\tEntry\tName\n';
        this.fieldBookData.forEach(row => {
            text += `${row.plot}\t${row.rep}\t${row.row}\t${row.column}\t${row.entry}\t${row.name}\n`;
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
            link.download = 'RowColumn_FieldMap.png';
            link.href = canvas.toDataURL();
            link.click();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new RowColumnGenerator();
});
