/**
 * Latin Square Design Logic
 * Implements randomized Latin Square generation for NxN grids.
 */

class LatinSquareGenerator {
    constructor(t, reps, planter = 'serpentine', seed = null) {
        this.t = parseInt(t); // Max 10
        this.reps = parseInt(reps);
        this.planter = planter;
        this.seed = seed || Math.floor(Math.random() * 1000000);
        this.fieldBook = [];
        this.squares = []; // Array of 2D matrices [rep][row][col]
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

    generate(startPlot = 101) {
        const random = this.mulberry32(this.seed);
        this.fieldBook = [];
        this.squares = [];

        for (let r = 0; r < this.reps; r++) {
            // 1. Create standard latin square (i + j) % t
            let square = Array.from({ length: this.t }, (_, i) =>
                Array.from({ length: this.t }, (_, j) => (i + j) % this.t)
            );

            // 2. Randomize rows
            let rowIndices = Array.from({ length: this.t }, (_, i) => i);
            this.shuffle(rowIndices, random);
            let rowP = rowIndices.map(i => square[i]);

            // 3. Randomize columns
            let colIndices = Array.from({ length: this.t }, (_, i) => i);
            this.shuffle(colIndices, random);
            let colP = Array.from({ length: this.t }, () => Array(this.t));
            for (let i = 0; i < this.t; i++) {
                for (let j = 0; j < this.t; j++) {
                    colP[i][j] = rowP[i][colIndices[j]];
                }
            }

            // 4. Randomize treatment labels
            let trtIndices = Array.from({ length: this.t }, (_, i) => i);
            this.shuffle(trtIndices, random);
            // trtIndices maps index in matrix to actual treatment number (1-based)
            // e.g. matrix[i][j] = 0 -> trtIndices[0] + 1

            let finalSquare = colP.map(row => row.map(val => trtIndices[val] + 1));
            this.squares.push(finalSquare);

            // 5. Generate field book entries
            let plotNum = startPlot + (r * this.t * this.t);

            for (let ri = 0; ri < this.t; ri++) {
                let colsIter = Array.from({ length: this.t }, (_, i) => i);
                if (this.planter === 'serpentine' && ri % 2 !== 0) {
                    colsIter.reverse();
                }

                colsIter.forEach(ci => {
                    this.fieldBook.push({
                        id: this.fieldBook.length + 1,
                        plot: plotNum++,
                        square: r + 1,
                        row: ri + 1,
                        column: ci + 1,
                        treatment: finalSquare[ri][ci],
                        treatmentLabel: `T${finalSquare[ri][ci]}`
                    });
                });
            }
        }
        return this.fieldBook;
    }
}

// UI Controller
document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const resultsSection = document.getElementById('results');
    const fbTableBody = document.querySelector('#fb-table tbody');
    const lsContainer = document.getElementById('ls-container');
    const squarePillsContainer = document.getElementById('square-pills-container');
    const tabs = document.querySelectorAll('.tab');

    let currentGenerator = null;
    let selectedSqIdx = 0;

    generateBtn.addEventListener('click', () => {
        const t = document.getElementById('t-input').value;
        const reps = document.getElementById('reps-input').value;
        const planter = document.getElementById('planter-input').value;
        const plotStart = parseInt(document.getElementById('plot-start').value);
        const seedInput = document.getElementById('seed-input').value;

        if (t > 10) { alert('Max 10 treatments allowed for Latin Square.'); return; }

        const seed = seedInput ? parseInt(seedInput) : Math.floor(Math.random() * 1000000);

        try {
            const generator = new LatinSquareGenerator(t, reps, planter, seed);
            generator.generate(plotStart);
            currentGenerator = generator;

            renderPills(reps);
            showSquare(0);
            renderTable(generator.fieldBook);

            resultsSection.style.display = 'block';
            resultsSection.scrollIntoView({ behavior: 'smooth' });

        } catch (e) { alert(e.message); }
    });

    function renderPills(count) {
        squarePillsContainer.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const pill = document.createElement('div');
            pill.className = `pill ${i === 0 ? 'active' : ''}`;
            pill.textContent = `Square ${i + 1}`;
            pill.onclick = () => {
                document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                showSquare(i);
            };
            squarePillsContainer.appendChild(pill);
        }
    }

    function showSquare(idx) {
        selectedSqIdx = idx;
        const square = currentGenerator.squares[idx];
        const t = currentGenerator.t;
        const fb = currentGenerator.fieldBook.filter(d => d.square === idx + 1);

        lsContainer.innerHTML = '';
        lsContainer.style.gridTemplateColumns = `repeat(${t}, 75px)`;

        // We use the field book to get plots for the specific row/col
        for (let r = 0; r < t; r++) {
            for (let c = 0; c < t; c++) {
                const trt = square[r][c];
                const entry = fb.find(d => d.row === r + 1 && d.column === c + 1);

                const cell = document.createElement('div');
                cell.className = `ls-cell treatment-color-${trt}`;
                cell.innerHTML = `
                    <div class="p-num">P${entry.plot}</div>
                    T${trt}
                    <div class="row-col">R${r + 1} C${c + 1}</div>
                `;
                cell.title = `Row ${r + 1}, Col ${c + 1}, Plot ${entry.plot}`;
                lsContainer.appendChild(cell);
            }
        }
    }

    function renderTable(data) {
        fbTableBody.innerHTML = '';
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.id}</td>
                <td style="font-weight: 700;">${row.plot}</td>
                <td>${row.square}</td>
                <td>${row.row}</td>
                <td>${row.column}</td>
                <td><span class="treatment-color-${row.treatment}" style="padding: 2px 8px; border-radius: 4px;">${row.treatmentLabel}</span></td>
            `;
            fbTableBody.appendChild(tr);
        });
    }

    // Tabs
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(target).classList.add('active');
        });
    });

    // Exports
    document.getElementById('export-csv').addEventListener('click', () => {
        const headers = ["ID", "Plot", "Square", "Row", "Column", "Treatment"];
        const csv = [headers.join(",")];
        currentGenerator.fieldBook.forEach(row => {
            csv.push([row.id, row.plot, row.square, row.row, row.column, row.treatmentLabel].join(","));
        });
        const blob = new Blob([csv.join("\n")], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `latin_square_design_${Date.now()}.csv`;
        a.click();
    });

    document.getElementById('download-png').addEventListener('click', () => {
        const container = document.getElementById('ls-container');
        html2canvas(container, {
            backgroundColor: null,
            scale: 3
        }).then(canvas => {
            const a = document.createElement('a');
            a.download = `latin_square_rep${selectedSqIdx + 1}.png`;
            a.href = canvas.toDataURL();
            a.click();
        });
    });

//     document.getElementById('copy-clipboard').addEventListener('click', () => {
//         const text = document.getElementById('fb-table').innerText;
//         navigator.clipboard.writeText(text).then(() => {
//             const btn = document.getElementById('copy-clipboard');
//             const old = btn.innerHTML;
//             btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
//             setTimeout(() => btn.innerHTML = old, 2000);
//         });
    });
});
