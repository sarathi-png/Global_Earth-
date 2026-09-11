// Legend interactions: hover tooltip with layer info + single-click fly-to.
// Layers resolve via the sidebar toggle registry in js/app.js (TOGGLE_IDS /
// TOGGLE_ID_TO_LEGEND_CLASS). No backend, no new dependencies.
(function () {
    const LAYER_INFO = {
        disasters: { label: 'Disasters', desc: 'Curated disaster markers. Hover a marker for details; click to open the report.' },
        wars: { label: 'Conflicts & Wars', desc: 'Curated conflict markers.' },
        mysteries: { label: 'Mysteries', desc: 'Curated mystery locations.' },
        history: { label: 'Major Events', desc: 'Curated historical events (always visible; timeline removed).' },
        borders: { label: 'Balance of Power', desc: 'Country borders overlay.' },
        aircraft: { label: 'Aerospace', desc: 'Live aircraft positions (airplanes.live).' },
        sat: { label: 'Satellites', desc: 'Satellite positions (CelesTrak).' },
        weather: { label: 'Weather Overlay', desc: 'Weather overlay for the current view.' },
        live: { label: 'Live Events', desc: 'Live EONET/USGS/GDACS/NOAA/FIRMS/FEMA/ReliefWeb feed.' },
        gibs: { label: 'GIBS Satellite', desc: 'NASA GIBS satellite imagery overlay.' },
        heatmap: { label: 'Event Heatmap', desc: 'Density heatmap of loaded events.' },
        ripple: { label: 'Ripple Rings & Arcs', desc: 'Animated rings/arcs around severe events.' },
        daynight: { label: 'Day/Night Terminator', desc: 'Day/night terminator line and night shading.' },
        streetview: { label: 'Street View', desc: 'Street-level preview for the selected incident (drawer).' }
    };

    let tip = null;
    function ensureTip() {
        if (tip) return tip;
        tip = document.createElement('div');
        tip.className = 'legend-tip';
        tip.style.display = 'none';
        document.body.appendChild(tip);
        return tip;
    }
    function layerByLegendClass(cls) {
        try {
            if (typeof TOGGLE_ID_TO_LEGEND_CLASS === 'undefined') return null;
            const toggleId = Object.keys(TOGGLE_ID_TO_LEGEND_CLASS).find(k => TOGGLE_ID_TO_LEGEND_CLASS[k] === cls);
            if (!toggleId || typeof layerByToggle !== 'function') return null;
            return { toggleId, layer: layerByToggle(toggleId) };
        } catch (_) { return null; }
    }
    function visibleCount(layer) {
        if (!layer || !layer.entities) return 0;
        let n = 0;
        try { layer.entities.forEach(e => { if (e && e.show) n++; }); } catch (_) {}
        return n;
    }
    function firstVisibleLatLng(layer) {
        if (!layer || !layer.entities) return null;
        try {
            for (const e of layer.entities) {
                if (!e || e.show === false || !e.properties) continue;
                const getVal = p => (p && typeof p.getValue === 'function') ? p.getValue() : p;
                const lat = getVal(e.properties.lat), lng = getVal(e.properties.lng);
                if (typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng)) return { lat, lng };
            }
        } catch (_) {}
        return null;
    }

    function bind() {
        document.querySelectorAll('.legend-item[data-layer]').forEach(item => {
            const cls = item.getAttribute('data-layer');
            const info = LAYER_INFO[cls] || { label: cls, desc: '' };
            item.setAttribute('tabindex', '0');
            item.setAttribute('role', 'button');
            item.setAttribute('aria-label', info.label + ' — activate to fly to this layer');
            item.addEventListener('mouseenter', ev => {
                const t = ensureTip();
                const ref = layerByLegendClass(cls);
                const count = ref && ref.layer ? visibleCount(ref.layer) : 0;
                const toggleState = ref && document.getElementById(ref.toggleId)
                    ? (document.getElementById(ref.toggleId).checked ? 'on' : 'off') : '';
                t.innerHTML = '<strong>' + info.label + '</strong>'
                    + (toggleState ? ' <span style="opacity:0.6">(' + toggleState + ')</span>' : '')
                    + '<br><span style="opacity:0.8">' + count + ' visible markers</span>'
                    + (info.desc ? '<br><span style="opacity:0.7">' + info.desc + '</span>' : '')
                    + '<br><span style="opacity:0.55;font-size:11px">Click to enable + fly here</span>';
                t.style.display = 'block';
                const x = Math.min(ev.clientX + 14, window.innerWidth - 260);
                const y = Math.min(ev.clientY + 12, window.innerHeight - 120);
                t.style.left = Math.max(x, 8) + 'px';
                t.style.top = Math.max(y, 8) + 'px';
            });
            item.addEventListener('mousemove', ev => {
                if (!tip) return;
                const x = Math.min(ev.clientX + 14, window.innerWidth - 260);
                const y = Math.min(ev.clientY + 12, window.innerHeight - 120);
                tip.style.left = Math.max(x, 8) + 'px';
                tip.style.top = Math.max(y, 8) + 'px';
            });
            item.addEventListener('mouseleave', () => { if (tip) tip.style.display = 'none'; });
            const activate = () => {
                if (tip) tip.style.display = 'none';
                const ref = layerByLegendClass(cls);
                if (!ref || !ref.layer) return;
                // Ensure the sidebar toggle is on so the layer actually renders.
                const toggleEl = document.getElementById(ref.toggleId);
                if (toggleEl && !toggleEl.checked) {
                    toggleEl.checked = true;
                    toggleEl.dispatchEvent(new Event('change'));
                }
                const target = firstVisibleLatLng(ref.layer);
                if (target && typeof CameraManager !== 'undefined') {
                    CameraManager.flyTo(target.lat, target.lng, 2500000);
                } else if (typeof NotificationSystem !== 'undefined' && NotificationSystem.showToast) {
                    NotificationSystem.showToast({ title: info.label + ' enabled — markers loading…', category: 'Disaster', severity: 'Moderate', source: 'Global Earth' }, 'moderate');
                }
            };
            item.addEventListener('click', activate);
            item.addEventListener('keydown', ev => {
                if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); activate(); }
            });
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
    else bind();
    window.LegendInteractions = { bind };
})();
