/**
 * Full Factorial Design Logic
 * Handles N factors, Combinations, and RCBD/CRD Randomization
 */

class FactorialGenerator {
    constructor(factors, reps, locations, type = 'RCBD', seed = null) {
        this.factors = factors; // Array of {name, levels: [l1, l2]}
        this.reps = parseInt(reps);
        this.L = parseInt(locations);
        this.type = type; // RCBD (2) or CRD (1)
        this.seed = seed || Math.floor(Math.random() * 1000000);

        this.combinations = [];
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

    shuffle(array, randomFunc) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(randomFunc() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    generateCombinations() {
        const result = [[]];
        this.factors.forEach(factor => {
            const temp = [];
            result.forEach(combination => {
                factor.levels.forEach(level => {
                    temp.push([...combination, { factorName: factor.name, level: level }]);
                });
            });
            result.length = 0;
            result.push(...temp);
        });
        this.combinations = result;
        return result;
    }

    generate(startPlot = 101) {
        const random = this.mulberry32(this.seed);
        this.generateCombinations();
        this.fieldBook = [];

        for (let loc = 1; loc <= this.L; loc++) {
            let plotNum = startPlot + (loc - 1) * 1000;

            if (this.type === 'RCBD') {
                for (let rep = 1; rep <= this.reps; rep++) {
                    const repCombs = JSON.parse(JSON.stringify(this.combinations));
                    this.shuffle(repCombs, random);

                    repCombs.forEach(comb => {
                        this.fieldBook.push({
                            location: `Loc${loc}`,
                            plot: plotNum++,
                            rep: rep,
                            combination: comb,
                            combString: comb.map(c => c.level).join('*')
                        });
                    });
                }
            } else {
                const allUnits = [];
                for (let rep = 1; rep <= this.reps; rep++) {
                    this.combinations.forEach(comb => {
                        allUnits.push({ rep: rep, combination: comb });
                    });
                }
                this.shuffle(allUnits, random);

                allUnits.forEach(unit => {
                    this.fieldBook.push({
                        location: `Loc${loc}`,
                        plot: plotNum++,
                        rep: unit.rep,
                        combination: unit.combination,
                        combString: unit.combination.map(c => c.level).join('*')
                    });
                });
            }
        }
        return this.fieldBook;
    }
}

// UI Controller
document.addEventListener('DOMContentLoaded', () => {
    try {
        const factorsContainer = document.getElementById('factors-container');
        const addFactorBtn = document.getElementById('add-factor');
        const generateBtn = document.getElementById('generate-btn');
        const resultsSection = document.getElementById('results');
        const blocksContainer = document.getElementById('blocks-container');
        const locPills = document.getElementById('loc-pills');
        const fbTable = document.querySelector('#fb-table tbody');
        const fbHeader = document.getElementById('fb-header');

        if (!factorsContainer || !addFactorBtn) {
            console.error("Critical elements missing");
            return;
        }

        let currentGenerator = null;
        let selectedLoc = "Loc1";

        function addFactorUI(name = '', levels = '') {
            const div = document.createElement('div');
            div.className = 'factor-item';
            div.innerHTML = `
                <i class="fas fa-times remove-factor"></i>
                <div class="form-group">
                    <label>Factor Name</label>
                    <input type="text" class="factor-name" value="${name}" placeholder="e.g. Variety">
                </div>
                <div class="form-group" style="margin-bottom: 0;">
                    <label>Levels (comma separated)</label>
                    <input type="text" class="factor-levels" value="${levels}" placeholder="v1, v2, v3">
                </div>
            `;
            // Add close handler
            const closeBtn = div.querySelector('.remove-factor');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    if (factorsContainer.children.length > 1) {
                        div.remove();
                    } else {
                        alert("Minimum 1 factor required.");
                    }
                };
            }
            factorsContainer.appendChild(div);
        }

        // Initialize with default factors
        addFactorUI('Factor A', 'a1, a2');
        addFactorUI('Factor B', 'b1, b2, b3');

        // Event Listeners
        addFactorBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Safety
            addFactorUI();
        });

        generateBtn.addEventListener('click', () => {
            const factorElements = document.querySelectorAll('.factor-item');
            const factors = [];
            factorElements.forEach(el => {
                const nameInput = el.querySelector('.factor-name');
                const levelsInput = el.querySelector('.factor-levels');

                const name = nameInput ? (nameInput.value || 'Factor') : 'Factor';
                const levels = levelsInput ? levelsInput.value.split(',').map(s => s.trim()).filter(s => s !== '') : [];

                if (levels.length > 0) factors.push({ name, levels });
            });

            if (factors.length < 2) {
                alert('Please define at least 2 factors.');
                return;
            }

            const repsVal = document.getElementById('reps-input').value;
            const locsVal = document.getElementById('locs-input').value;
            const envType = document.getElementById('env-type');
            const type = (envType && envType.value === '2') ? 'RCBD' : 'CRD';
            const plotStartVal = document.getElementById('plot-start').value;
            const seedVal = document.getElementById('seed-input').value;

            const reps = parseInt(repsVal) || 3;
            const locs = parseInt(locsVal) || 1;
            const plotStart = parseInt(plotStartVal) || 101;
            const seed = seedVal ? parseInt(seedVal) : null;

            const generator = new FactorialGenerator(factors, reps, locs, type, seed);
            generator.generate(plotStart);
            currentGenerator = generator;

            // Stats
            document.getElementById('stat-comb').textContent = generator.combinations.length;
            document.getElementById('stat-total').textContent = generator.fieldBook.length;
            document.getElementById('stat-type').textContent = type;

            renderLocPills(locs);
            renderVisualMap("Loc1");
            renderTable(generator);

            resultsSection.style.display = 'block';
            resultsSection.scrollIntoView({ behavior: 'smooth' });
        });

        function renderLocPills(count) {
            locPills.innerHTML = '';
            for (let i = 1; i <= count; i++) {
                const pill = document.createElement('div');
                pill.className = `pill ${i === 1 ? 'active' : ''}`;
                pill.textContent = `Location ${i}`;
                pill.onclick = () => {
                    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
                    pill.classList.add('active');
                    renderVisualMap(`Loc${i}`);
                };
                locPills.appendChild(pill);
            }
        }

        function renderVisualMap(locName) {
            selectedLoc = locName;
            blocksContainer.innerHTML = '';
            const data = currentGenerator.fieldBook.filter(r => r.location === locName);

            if (currentGenerator.type === 'RCBD') {
                for (let r = 1; r <= currentGenerator.reps; r++) {
                    const blockDiv = document.createElement('div');
                    blockDiv.className = 'block-unit';
                    blockDiv.innerHTML = `<div class="block-title">Block (Rep) ${r}</div>`;
                    const grid = document.createElement('div');
                    grid.className = 'plots-grid';

                    data.filter(d => d.rep === r).forEach(plot => {
                        grid.innerHTML += `
                            <div class="plot-card">
                                <div class="p-num">Plot ${plot.plot}</div>
                                <div class="p-comb">${plot.combString}</div>
                            </div>
                        `;
                    });
                    blockDiv.appendChild(grid);
                    blocksContainer.appendChild(blockDiv);
                }
            } else {
                const blockDiv = document.createElement('div');
                blockDiv.className = 'block-unit';
                blockDiv.innerHTML = `<div class="block-title">Completely Randomized Design</div>`;
                const grid = document.createElement('div');
                grid.className = 'plots-grid';
                data.forEach(plot => {
                    grid.innerHTML += `
                        <div class="plot-card">
                            <div class="p-num">P${plot.plot} (R${plot.rep})</div>
                            <div class="p-comb">${plot.combString}</div>
                        </div>
                    `;
                });
                blockDiv.appendChild(grid);
                blocksContainer.appendChild(blockDiv);
            }
        }

        function renderTable(gen) {
            fbHeader.innerHTML = '<th>ID</th><th>Location</th><th>Plot</th><th>Rep</th>';
            gen.factors.forEach(f => {
                fbHeader.innerHTML += `<th>${f.name}</th>`;
            });
            fbHeader.innerHTML += '<th>Combination</th>';

            fbTable.innerHTML = '';
            gen.fieldBook.forEach((row, idx) => {
                const tr = document.createElement('tr');
                let html = `<td>${idx + 1}</td><td>${row.location}</td><td>${row.plot}</td><td>${row.rep}</td>`;
                row.combination.forEach(c => {
                    html += `<td>${c.level}</td>`;
                });
                html += `<td><strong>${row.combString}</strong></td>`;
                tr.innerHTML = html;
                fbTable.appendChild(tr);
            });
        }

        // Tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById(tab.dataset.tab).classList.add('active');
            };
        });

        // Toggle Export
        const exportCsvBtn = document.getElementById('export-csv');
        if (exportCsvBtn) {
            exportCsvBtn.onclick = () => {
                if (!currentGenerator) return;
                const headers = ["Location", "Plot", "Rep", ...currentGenerator.factors.map(f => f.name), "Combination"];
                const csv = [headers.join(',')];
                currentGenerator.fieldBook.forEach(row => {
                    const line = [row.location, row.plot, row.rep, ...row.combination.map(c => c.level), row.combString];
                    csv.push(line.join(','));
                });
                const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `factorial_design_${Date.now()}.csv`;
                a.click();
            };
        }

        const dlMapBtn = document.getElementById('download-png');
        if (dlMapBtn) {
            dlMapBtn.onclick = () => {
                const container = document.getElementById('map-capture');
                if (typeof html2canvas === 'function') {
                    html2canvas(container, { backgroundColor: "#1f2122", scale: 3 }).then(canvas => {
                        const a = document.createElement('a');
                        a.download = `factorial_${selectedLoc}_map.png`;
                        a.href = canvas.toDataURL();
                        a.click();
                    });
                } else {
                    alert('Image export library not loaded.');
                }
            };
        }

    } catch (error) {
        console.error("Factorial App Error:", error);
        alert("An error occurred initializing the application. Please refresh.");
    }
});
