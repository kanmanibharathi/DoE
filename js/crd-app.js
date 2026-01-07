/**
 * CRD Design Generator
 * Implements simple random permutation with enhanced simulation and layout options
 */

class CRDGenerator {
    constructor(t, reps, loc = "Location 1", seed = null) {
        this.t = parseInt(t);
        this.reps = parseInt(reps);
        this.loc = loc;
        this.seed = seed || Math.floor(Math.random() * 100000);
        this.fieldBook = [];
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

    generate(startPlot = 101, customNames = [], layout = 'serpentine') {
        const random = this.mulberry32(this.seed);
        const totalUnits = this.t * this.reps;

        // Prepare list of treatments with their repetitions
        let units = [];
        for (let i = 1; i <= this.t; i++) {
            const trtName = customNames[i - 1] || `G-${i}`;
            for (let r = 1; r <= this.reps; r++) {
                units.push({
                    trtId: i,
                    trtName: trtName,
                    repId: r
                });
            }
        }

        // Randomize the entire sequence
        this.shuffle(units, random);

        // Assign plot numbers (supporting serpentine visual layout)
        // Since CRD is just a sequence, serpentine vs cartesian only affects the indexing
        this.fieldBook = units.map((unit, index) => {
            let plotNum;
            if (layout === 'serpentine') {
                // In a logical field grid, say 10 units wide
                const width = 10;
                const row = Math.floor(index / width);
                const col = index % width;
                if (row % 2 === 0) {
                    plotNum = startPlot + index;
                } else {
                    plotNum = startPlot + (row * width) + (width - 1 - col);
                }
            } else {
                plotNum = startPlot + index;
            }

            return {
                id: index + 1,
                plot: plotNum,
                location: this.loc || "FARGO",
                repId: unit.repId,
                trtId: unit.trtId,
                trtName: unit.trtName,
                yield: null
            };
        });

        this.info = {
            totalUnits: totalUnits,
            seed: this.seed
        };

        return this.fieldBook;
    }

    simulate(min = 50, max = 150) {
        const random = this.mulberry32(this.seed + 12345);
        this.fieldBook.forEach(row => {
            row.yield = (min + random() * (max - min)).toFixed(2);
        });
        return this.fieldBook;
    }
}

// UI Controller
document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const simulateBtn = document.getElementById('simulate-btn');
    const exportBtn = document.getElementById('export-btn');
    const copyBtn = document.getElementById('copy-btn');
    const downloadMapBtn = document.getElementById('download-map-btn');
    const resultsSection = document.getElementById('results');
    const fbTableBody = document.querySelector('#field-book-table tbody');
    const fbTableHeader = document.querySelector('#field-book-table thead tr');
    const mapContainer = document.getElementById('map-container');
    const tabs = document.querySelectorAll('.tab');

    // Inputs
    const tInput = document.getElementById('t-input');
    const repsInput = document.getElementById('reps-input');
    const plotInput = document.getElementById('plot-input');
    const seedInput = document.getElementById('seed-input');
    const layoutInput = document.getElementById('layout-input');
    const trtNamesArea = document.getElementById('trt-names');

    let currentGenerator = null;

    generateBtn.addEventListener('click', () => {
        try {
            const t = parseInt(tInput.value);
            const reps = parseInt(repsInput.value);
            const startPlot = parseInt(plotInput.value);
            const seed = seedInput.value ? parseInt(seedInput.value) : Math.floor(Math.random() * 100000);
            const layout = layoutInput.value;

            const trtNames = trtNamesArea.value.split('\n').map(n => n.trim()).filter(n => n !== "");

            const generator = new CRDGenerator(t, reps, "FARGO", seed);
            generator.generate(startPlot, trtNames, layout);
            currentGenerator = generator;

            // Update UI
            document.getElementById('info-total').textContent = generator.info.totalUnits;
            document.getElementById('info-seed').textContent = generator.info.seed;

            renderTable(generator.fieldBook);
            renderMap(generator.fieldBook);

            resultsSection.style.display = 'block';
            simulateBtn.style.display = 'block';
            resultsSection.scrollIntoView({ behavior: 'smooth' });

        } catch (e) {
            alert(e.message);
        }
    });

    simulateBtn.addEventListener('click', () => {
        if (!currentGenerator) return;
        const data = currentGenerator.simulate();
        renderTable(data);
        alert("Data simulation successful!");
    });

    function renderTable(data) {
        fbTableBody.innerHTML = '';

        // Reset header if needed
        if (fbTableHeader.cells.length > 5) {
            fbTableHeader.removeChild(fbTableHeader.lastChild);
        }

        if (data[0] && data[0].yield !== null) {
            const th = document.createElement('th');
            th.textContent = "Yield";
            fbTableHeader.appendChild(th);
        }

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.plot}</td>
                <td>${row.location}</td>
                <td>${row.repId}</td>
                <td>${row.trtId}</td>
                <td><span style="color: #2ecc71; font-weight: 600;">${row.trtName}</span></td>
                ${row.yield !== null ? `<td>${row.yield}</td>` : ''}
            `;
            fbTableBody.appendChild(tr);
        });
    }

    function renderMap(data) {
        mapContainer.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'map-grid-wrapper';

        data.forEach(plt => {
            const plotDiv = document.createElement('div');
            plotDiv.className = 'plot';
            plotDiv.innerHTML = `
                <div class="plot-num">${plt.plot}</div>
                <div class="plot-trt">${plt.trtId}</div>
                <div class="plot-rep">Rep ${plt.repId}</div>
            `;
            plotDiv.style.backgroundColor = 'rgba(0, 166, 81, 0.1)';
            plotDiv.style.border = '1px solid #00a651';
            grid.appendChild(plotDiv);
        });

        mapContainer.appendChild(grid);
    }

    // Tab Switching
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
    exportBtn.addEventListener('click', () => {
        if (!currentGenerator) return;
        const data = currentGenerator.fieldBook;
        const headers = ["Plot", "Location", "RepID", "TreatmentID", "TreatmentName"];
        if (data[0].yield !== null) headers.push("Yield");

        const csv = [
            headers.join(","),
            ...data.map(r => {
                const base = [r.plot, r.location, r.repId, r.trtId, r.trtName];
                if (r.yield !== null) base.push(r.yield);
                return base.join(",");
            })
        ].join("\n");

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `crd_design_${Date.now()}.csv`;
        a.click();
    });

//     copyBtn.addEventListener('click', () => {
//         if (!currentGenerator) return;
//         const data = currentGenerator.fieldBook;
//         const headers = ["Plot", "Location", "RepID", "TreatmentID", "TreatmentName"];
//         if (data[0].yield !== null) headers.push("Yield");
// 
//         const tsv = [
//             headers.join("\t"),
//             ...data.map(r => {
//                 const base = [r.plot, r.location, r.repId, r.trtId, r.trtName];
//                 if (r.yield !== null) base.push(r.yield);
//                 return base.join("\t");
//             })
//         ].join("\n");
// 
//         navigator.clipboard.writeText(tsv).then(() => {
//             const oldText = copyBtn.innerHTML;
//             copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
//             setTimeout(() => copyBtn.innerHTML = oldText, 2000);
//         });
    });

    downloadMapBtn.addEventListener('click', () => {
        if (!currentGenerator) return;
        const btn = downloadMapBtn;
        const oldText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Rendering...';
        btn.disabled = true;

        html2canvas(mapContainer, {
            backgroundColor: "#1f2122",
            scale: 2,
            logging: false
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `crd_field_map_${Date.now()}.png`;
            link.href = canvas.toDataURL();
            link.click();
            btn.innerHTML = oldText;
            btn.disabled = false;
        }).catch(() => {
            btn.innerHTML = oldText;
            btn.disabled = false;
        });
    });
});
