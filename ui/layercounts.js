// LayerCounts — live per-layer + per-group counts in the sidebar
// (OSIRIS LayerPanel parity: each row shows its marker count).
// Badges are injected (no HTML churn); updateLayerCounts() is called from
// updateGlobalStats() in js/app.js so every toggle/refresh re-renders.
(function () {
    function layerForClass(cls) {
        try {
            if (typeof TOGGLE_ID_TO_LEGEND_CLASS === 'undefined' || typeof layerByToggle !== 'function') return null;
            const toggleId = Object.keys(TOGGLE_ID_TO_LEGEND_CLASS).find((k) => TOGGLE_ID_TO_LEGEND_CLASS[k] === cls);
            if (!toggleId) return null;
            return { toggleId, layer: layerByToggle(toggleId) };
        } catch (_) { return null; }
    }

    function initBadges() {
        document.querySelectorAll('.layer-item[data-layer]').forEach((item) => {
            if (item.querySelector('.layer-count')) return;
            const badge = document.createElement('span');
            badge.className = 'layer-count';
            badge.setAttribute('data-count', item.getAttribute('data-layer'));
            badge.textContent = '';
            item.appendChild(badge);
        });
        document.querySelectorAll('details.layer-group').forEach((group) => {
            const summary = group.querySelector('summary');
            if (summary && !summary.querySelector('.group-count')) {
                const badge = document.createElement('span');
                badge.className = 'group-count';
                summary.appendChild(badge);
            }
        });
    }

    function countVisible(layer) {
        if (!layer || !layer.entities) return 0;
        let n = 0;
        try {
            if (!layer.visible) return 0;
            layer.entities.forEach((e) => { if (e && e.show !== false) n++; });
        } catch (_) {}
        return n;
    }

    function updateLayerCounts() {
        try {
            const groupTotals = new Map();
            document.querySelectorAll('.layer-count[data-count]').forEach((badge) => {
                const cls = badge.getAttribute('data-count');
                const ref = layerForClass(cls);
                const n = ref && ref.layer ? countVisible(ref.layer) : 0;
                badge.textContent = n > 0 ? String(n) : '';
                badge.classList.toggle('has-count', n > 0);
                const group = badge.closest('details.layer-group');
                if (group) groupTotals.set(group, (groupTotals.get(group) || 0) + n);
            });
            groupTotals.forEach((total, group) => {
                const badge = group.querySelector('summary .group-count');
                if (badge) {
                    badge.textContent = total > 0 ? String(total) : '';
                    badge.classList.toggle('has-count', total > 0);
                }
            });
        } catch (_) {}
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBadges);
    else initBadges();
    window.updateLayerCounts = updateLayerCounts;
})();
