const DrawerManager = {
    isOpen: false,
    _loadToken: 0,

    init() {
        this.drawer = document.getElementById('rightDrawer');
        this.closeBtn = document.getElementById('closeDrawer');
        this.modal = document.getElementById('mediaModal');
        this.modalCloseBtn = document.getElementById('closeModal');
        this.modalBody = document.getElementById('modalBody');
        this.drawerImage = document.getElementById('drawerImage');

        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }
        if (this.drawerImage) {
            this.drawerImage.addEventListener('click', () => this.openModal(this.drawerImage));
        }
        if (this.modalCloseBtn) {
            this.modalCloseBtn.addEventListener('click', () => this.closeModal());
        }
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.closeModal();
            });
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                if (this.isOpen) this.close();
            }
        });
    },

    getVal(prop) {
        if (prop === null || prop === undefined) return prop;
        if (typeof prop.getValue === 'function') return prop.getValue();
        return prop;
    },

    open(entity) {
        if (!entity || !entity.properties) return;
        const props = entity.properties;

        const title = this.getVal(props.title) || 'Unknown';
        const description = this.getVal(props.description) || 'No description available.';
        const type = (this.getVal(props.type) || 'info').toLowerCase();
        const year = this.getVal(props.year) || '-';
        const severity = this.getVal(props.severity) || 'Normal';
        const wikiQuery = this.getVal(props.wikiQuery) || title;

        const titleEl = document.getElementById('drawerTitle');
        const descEl = document.getElementById('drawerDescription');
        const typeEl = document.getElementById('drawerType');
        const yearEl = document.getElementById('metaYear');
        const sevEl = document.getElementById('metaSeverity');
        const imgEl = document.getElementById('drawerImage');
        const placeholderEl = document.getElementById('drawerImagePlaceholder');

        if (titleEl) titleEl.innerText = title;
        if (descEl) descEl.innerText = description;
        if (typeEl) typeEl.innerText = type;
        if (yearEl) yearEl.innerText = year;
        if (sevEl) sevEl.innerText = severity;
        if (typeEl) typeEl.className = `badge ${type}`;

        if (imgEl && placeholderEl) {
            const token = ++this._loadToken;
            this.loadImage(type, wikiQuery, year, imgEl, placeholderEl, token);
        }

        if (!this.drawer) return;
        this.drawer.style.transform = '';
        this.drawer.classList.add('open');
        this.isOpen = true;
    },

    async loadImage(type, title, year, imgEl, placeholderEl, token) {
        placeholderEl.style.display = 'flex';
        imgEl.style.display = 'none';

        let imageUrl = null;
        if (navigator.onLine && typeof WikipediaImage !== 'undefined') {
            imageUrl = await WikipediaImage.getThumbnail(wikiQuery);
        }

        if (token !== this._loadToken) return;

        let fallbackUrl = null;
        if (typeof IncidentImageGenerator !== 'undefined') {
            try {
                fallbackUrl = IncidentImageGenerator.generate(type, title, year);
            } catch (e) {
                console.warn("Image generator failed:", e);
            }
        }

        imgEl.onload = () => {
            if (token !== this._loadToken) return;
            imgEl.style.display = 'block';
            placeholderEl.style.display = 'none';
        };
        imgEl.onerror = () => {
            if (token !== this._loadToken) return;
            if (fallbackUrl && imgEl.src !== fallbackUrl) {
                imgEl.src = fallbackUrl;
            } else {
                imgEl.style.display = 'none';
                placeholderEl.style.display = 'flex';
            }
        };

        imgEl.src = imageUrl || fallbackUrl || '';
    },

    openModal(imgEl) {
        if (!this.modal || !this.modalBody || !imgEl) return;
        this.modalBody.innerHTML = '';
        const clone = document.createElement('img');
        clone.src = imgEl.src;
        clone.alt = imgEl.alt || 'Incident Image';
        clone.style.cssText = 'max-width:100%; max-height:80vh; border-radius:8px; display:block; margin:0 auto;';
        this.modalBody.appendChild(clone);
        this.modal.classList.remove('hidden');
    },

    closeModal() {
        if (!this.modal) return;
        this.modal.classList.add('hidden');
        if (this.modalBody) this.modalBody.innerHTML = '';
    },

    close() {
        if (!this.drawer) return;
        this.drawer.classList.remove('open');
        this.drawer.style.transform = '';
        this.isOpen = false;
    }
};

window.DrawerManager = DrawerManager;