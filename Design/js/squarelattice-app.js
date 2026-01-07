/**
 * Square Lattice Design Logic
 * Implementation for Research Hub
 */

class SquareLatticeDesign {
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
//         // Tab Switching
//         document.querySelectorAll('.tab').forEach(tab => {
//             tab.addEventListener('click', () => {
//                 document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
//                 document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
//                 tab.classList.add('active');
//                 document.getElementById(tab.dataset.tab).classList.add('active');
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
        // Inputs
        const tInput = parseInt(document.getElementById('t-input').value);
        const rInput = parseInt(document.getElementById('r-input').value);
        const lCount = parseInt(document.getElementById('loc-input').value);
        const startPlot = parseInt(document.getElementById('plot-input').value);
        let seed = parseInt(document.getElementById('seed-input').value);
        const dataInput = document.getElementById('data-input').value;

        // Validation
        if (isNaN(tInput) || tInput < 4) {
            alert("Number of treatments must be at least 4.");
            return;
        }
        const k = Math.sqrt(tInput);
        if (k % 1 !== 0) {
            alert("Number of treatments must be a square number (4, 9, 16, 25, 49, 64, 81, 100, etc.)");
            return;
        }

        if (isNaN(seed)) seed = Math.floor(Math.random() * 999999);
        this.mulberry = this.mulberry32(seed);

        // Prepare Treatments
        let treatments = [];
        if (dataInput.trim().length > 0) {
            treatments = dataInput.split(',').map(s => s.trim()).filter(s => s.length > 0);
            if (treatments.length !== tInput) {
                alert(`Treatment list length (${treatments.length}) does not match Total Treatments (${tInput}).`);
                return;
            }
        } else {
            treatments = Array.from({ length: tInput }, (_, i) => `G-${i + 1}`);
        }

        const data = [];
        const entryMap = treatments.map((t, i) => ({ entry: i + 1, label: t }));

        for (let l = 1; l <= lCount; l++) {
            const locName = lCount === 1 ? "Main Site" : `Location ${l}`;
            let plotCounter = startPlot + (l - 1) * 1000;

            for (let r = 1; r <= rInput; r++) {
                // For a Square Lattice k x k
                // We create k blocks of size k
                let blocks = [];

                // Deterministic mapping based on Replicate
                // Rep 1: Traditional Rows (1-k, k+1-2k, ...)
                // Rep 2: Traditional Columns (1, 1+k, 1+2k, ... | 2, 2+k, 2+2k, ...)
                // Rep 3+: Random permutations of block membership

                if (r === 1) {
                    for (let i = 0; i < k; i++) {
                        blocks.push(entryMap.slice(i * k, (i + 1) * k));
                    }
                } else if (r === 2) {
                    for (let j = 0; j < k; j++) {
                        let block = [];
                        for (let i = 0; i < k; i++) {
                            block.push(entryMap[i * k + j]);
                        }
                        blocks.push(block);
                    }
                } else {
                    // For R >= 3, we generate pseudo-orthogonality via shuffling 
                    // This is a "Partially Balanced Lattice" approach
                    let shuffled = this.shuffle([...entryMap]);
                    for (let i = 0; i < k; i++) {
                        blocks.push(shuffled.slice(i * k, (i + 1) * k));
                    }
                }

                // Randomize:
                // 1. Shuffling treatments within each incomplete block
                // 2. Shuffling the order of incomplete blocks within the replicate
                blocks = blocks.map(b => this.shuffle([...b]));
                const randomizedBlocks = this.shuffle([...blocks]);

                randomizedBlocks.forEach((block, bIdx) => {
                    const blockId = bIdx + 1;
                    block.forEach(entry => {
                        data.push({
                            id: data.length + 1,
                            location: locName,
                            plot: plotCounter++,
                            rep: r,
                            iblock: blockId,
                            entry: entry.entry,
                            treatment: entry.label
                        });
                    });
                });
            }
        }

        this.lastData = data;
        this.lastInfo = { t: tInput, k: k, r: rInput, l: lCount, total: data.length };
        this.render();
    }

    render() {
        const results = document.getElementById('results');
        results.style.display = 'block';

        // Update Info
        document.getElementById('info-k').innerText = this.lastInfo.k;
        document.getElementById('info-blocks').innerText = this.lastInfo.k;
        document.getElementById('info-total').innerText = this.lastInfo.total;

        // Table
        const tbody = document.querySelector('#field-book-table tbody');
        tbody.innerHTML = '';
        this.lastData.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.id}</td>
                <td>${row.location}</td>
                <td>${row.plot}</td>
                <td>${row.rep}</td>
                <td>${row.iblock}</td>
                <td>${row.entry}</td>
                <td><span style="color: var(--primary); font-weight: 600;">${row.treatment}</span></td>
            `;
            tbody.appendChild(tr);
        });

        this.renderMap();
    }

    renderMap() {
        const container = document.getElementById('map-container');
        container.innerHTML = '';

        const locations = [...new Set(this.lastData.map(d => d.location))];

        locations.forEach(loc => {
            const siteDiv = document.createElement('div');
            siteDiv.className = 'site-block';
            siteDiv.innerHTML = `<h2 class="site-title">${loc}</h2>`;

            const locData = this.lastData.filter(d => d.location === loc);
            const reps = [...new Set(locData.map(d => d.rep))];

            reps.forEach(rep => {
                const repDiv = document.createElement('div');
                repDiv.className = 'rep-grid-container';
                repDiv.innerHTML = `<div class="rep-title">Replicate ${rep}</div>`;

                const repData = locData.filter(d => d.rep === rep);
                const iblocks = [...new Set(repData.map(d => d.iblock))];

                const latticeGrid = document.createElement('div');
                latticeGrid.className = 'lattice-grid';
                // Dynamic grid columns based on k
                latticeGrid.style.gridTemplateColumns = `repeat(auto-fit, minmax(140px, 1fr))`;

                iblocks.forEach(ib => {
                    const blockData = repData.filter(d => d.iblock === ib);
                    const ibUnit = document.createElement('div');
                    ibUnit.className = 'iblock-unit';
                    ibUnit.innerHTML = `<div class="iblock-label">I-Block ${ib}</div>`;

                    blockData.forEach(p => {
                        const trtUnit = document.createElement('div');
                        trtUnit.className = 'trt-unit';
                        trtUnit.innerHTML = `<span class="plot-num">Plot ${p.plot}</span><b>${p.treatment}</b>`;
                        ibUnit.appendChild(trtUnit);
                    });

                    latticeGrid.appendChild(ibUnit);
                });

                repDiv.appendChild(latticeGrid);
                siteDiv.appendChild(repDiv);
            });

            container.appendChild(siteDiv);
        });
    }

    exportCSV() {
        if (!this.lastData) return;
        let csv = "ID,LOCATION,PLOT,REPLICATE,IBLOCK,ENTRY,TREATMENT\n";
        this.lastData.forEach(r => {
            csv += `${r.id},${r.location},${r.plot},${r.rep},${r.iblock},${r.entry},"${r.treatment}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'square_lattice_design.csv';
        a.click();
    }

    copyToClipboard() {
        if (!this.lastData) return;
        let text = "ID\tLOCATION\tPLOT\tREPLICATE\tIBLOCK\tENTRY\tTREATMENT\n";
        this.lastData.forEach(r => {
            text += `${r.id}\t${r.location}\t${r.plot}\t${r.rep}\t${r.iblock}\t${r.entry}\t${r.treatment}\n`;
        });
        navigator.clipboard.writeText(text).then(() => alert("Field book copied to clipboard!"));
    }

    downloadMap() {
        const map = document.getElementById('map-container');
        html2canvas(map, { backgroundColor: '#1f2122' }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'square_lattice_map.png';
            link.href = canvas.toDataURL();
            link.click();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SquareLatticeDesign();
});
