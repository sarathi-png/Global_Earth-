// ViewPresets — named saved views in localStorage (OSIRIS ViewPresets parity).
// Each preset stores center/zoom/projection + layer toggle states.
const ViewPresets = {
    KEY: 'geoIntelViews.v1',

    init() {
        this.listEl = document.getElementById('presetList');
        const saveBtn = document.getElementById('presetSaveBtn');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveCurrent());
        this.render();
    },

    load() {
        try {
            const raw = localStorage.getItem(this.KEY);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (_) { return []; }
    },

    store(arr) {
        try { localStorage.setItem(this.KEY, JSON.stringify(arr)); } catch (_) {}
    },

    snapshot() {
        const c = (typeof GlobeManager !== 'undefined') ? GlobeManager.getCenter() : { lat: 20, lng: 0, zoom: 2 };
        const proj = (typeof GlobeManager !== 'undefined' && GlobeManager.getProjection) ? GlobeManager.getProjection() : 'globe';
        const layers = {};
        document.querySelectorAll('.layer-item input[type="checkbox"]').forEach((el) => {
            if (el.id) layers[el.id] = !!el.checked;
        });
        return { lat: c.lat, lng: c.lng, zoom: c.zoom, proj, layers };
    },

    saveCurrent() {
        let name = null;
        try { name = window.prompt('Name this view:', 'View ' + (this.load().length + 1)); } catch (_) {}
        if (!name) return;
        const arr = this.load();
        arr.push(Object.assign({ name: String(name).slice(0, 60) }, this.snapshot()));
        this.store(arr);
        this.render();
    },

    apply(preset) {
        try {
            Object.entries(preset.layers || {}).forEach(([id, on]) => {
                const el = document.getElementById(id);
                if (el && el.checked !== !!on) {
                    el.checked = !!on;
                    el.dispatchEvent(new Event('change'));
                }
            });
            if (typeof syncAllLayerVisibility === 'function') syncAllLayerVisibility();
            if (typeof GlobeManager !== 'undefined' && GlobeManager.setProjection && preset.proj) {
                GlobeManager.setProjection(preset.proj);
            }
            if (typeof CameraManager !== 'undefined') {
                CameraManager.flyToZoom(preset.lat, preset.lng, preset.zoom);
            }
            if (typeof refreshViewStrip === 'function') refreshViewStrip();
        } catch (e) { console.warn('preset apply failed:', e.message); }
    },

    remove(idx) {
        const arr = this.load();
        arr.splice(idx, 1);
        this.store(arr);
        this.render();
    },

    esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },

    render() {
        if (!this.listEl) return;
        const arr = this.load();
        this.listEl.innerHTML = '';
        if (!arr.length) {
            const d = document.createElement('div');
            d.className = 'preset-empty';
            d.textContent = 'No saved views yet.';
            this.listEl.appendChild(d);
            return;
        }
        arr.forEach((p, idx) => {
            const row = document.createElement('div');
            row.className = 'preset-item';
            const go = document.createElement('button');
            go.className = 'preset-goto';
            go.title = 'Go to ' + p.name;
            go.textContent = p.name;
            go.addEventListener('click', () => this.apply(p));
            const del = document.createElement('button');
            del.className = 'preset-del';
            del.title = 'Delete';
            del.textContent = '×';
            del.addEventListener('click', () => this.remove(idx));
            row.appendChild(go);
            row.appendChild(del);
            this.listEl.appendChild(row);
        });
    }
};
window.ViewPresets = ViewPresets;
