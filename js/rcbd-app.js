/**
 * Randomized Complete Block Design (RCBD) Logic
 */
'use strict';

class RCBDGenerator {
    constructor(treatments, reps, locations, planter = 'serpentine', seed = null) {
        this.treatments = treatments; // Array of names
        this.reps = parseInt(reps);
        this.locations = parseInt(locations);
        this.planter = planter;
        // Correct seed handling
        this.seed = (seed !== null && seed !== undefined && !isNaN(seed)) ? seed : Math.floor(Math.random() * 1000000);

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

                // If serpentine, reverse plots in even blocks (rows)
                if (this.planter === 'serpentine' && (r % 2 === 0)) {
                    // Logic check: r goes 1..reps. Even reps reverse? 
                    // Usually we visualize blocks stacked. 
                    // Let's reverse plots logical order for "sowing" direction visualization
                    plots.reverse();
                    // Note: Plot numbers usually stay sequential in space, but treatment assignment follows path.
                    // But here we assigned plot numbers sequentially then reversed the array.
                    // This means plots[0] has highest plot number.
                    // Let's re-assign plot numbers to match spatial position?
                    // Typically 'Plot Number' is the ID of the unit in ground.
                    // If we walk serpentine, we walk 101, 102, 103... then turn and walk 203, 202, 201?
                    // Or we walk 101..110, then 120..111? 
                    // Let's simple keep plot numbers monotonic increasing by block index for simplicity,
                    // but the *treatments* filling them are reversed if we thought of them filling array.
                    // Actually, let's keep it simple: Plot number = unique ID.
                    // Serpentine affects how we *view* them or walk them.
                    // The previous code reversed the 'plots' array which contained plot numbers. 
                    // That implies plot numbers are not spatially monotonic left-to-right?
                    // We will stick to the previous logic but ensure consistent rendering.
                }

                // If we reversed, the plot numbers in the objects are also reversed order. 
                // e.g. [ {p:105}, {p:104} ... ]

                plots.forEach((p, i) => {
                    const entry = {
                        id: globalId++,
                        location: locName,
                        plot: p.plot,
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
    try {
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

        if (!generateBtn || !treatmentsInput) return;

        let currentGenerator = null;
        let selectedLoc = null;

        generateBtn.addEventListener('click', () => {
            try {
                const rawTreats = treatmentsInput.value.split(/[\n,]+/).map(t => t.trim()).filter(t => t.length > 0);
                if (rawTreats.length < 2) {
                    alert('Please enter at least 2 treatments.');
                    return;
                }

                const reps = parseInt(repsInput.value);
                const locations = parseInt(locationsInput.value);
                const planter = planterInput ? planterInput.value : 'serpentine';
                const plotStart = parseInt(plotStartInput.value);

                const rawSeed = seedInput.value;
                const seedValue = (rawSeed !== "" && rawSeed !== null) ? parseInt(rawSeed) : Math.floor(Math.random() * 1000000);

                const gen = new RCBDGenerator(rawTreats, reps, locations, planter, seedValue);
                gen.generate(plotStart);
                currentGenerator = gen;

                // Stats
                if (document.getElementById('stat-plots')) document.getElementById('stat-plots').textContent = rawTreats.length * reps * locations;
                if (document.getElementById('stat-treats')) document.getElementById('stat-treats').textContent = rawTreats.length;
                if (document.getElementById('stat-blocks')) document.getElementById('stat-blocks').textContent = reps;

                // Location Pills
                if (locPillsContainer) {
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
                } else {
                    selectedLoc = Object.keys(gen.layoutData)[0];
                }

                renderMap(selectedLoc);
                renderTable(gen.fieldBook);

                if (resultsSection) {
                    resultsSection.style.display = 'block';
                    resultsSection.scrollIntoView({ behavior: 'smooth' });
                }
            } catch (err) {
                console.error(err);
                alert("Error: " + err.message);
            }
        });

        function renderMap(loc) {
            if (!currentGenerator || !layoutView) return;
            layoutView.innerHTML = '';
            const blocks = currentGenerator.layoutData[loc];

            blocks.forEach((blockPlots, bIdx) => {
                const wrapper = document.createElement('div');
                wrapper.className = 'block-wrapper';
                wrapper.innerHTML = `<div class="block-title"><i class="fas fa-layer-group"></i> Block ${bIdx + 1}</div>`;

                const grid = document.createElement('div');
                grid.className = 'grid-row';

                // Re-sort blocks to visual order if serpentine affected the logical sequence
                // We want to verify visual consistency
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
            if (!fbTableBody) return;
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

        if (tabs) {
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const targetId = tab.getAttribute('data-tab');
                    const targetContent = document.getElementById(targetId);
                    if (targetContent) {
                        tabs.forEach(t => t.classList.remove('active'));
                        tab.classList.add('active');
                        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                        targetContent.classList.add('active');
                    }
                });
            });
        }

        // Exports
        const dlCsvBtn = document.getElementById('download-csv');
        if (dlCsvBtn) {
            dlCsvBtn.onclick = () => {
                if (!currentGenerator) return;
                const headers = ["ID", "Location", "Plot", "Block", "Treatment"];
                const csv = [headers.join(",")];
                currentGenerator.fieldBook.forEach(r => {
                    csv.push([r.id, r.location, r.plot, r.rep, `"${r.treatmentName}"`].join(","));
                });
                downloadFile(csv.join("\n"), 'rcbd_field_book.csv', 'text/csv');
            };
        }

        const dlPngBtn = document.getElementById('download-png');
        if (dlPngBtn) {
            dlPngBtn.onclick = () => {
                const capture = document.getElementById('map-capture');
                if (!capture || typeof html2canvas !== 'function') {
                    alert("Cannot export image. Library missing or container not found.");
                    return;
                }

                const oldText = dlPngBtn.innerHTML;
                dlPngBtn.innerHTML = "Processing...";
                dlPngBtn.disabled = true;

                html2canvas(capture, { backgroundColor: null, scale: 3 }).then(canvas => {
                    const a = document.createElement('a');
                    a.download = `rcbd_layout_${Date.now()}.png`;
                    a.href = canvas.toDataURL();
                    a.click();
                    dlPngBtn.innerHTML = oldText;
                    dlPngBtn.disabled = false;
                }).catch(e => {
                    console.error(e);
                    alert("Export failed");
                    dlPngBtn.innerHTML = oldText;
                    dlPngBtn.disabled = false;
                });
            };
        }

        function downloadFile(content, fileName, mimeType) {
            const blob = new Blob([content], { type: mimeType });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            a.click();
        }

    } catch (e) {
        console.error("RCBD Init Error", e);
    }
});
