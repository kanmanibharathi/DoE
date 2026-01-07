/**
 * Randomized Complete Block Design (RCBD) Logic
 */

class RCBDGenerator {
    constructor(treatments, reps, locations, planter = 'serpentine', seed = null) {
        this.treatments = treatments; // Array of names
        this.reps = parseInt(reps);
        this.locations = parseInt(locations);
        this.planter = planter;
        this.seed = seed || Math.floor(Math.random() * 1000000);

        this.fieldBook = [];
        this.layoutData = {}; // loc -> [rep][plot]
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
        this.layoutData = {};

        let globalId = 1;

        for (let l = 1; l <= this.locations; l++) {
            const locName = `LOC-${l}`;
            this.layoutData[locName] = [];

            let currentPlot = startPlot + ((l - 1) * 1000); // Standard FielDHub logic

            for (let r = 1; r <= this.reps; r++) {
                // Every block (rep) must contain all treatments
                let blockTreats = this.treatments.map((name, idx) => ({
                    id: idx + 1,
                    name: name
                }));

                // Randomize treatments within the block
                this.shuffle(blockTreats, random);

                // Determine plot order (serpentine vs cartesian)
                // For RCBD, we often think of a block as a row or a group.
                // We'll treat each block as a "row" in the visual output.
                let plotsInBlock = [];

                let plots = blockTreats.map((t, i) => {
                    return { ...t, plot: currentPlot + i };
                });

                if (this.planter === 'serpentine' && (r % 2 === 0)) {
                    plots.reverse();
                }

                plots.forEach((p, i) => {
                    const entry = {
                        id: globalId++,
                        location: locName,
                        plot: currentPlot + i, // In RCBD, plots within a block are sequential
                        rep: r,
                        treatmentId: p.id,
                        treatmentName: p.name
                    };
                    this.fieldBook.push(entry);
                    plotsInBlock.push(entry);
                });

                this.layoutData[locName].push(plotsInBlock);
                currentPlot += blockTreats.length;
            }
        }
        return this.fieldBook;
    }
}

// UI Controller
document.addEventListener('DOMContentLoaded', () => {
    const treatmentsInput = document.getElementById('treatments-input');
    const repsInput = document.getElementById('reps-input');
    const locationsInput = document.getElementById('locations-input');
    const planterInput = document.getElementById('planter-input');
    const plotStartInput = document.getElementById('plot-start');
    const seedInput = document.getElementById('seed-input');
    const generateBtn = document.getElementById('generate-btn');

    const resultsSection = document.getElementById('results');
    const layoutView = document.getElementById('layout-view');
    const fbTableBody = document.querySelector('#fb-table tbody');
    const locPillsContainer = document.getElementById('location-pills');
    const tabs = document.querySelectorAll('.tab');

    let currentGenerator = null;
    let selectedLoc = null;

    generateBtn.addEventListener('click', () => {
        const rawTreats = treatmentsInput.value.split(/[\n,]+/).map(t => t.trim()).filter(t => t.length > 0);
        if (rawTreats.length < 2) {
            alert('Please enter at least 2 treatments.');
            return;
        }

        const reps = parseInt(repsInput.value);
        const locations = parseInt(locationsInput.value);
        const planter = planterInput.value;
        const plotStart = parseInt(plotStartInput.value);
        const seedValue = seedInput.value ? parseInt(seedInput.value) : Math.floor(Math.random() * 1000000);

        const gen = new RCBDGenerator(rawTreats, reps, locations, planter, seedValue);
        gen.generate(plotStart);
        currentGenerator = gen;

        // Stats
        document.getElementById('stat-plots').textContent = rawTreats.length * reps * locations;
        document.getElementById('stat-treats').textContent = rawTreats.length;
        document.getElementById('stat-blocks').textContent = reps;

        // Location Pills
        locPillsContainer.innerHTML = '';
        Object.keys(gen.layoutData).forEach((loc, idx) => {
            const pill = document.createElement('div');
            pill.className = `loc-pill ${idx === 0 ? 'active' : ''}`;
            pill.textContent = loc;
            pill.onclick = () => {
                document.querySelectorAll('.loc-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                renderMap(loc);
            };
            locPillsContainer.appendChild(pill);
            if (idx === 0) selectedLoc = loc;
        });

        renderMap(selectedLoc);
        renderTable(gen.fieldBook);

        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    });

    function renderMap(loc) {
        if (!currentGenerator) return;
        layoutView.innerHTML = '';
        const blocks = currentGenerator.layoutData[loc];

        blocks.forEach((blockPlots, bIdx) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'block-wrapper';
            wrapper.innerHTML = `<div class="block-title"><i class="fas fa-layer-group"></i> Block ${bIdx + 1}</div>`;

            const grid = document.createElement('div');
            grid.className = 'grid-row';

            // Re-sort blocks to visual order if serpentine affected the logical sequence
            const sortedPlots = [...blockPlots].sort((a, b) => a.plot - b.plot);

            sortedPlots.forEach(p => {
                const unit = document.createElement('div');
                unit.className = 'plot-unit';
                unit.innerHTML = `
                    <div class="p-num">${p.plot}</div>
                    <div class="t-id">${p.treatmentId}</div>
                    <div class="t-name">${p.treatmentName}</div>
                `;
                grid.appendChild(unit);
            });
            wrapper.appendChild(grid);
            layoutView.appendChild(wrapper);
        });
    }

    function renderTable(data) {
        fbTableBody.innerHTML = '';
        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.id}</td>
                <td><span class="loc-pill" style="pointer-events:none;">${row.location}</span></td>
                <td><strong>${row.plot}</strong></td>
                <td>${row.rep}</td>
                <td style="font-weight:600;">${row.treatmentName}</td>
            `;
            fbTableBody.appendChild(tr);
        });
    }

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
    document.getElementById('download-csv').onclick = () => {
        if (!currentGenerator) return;
        const headers = ["ID", "Location", "Plot", "Block", "Treatment"];
        const csv = [headers.join(",")];
        currentGenerator.fieldBook.forEach(r => {
            csv.push([r.id, r.location, r.plot, r.rep, `"${r.treatmentName}"`].join(","));
        });
        downloadFile(csv.join("\n"), 'rcbd_field_book.csv', 'text/csv');
    };

//     document.getElementById('copy-clipboard').onclick = () => {
//         if (!currentGenerator) return;
//         let text = "ID\tLocation\tPlot\tBlock\tTreatment\n";
//         currentGenerator.fieldBook.forEach(r => {
//             text += `${r.id}\t${r.location}\t${r.plot}\t${r.rep}\t${r.treatmentName}\n`;
//         });
        navigator.clipboard.writeText(text).then(() => alert('Copied to clipboard!'));
    };

    document.getElementById('download-png').onclick = () => {
        const capture = document.getElementById('map-capture');
        html2canvas(capture, { backgroundColor: null, scale: 3 }).then(canvas => {
            const a = document.createElement('a');
            a.download = `rcbd_layout_${Date.now()}.png`;
            a.href = canvas.toDataURL();
            a.click();
        });
    };

    function downloadFile(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
    }
});
