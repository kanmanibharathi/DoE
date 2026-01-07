/**
 * Sparse & P-Rep Allocation Logic
 * Distributes lines across locations and randomizes each location.
 */

class AllocationDesign {
    constructor(lines, locations, copies, checks, checkReps, type = 'sparse', seed = null) {
        this.lines = parseInt(lines);
        this.L = parseInt(locations);
        this.C = parseInt(copies);
        this.checks = parseInt(checks);
        this.checkReps = parseInt(checkReps);
        this.type = type;
        this.seed = seed || Math.floor(Math.random() * 1000000);

        this.allocationMatrix = []; // [lineIndex][locIndex] = count
        this.locationEntries = []; // Each element is array of {id, name, type}
        this.fieldBooks = {}; // {locName: data}
    }

    mulberry32(a) {
        return function () {
            var t = a += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }

    allocate() {
        const random = this.mulberry32(this.seed);

        // 1. Initialize Matrix
        this.allocationMatrix = Array.from({ length: this.lines }, () => Array(this.L).fill(0));

        // 2. Distribute copies of each line across locations
        // This is a simple balanced allocation: for each line, choose C locations.
        // To maintain balance across locations, we use a cyclic shift or similar.
        let offset = 0;
        for (let i = 0; i < this.lines; i++) {
            for (let j = 0; j < this.C; j++) {
                const locIdx = (offset + j) % this.L;
                this.allocationMatrix[i][locIdx] = 1;
            }
            offset = (offset + this.C) % this.L;
        }

        // Randomize the allocation (permute lines)
        let lineIndices = Array.from({ length: this.lines }, (_, i) => i);
        for (let i = lineIndices.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [lineIndices[i], lineIndices[j]] = [lineIndices[j], lineIndices[i]];
        }

        const finalMatrix = Array.from({ length: this.lines }, () => Array(this.L).fill(0));
        lineIndices.forEach((oldIdx, newIdx) => {
            finalMatrix[newIdx] = [...this.allocationMatrix[oldIdx]];
        });
        this.allocationMatrix = finalMatrix;

        // 3. Prepare entries per location
        this.locationEntries = Array.from({ length: this.L }, () => []);

        for (let loc = 0; loc < this.L; loc++) {
            // Add Checks (repeated checkReps times)
            for (let c = 1; c <= this.checks; c++) {
                for (let r = 0; r < this.checkReps; r++) {
                    this.locationEntries[loc].push({
                        id: c,
                        name: `CH-${c}`,
                        type: 'Check'
                    });
                }
            }

            // Add assigned lines
            for (let i = 0; i < this.lines; i++) {
                if (this.allocationMatrix[i][loc] === 1) {
                    this.locationEntries[loc].push({
                        id: this.checks + i + 1,
                        name: `G-${i + 1}`,
                        type: 'Line'
                    });
                }
            }
        }
    }

    // Secondary randomization for a specific location
    generateLocationLayout(locIdx, planter = 'serpentine') {
        const entries = this.locationEntries[locIdx];
        const random = this.mulberry32(this.seed + locIdx + 100);

        const N = entries.length;
        // Determine Rows x Cols: approx square
        let rows = Math.floor(Math.sqrt(N * 1.2)); // Add some space for fillers
        let cols = Math.ceil(N / rows);
        while (rows * cols < N) cols++;

        // Reuse Diagonal randomization logic (Simplified SUDC)
        let matrix = Array.from({ length: rows }, () => Array(cols).fill(null));

        // Split entries into Checks and Lines
        const checkEntries = entries.filter(e => e.type === 'Check');
        const lineEntries = entries.filter(e => e.type === 'Line');

        // Randomized placement
        let positions = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) positions.push({ r, c });

        // Suffle positions
        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }

        // Place lines and checks randomly (Simple randomization for multi-loc)
        // In reality, do_optim often uses more complex spatial, but random is standard for start.
        entries.forEach((ent, idx) => {
            const pos = positions[idx];
            matrix[pos.r][pos.c] = ent;
        });

        // Fillers
        const fillers = [];
        for (let i = entries.length; i < positions.length; i++) {
            const pos = positions[i];
            matrix[pos.r][pos.c] = { id: 0, name: 'Filler', type: 'Filler' };
            fillers.push(pos);
        }

        return { matrix, rows, cols, entries };
    }
}

// UI Controller
document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const resultsSection = document.getElementById('results');
    const allocTableBody = document.querySelector('#allocation-table tbody');
    const allocHeader = document.getElementById('alloc-header');
    const locTabsContainer = document.getElementById('loc-tabs-container');
    const locMatrixGrid = document.getElementById('loc-matrix');

    let currentDesign = null;
    let selectedLocIdx = 0;

    generateBtn.addEventListener('click', () => {
        const lines = document.getElementById('lines-input').value;
        const locations = document.getElementById('locations-input').value;
        const copies = document.getElementById('copies-input').value;
        const checks = document.getElementById('checks-count').value;
        const checkReps = document.getElementById('checks-reps').value;
        const type = document.getElementById('design-type').value;

        try {
            const design = new AllocationDesign(lines, locations, copies, checks, checkReps, type);
            design.allocate();
            currentDesign = design;

            // Stats
            document.getElementById('stat-avg').textContent = (lines * copies / locations).toFixed(1);
            document.getElementById('stat-total').textContent = design.locationEntries[0].length * locations;
            document.getElementById('stat-plots').textContent = design.locationEntries[0].length;

            renderAllocation(design);
            renderTabs(design.L);
            showLocation(0);

            resultsSection.style.display = 'block';
            resultsSection.scrollIntoView({ behavior: 'smooth' });

        } catch (e) { alert(e.message); }
    });

    function renderAllocation(design) {
        // Clear the table first
        allocTableBody.innerHTML = '';

        // Set headers for locations
        allocHeader.innerHTML = '<th>Line</th>';
        for (let i = 1; i <= design.L; i++) {
            const th = document.createElement('th');
            th.textContent = `L${i}`;
            allocHeader.appendChild(th);
        }

        // Render rows
        design.allocationMatrix.slice(0, 20).forEach((row, lineIdx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>G-${lineIdx + 1}</td>` + row.map(v =>
                `<td style="color: ${v ? 'var(--accent)' : 'var(--text-dim)'}; font-weight: ${v ? 800 : 400};">
                    ${v ? '<i class="fas fa-check-circle"></i>' : '-'}
                </td>`
            ).join('');
            allocTableBody.appendChild(tr);
        });

        if (design.lines > 20) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="${design.L + 1}" style="text-align: center; color: var(--text-dim); font-size: 0.7rem;">... Showing first 20 lines ...</td>`;
            allocTableBody.appendChild(tr);
        }
    }

    function renderTabs(count) {
        locTabsContainer.innerHTML = '';
        for (let i = 0; i < count; i++) {
            const tab = document.createElement('div');
            tab.className = `loc-tab ${i === 0 ? 'active' : ''}`;
            tab.textContent = `Location ${i + 1}`;
            tab.onclick = () => showLocation(i);
            locTabsContainer.appendChild(tab);
        }
    }

    function showLocation(idx) {
        selectedLocIdx = idx;
        document.querySelectorAll('.loc-tab').forEach((t, i) => t.classList.toggle('active', i === idx));
        document.getElementById('active-loc-title').textContent = `Field Layout: Location ${idx + 1}`;

        const { matrix, rows, cols } = currentDesign.generateLocationLayout(idx);

        locMatrixGrid.innerHTML = '';
        locMatrixGrid.style.gridTemplateColumns = `repeat(${cols}, 40px)`;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const item = matrix[r][c];
                const cell = document.createElement('div');
                cell.className = `cell ${item ? item.type.toLowerCase() : 'filler'}`;
                cell.innerHTML = item ? item.id : '-';
                cell.title = item ? `${item.type}: ${item.name}` : 'Empty';
                locMatrixGrid.appendChild(cell);
            }
        }
    }

    // Download Single Location PNG
    document.getElementById('download-loc-btn').addEventListener('click', () => {
        const container = document.getElementById('map-wrapper');
        html2canvas(container, {
            backgroundColor: null,
            scale: 3
        }).then(canvas => {
            const a = document.createElement('a');
            a.download = `location_${selectedLocIdx + 1}_map.png`;
            a.href = canvas.toDataURL();
            a.click();
        });
    });

    // Consolidated Export
    document.getElementById('export-full-csv').addEventListener('click', () => {
        if (!currentDesign) return;
        let csv = "Location,Plot,EntryID,Name,Type\n";

        for (let loc = 0; loc < currentDesign.L; loc++) {
            const { matrix, entries } = currentDesign.generateLocationLayout(loc);
            let plot = 101;
            // Iterate matrix by row/col to get plot sequence
            matrix.forEach((row, r) => {
                row.forEach((item, c) => {
                    csv += `Location_${loc + 1},${plot++},${item.id},${item.name},${item.type}\n`;
                });
            });
        }

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `consolidated_field_book.csv`;
        a.click();
    });
});
