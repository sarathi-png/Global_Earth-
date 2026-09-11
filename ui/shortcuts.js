// Keyboard shortcuts + help modal (OSIRIS KeyboardShortcuts parity).
// G projection · R home · F fullscreen · S share URL · L sidebar · I feed · ? help · ESC close.
const Shortcuts = {
    SHORTCUTS: [
        { key: 'G', desc: 'Toggle 3D globe / 2D map' },
        { key: 'R', desc: 'Reset to global view' },
        { key: 'F', desc: 'Toggle fullscreen' },
        { key: 'S', desc: 'Copy share link for this view' },
        { key: 'L', desc: 'Toggle layers panel' },
        { key: 'I', desc: 'Toggle live event feed' },
        { key: '?', desc: 'Show this help' },
        { key: 'ESC', desc: 'Close panels / popups' }
    ],

    init() {
        this.buildModal();
        document.addEventListener('keydown', (e) => this.handle(e));
    },

    buildModal() {
        if (document.getElementById('shortcutsModal')) return;
        const rows = this.SHORTCUTS.map((s) =>
            '<div class="shortcut-row"><span>' + s.desc + '</span><kbd>' + s.key + '</kbd></div>').join('');
        const modal = document.createElement('div');
        modal.id = 'shortcutsModal';
        modal.className = 'hidden';
        modal.innerHTML =
            '<div class="shortcuts-card glass-panel">' +
            '<h3><i class="fas fa-keyboard"></i> SHORTCUTS</h3>' + rows +
            '<div style="margin-top:12px;text-align:center;font-size:9px;color:#8a93a3;letter-spacing:0.2em;">PRESS [?] OR [ESC] TO CLOSE</div>' +
            '</div>';
        modal.addEventListener('click', (e) => { if (e.target === modal) this.hide(); });
        document.body.appendChild(modal);
        this.modal = modal;
    },

    isOpen() { return this.modal && !this.modal.classList.contains('hidden'); },
    show() { if (this.modal) this.modal.classList.remove('hidden'); },
    hide() { if (this.modal) this.modal.classList.add('hidden'); },

    toast(msg) {
        try {
            if (typeof NotificationSystem !== 'undefined' && NotificationSystem.showToast) {
                NotificationSystem.showToast({ title: msg, category: 'Disaster', severity: 'Moderate', source: 'Global Earth' }, 'moderate');
            }
        } catch (_) {}
    },

    handle(e) {
        try {
            const tag = e.target && e.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA') return;
            if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
                e.preventDefault();
                this.isOpen() ? this.hide() : this.show();
                return;
            }
            if (e.key === 'Escape') { this.hide(); return; }
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const k = (e.key || '').toLowerCase();
            if (k === 'g') {
                if (typeof GlobeManager !== 'undefined') {
                    const next = GlobeManager.getProjection() === 'globe' ? 'mercator' : 'globe';
                    GlobeManager.setProjection(next);
                    if (typeof refreshViewStrip === 'function') refreshViewStrip();
                }
            } else if (k === 'r') {
                if (typeof CameraManager !== 'undefined') CameraManager.home();
            } else if (k === 'f') {
                if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
                else document.documentElement.requestFullscreen().catch(() => {});
            } else if (k === 's') {
                try {
                    if (typeof URLStateManager !== 'undefined') URLStateManager.update();
                    const url = window.location.href;
                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(url).then(() => this.toast('Share link copied'));
                    } else {
                        window.prompt('Copy share link:', url);
                    }
                } catch (_) {}
            } else if (k === 'l') {
                const btn = document.getElementById('toggleSidebar') || document.getElementById('sidebarFab');
                if (btn) btn.click();
            } else if (k === 'i') {
                const feed = document.getElementById('feedToggle');
                if (feed) feed.click();
                else if (typeof NotificationSystem !== 'undefined' && NotificationSystem.toggleFeed) NotificationSystem.toggleFeed();
            }
        } catch (_) {}
    }
};
window.Shortcuts = Shortcuts;
