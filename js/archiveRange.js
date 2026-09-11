// Archive window helper: live/history data runs from a fixed start through the
// last day of the previous month (recomputed at load). Static-only, no deps.
// Example: if today is 2026-09-11, end = 2026-08-31.
const ArchiveRange = {
    START_ISO: '2025-01-01',
    get() {
        const now = new Date();
        const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
        const endISO = end.toISOString().slice(0, 10);
        return { start: this.START_ISO, end: endISO, endLabel: end.toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }) };
    },
    gdacsRange() {
        const { start, end } = this.get();
        const f = iso => iso.replace(/-/g, '').slice(0, 8);
        // GDACS API expects YYYY-MM-DD; keep ISO here, caller formats.
        return { fromdate: start, todate: end, _compact: { from: f(start), to: f(end) } };
    },
    init() {
        try {
            const { endLabel } = this.get();
            const badge = document.getElementById('archiveRangeBadge');
            if (badge) badge.textContent = 'Through ' + endLabel;
        } catch (_) {}
    }
};
window.ArchiveRange = ArchiveRange;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => ArchiveRange.init());
else ArchiveRange.init();
