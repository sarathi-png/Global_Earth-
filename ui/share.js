// SharePanel — copy-able links for the current view (OSIRIS SharePanel parity).
// View link (full URL incl. ?lat=&lng=&zoom=&layers=&proj=) + OSIRIS deep-link
// centered on the current map center.
const SharePanel = {
    init() {
        this.buildModal();
        const btn = document.getElementById('shareBtn');
        if (btn) btn.addEventListener('click', () => this.open());
    },

    buildModal() {
        if (document.getElementById('shareModal')) return;
        const modal = document.createElement('div');
        modal.id = 'shareModal';
        modal.className = 'hidden';
        modal.innerHTML =
            '<div class="share-card glass-panel">' +
            '<h3><i class="fas fa-share-alt"></i> SHARE VIEW</h3>' +
            '<p>Copy a link to this exact view (position, zoom, layers), or open the map center in OSIRIS Live.</p>' +
            '<div class="share-row"><input id="shareViewUrl" readonly value=""><button class="share-btn" id="shareViewCopy">Copy</button></div>' +
            '<div class="share-row"><input id="shareOsirisUrl" readonly value=""><button class="share-btn" id="shareOsirisCopy">Copy</button></div>' +
            '<div class="share-row"><button class="share-btn" id="shareOsirisOpen" style="flex:1;">Open center in OSIRIS Live ↗</button></div>' +
            '</div>';
        modal.addEventListener('click', (e) => { if (e.target === modal) this.close(); });
        document.body.appendChild(modal);
        this.modal = modal;
        const copy = (inputId) => {
            const inp = document.getElementById(inputId);
            if (!inp) return;
            const done = () => this.toast('Link copied');
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(inp.value).then(done).catch(() => { inp.select(); document.execCommand('copy'); done(); });
                } else { inp.select(); document.execCommand('copy'); done(); }
            } catch (_) {}
        };
        document.getElementById('shareViewCopy').addEventListener('click', () => copy('shareViewUrl'));
        document.getElementById('shareOsirisCopy').addEventListener('click', () => copy('shareOsirisUrl'));
        document.getElementById('shareOsirisOpen').addEventListener('click', () => {
            const url = document.getElementById('shareOsirisUrl').value;
            if (url) window.open(url, '_blank', 'noopener');
        });
    },

    toast(msg) {
        try {
            if (typeof NotificationSystem !== 'undefined' && NotificationSystem.showToast) {
                NotificationSystem.showToast({ title: msg, category: 'Disaster', severity: 'Moderate', source: 'Global Earth' }, 'moderate');
            }
        } catch (_) {}
    },

    open() {
        if (!this.modal) return;
        try {
            if (typeof URLStateManager !== 'undefined') URLStateManager.update();
            document.getElementById('shareViewUrl').value = window.location.href;
            let osiris = (typeof OsirisLink !== 'undefined') ? OsirisLink.BASE : 'https://osirisai.live/';
            try {
                const c = GlobeManager.getCenter();
                osiris = OsirisLink.build(c.lat, c.lng, 'Shared view', Math.round(c.zoom));
            } catch (_) {}
            document.getElementById('shareOsirisUrl').value = osiris;
        } catch (_) {}
        this.modal.classList.remove('hidden');
    },

    close() {
        if (this.modal) this.modal.classList.add('hidden');
    }
};
window.SharePanel = SharePanel;
