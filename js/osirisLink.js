// OSIRIS Live outbound mapping (no vendored code, no backend).
// Opens https://osirisai.live/ in a new tab. Best-effort deep-link:
// lat/lng/label are passed as query params; the reference app may ignore
// unknown params and simply land on its live view — never break the host.
const OsirisLink = {
    BASE: 'https://osirisai.live/',
    open(lat, lng, label) {
        try {
            let url = this.BASE;
            const q = [];
            if (typeof lat === 'number' && typeof lng === 'number' && isFinite(lat) && isFinite(lng)) {
                q.push('lat=' + encodeURIComponent(lat.toFixed(4)));
                q.push('lng=' + encodeURIComponent(lng.toFixed(4)));
            }
            if (label) q.push('label=' + encodeURIComponent(String(label).slice(0, 80)));
            if (q.length) url += '?' + q.join('&');
            window.open(url, '_blank', 'noopener');
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
