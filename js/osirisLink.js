// OSIRIS Live outbound mapping (no vendored code, no backend).
// Opens https://osirisai.live/ in a new tab with a deep-link:
// lat/lng/zoom/label are passed as query params and the OSIRIS app flies to
// the location on load (see D:\Projects\osiris src/app/page.tsx).
const OsirisLink = {
    BASE: 'https://osirisai.live/',
    // Deep-link carries ONLY lat/lng (+zoom). No event name/label — the
    // target app ignores unknown params and they only bloat the URL.
    build(lat, lng, label, zoom) {
        let url = this.BASE;
        try {
            const q = [];
            const la = Number(lat), ln = Number(lng);
            if (isFinite(la) && isFinite(ln) && la >= -90 && la <= 90 && ln >= -180 && ln <= 180) {
                q.push('lat=' + encodeURIComponent(la.toFixed(4)));
                q.push('lng=' + encodeURIComponent(ln.toFixed(4)));
            }
            const z = Number(zoom);
            if (isFinite(z) && z > 0) q.push('zoom=' + encodeURIComponent(Math.min(18, z)));
            else if (q.length) q.push('zoom=8');
            if (q.length) url += '?' + q.join('&');
        } catch (_) {}
        return url;
    },
    open(lat, lng, label, zoom) {
        try {
            window.open(this.build(lat, lng, label, zoom), '_blank', 'noopener');
        } catch (_) {
            window.open(this.BASE, '_blank', 'noopener');
        }
    },
    init() {
        const sidebarBtn = document.getElementById('openOsirisBtn');
        if (sidebarBtn) sidebarBtn.addEventListener('click', () => this.open());
        const legendBtn = document.getElementById('legendOsirisBtn');
        if (legendBtn) legendBtn.addEventListener('click', () => this.open());
    }
};
window.OsirisLink = OsirisLink;
