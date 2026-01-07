/**
 * Split Plot Design Logic
 * premium implementation for Research Hub
 */

class SplitPlotDesign {
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

    parseFactor(val, defaultPrefix) {
        if (!val) return [];
        if (!isNaN(val) && val.toString().indexOf(',') === -1) {
            const count = parseInt(val);
            return Array.from({ length: count }, (_, i) => `${defaultPrefix}-${i + 1}`);
        }
        return val.split(',').map(s => s.trim()).filter(s => s.length > 0);
    }

    generate() {
        // Inputs
        const type = parseInt(document.getElementById('type-input').value);
        const wpInput = document.getElementById('wp-input').value;
        const spInput = document.getElementById('sp-input').value;
        const reps = parseInt(document.getElementById('reps-input').value);
        const lCount = parseInt(document.getElementById('loc-input').value);
        const startPlot = parseInt(document.getElementById('plot-input').value);
        let seed = parseInt(document.getElementById('seed-input').value);

        if (isNaN(seed)) seed = Math.floor(Math.random() * 999999);
        this.mulberry = this.mulberry32(seed);

        const wholePlots = this.parseFactor(wpInput, "WP");
        const subPlots = this.parseFactor(spInput, "SP");

        if (wholePlots.length < 2 || subPlots.length < 1 || reps < 1 || lCount < 1) {
            alert("Please ensure at least 2 whole plots, 1 sub plot, and positive reps/locations.");
            return;
        }

        const data = [];
        const wpCount = wholePlots.length;
        const spCount = subPlots.length;

        for (let l = 1; l <= lCount; l++) {
            const locName = lCount === 1 ? "Main Site" : `Location ${l}`;
            let plotCounter = startPlot + (l - 1) * 1000;

            if (type === 2) { // RCBD
                for (let r = 1; r <= reps; r++) {
                    const randomizedWPs = this.shuffle([...wholePlots]);
                    randomizedWPs.forEach(wp => {
                        const randomizedSPs = this.shuffle([...subPlots]);
                        const currentPlot = plotCounter++;
                        randomizedSPs.forEach(sp => {
                            data.push({
                                id: data.length + 1,
                                location: locName,
                                plot: currentPlot,
                                rep: r,
                                wp: wp,
                                sp: sp,
                                combo: `${wp} | ${sp}`
                            });
                        });
                    });
                }
            } else { // CRD
                const totalWPUnits = wpCount * reps;
                const wpPool = [];
                for (let r = 1; r <= reps; r++) {
                    wholePlots.forEach(wp => wpPool.push({ wp, rep: r }));
                }
                this.shuffle(wpPool);

                wpPool.forEach((unit, idx) => {
                    const randomizedSPs = this.shuffle([...subPlots]);
                    const currentPlot = plotCounter++;
                    randomizedSPs.forEach(sp => {
                        data.push({
                            id: data.length + 1,
                            location: locName,
                            plot: currentPlot,
                            rep: unit.rep,
                            wp: unit.wp,
                            sp: sp,
                            combo: `${unit.wp} | ${sp}`
                        });
                    });
                });
            }
        }

        this.lastData = data;
        this.lastInfo = { type, wpCount, spCount, reps, lCount, totalUnits: data.length, totalPlots: data.length / spCount };
        this.render();
    }

    render() {
        const results = document.getElementById('results');
        results.style.display = 'block';

        // Summary Info
        document.getElementById('info-type').innerText = this.lastInfo.type === 2 ? "RCBD" : "CRD";
        document.getElementById('info-factors').innerText = `${this.lastInfo.wpCount} WP × ${this.lastInfo.spCount} SP`;
        document.getElementById('info-total').innerText = this.lastInfo.totalUnits;
        document.getElementById('info-plots').innerText = this.lastInfo.totalPlots;

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
                <td>${row.wp}</td>
                <td>${row.sp}</td>
                <td><span style="color: var(--primary); font-weight: 600;">${row.combo}</span></td>
            `;
            tbody.appendChild(tr);
        });

        // Map
        this.renderMap();
    }

    renderMap() {
        const container = document.getElementById('map-container');
        container.innerHTML = '';

        const locations = [...new Set(this.lastData.map(d => d.location))];

        locations.forEach(loc => {
            const locDiv = document.createElement('div');
            locDiv.className = 'location-block';
            locDiv.innerHTML = `<h2 class="location-title">${loc}</h2>`;

            const locData = this.lastData.filter(d => d.location === loc);
            const reps = [...new Set(locData.map(d => d.rep))];

            reps.forEach(rep => {
                const repDiv = document.createElement('div');
                repDiv.className = 'rep-container';
                repDiv.innerHTML = `<div class="rep-title">Replicate / Block ${rep}</div>`;

                const repData = locData.filter(d => d.rep === rep);
                const plotsInRep = [...new Set(repData.map(d => d.plot))];

                const wpGrid = document.createElement('div');
                wpGrid.className = 'wp-grid';

                plotsInRep.forEach(plot => {
                    const plotData = repData.filter(d => d.plot === plot);
                    const wpUnit = document.createElement('div');
                    wpUnit.className = 'wp-unit';

                    const wpName = plotData[0].wp;
                    wpUnit.innerHTML = `
                        <div class="wp-label">PLOT ${plot}<br>${wpName}</div>
                        <div class="sp-list">
                            ${plotData.map(sp => `<div class="sp-plot">${sp.sp}</div>`).join('')}
                        </div>
                    `;
                    wpGrid.appendChild(wpUnit);
                });

                repDiv.appendChild(wpGrid);
                locDiv.appendChild(repDiv);
            });

            container.appendChild(locDiv);
        });
    }

    exportCSV() {
        if (!this.lastData) return;
        let csv = "ID,LOCATION,PLOT,REP,WHOLE_PLOT,SUB_PLOT,TREATMENT\n";
        this.lastData.forEach(r => {
            csv += `${r.id},${r.location},${r.plot},${r.rep},"${r.wp}","${r.sp}","${r.combo}"\n`;
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'split_plot_design.csv';
        a.click();
    }

    copyToClipboard() {
        if (!this.lastData) return;
        let text = "ID\tLOCATION\tPLOT\tREP\tWHOLE_PLOT\tSUB_PLOT\tTREATMENT\n";
        this.lastData.forEach(r => {
            text += `${r.id}\t${r.location}\t${r.plot}\t${r.rep}\t${r.wp}\t${r.sp}\t${r.combo}\n`;
        });
        navigator.clipboard.writeText(text).then(() => alert("Field book copied to clipboard!"));
    }

    downloadMap() {
        const map = document.getElementById('map-container');
        html2canvas(map, { backgroundColor: '#1f2122' }).then(canvas => {
            const link = document.createElement('a');
            link.download = 'split_plot_field_map.png';
            link.href = canvas.toDataURL();
            link.click();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SplitPlotDesign();
});
