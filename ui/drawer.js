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
        const lat = this.getVal(props.lat);
        const lng = this.getVal(props.lng);
        const source = this.getVal(props.source) || '';

        const titleEl = document.getElementById('drawerTitle');
        const descEl = document.getElementById('drawerDescription');
        const typeEl = document.getElementById('drawerType');
        const yearEl = document.getElementById('metaYear');
        const sevEl = document.getElementById('metaSeverity');
        const imgEl = document.getElementById('drawerImage');
        const placeholderEl = document.getElementById('drawerImagePlaceholder');

        if (titleEl) titleEl.innerText = title;
        const sourceSafe = (typeof source === 'string' && source.length < 200) ? source.replace(/[<>"']/g,'') : '';
        if (descEl) descEl.innerHTML = (this.linkify(description) || '').replace(/[<>"']/g,'') + (sourceSafe ? `<br><span style="color:#888;font-size:11px;">Source: ${sourceSafe}</span>` : '');
        if (typeEl) typeEl.innerText = type;
        if (yearEl) yearEl.innerText = year;
        if (sevEl) sevEl.innerText = severity;
        if (typeEl) typeEl.className = `badge ${type}`;

        if (imgEl && placeholderEl) {
            const token = ++this._loadToken;
            this.loadImage(type, wikiQuery, year, imgEl, placeholderEl, token);
        }

        // Street View & OSIRIS link area
        this.renderExtra(lat, lng, title, type, entity);

        if (!this.drawer) return;
        this.drawer.style.transform = '';
        this.drawer.classList.add('open');
        document.body.classList.add('drawer-open');
        this.isOpen = true;
    },

    linkify(text) {
        if (!text) return '';
        return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color:#4ade80;word-break:break-all;">$1</a>');
    },

    renderExtra(lat, lng, title, type, entity) {
        let extra = document.getElementById('drawerExtra');
        if (!extra) {
            extra = document.createElement('div');
            extra.id = 'drawerExtra';
            extra.style.cssText = 'margin-top:14px;display:flex;flex-direction:column;gap:10px;';
            const body = document.querySelector('#rightDrawer .drawer-body');
            if (body) body.appendChild(extra);
        }
        extra.innerHTML = '';
        if (lat != null && lng != null && typeof lat === 'number' && typeof lng === 'number') {
            // Street View card (Ion token overlay + Google fallback)
            const svBtn = document.createElement('button');
            svBtn.innerHTML = '<i class="fas fa-street-view"></i> Street View';
            svBtn.style.cssText = 'width:100%;padding:10px;border-radius:8px;border:1px solid rgba(74,222,128,0.3);background:rgba(74,222,128,0.12);color:#4ade80;cursor:pointer;font-size:13px;';
            svBtn.onclick = () => this.openStreetView(lat, lng, title);
            extra.appendChild(svBtn);
            // OSIRIS link if available
            if (typeof OsirisLayer !== 'undefined') {
                const osirisLink = document.createElement('a');
                osirisLink.href = `https://github.com/simplifaisoul/osiris`;
                osirisLink.target = '_blank';
                osirisLink.innerHTML = '<i class="fas fa-external-link-alt"></i> OSIRIS Intel — sensordata';
                osirisLink.style.cssText = 'display:block;text-align:center;padding:8px;border-radius:8px;background:rgba(167,139,250,0.12);border:1px solid rgba(167,139,250,0.3);color:#a78bfa;font-size:12px;text-decoration:none;';
                extra.appendChild(osirisLink);
            }
            // Coords footer
            const coordEl = document.createElement('div');
            coordEl.style.cssText = 'font-size:11px;color:#666;text-align:center;';
            coordEl.textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            extra.appendChild(coordEl);
        }
        // Feed link if present (CCTV etc)
        const feedUrl = entity.properties && this.getVal(entity.properties.feed_url);
        if (feedUrl) {
            const feedBtn = document.createElement('a');
            feedBtn.href = feedUrl; feedBtn.target = '_blank';
            feedBtn.textContent = 'View Live Feed';
            feedBtn.style.cssText = 'display:block;text-align:center;padding:10px;border-radius:8px;background:#a78bfa;color:#fff;text-decoration:none;font-weight:600;';
            extra.appendChild(feedBtn);
        }
    },

    openStreetView(lat, lng, title) {
        if (typeof StreetViewLayer !== 'undefined' && StreetViewLayer.openPanorama) {
            const html = StreetViewLayer.openPanorama(lat, lng, title);
            if (this.modalBody) {
                this.modalBody.innerHTML = html;
                this.modal.classList.remove('hidden');
                return;
            }
        }
        window.open(`https://www.google.com/maps/@${lat},${lng},3a,75y,0h,90t`, '_blank');
    },

    async loadImage(type, title, year, imgEl, placeholderEl, token) {
        placeholderEl.style.display = 'flex';
        imgEl.style.display = 'none';

        let imageUrl = null;
        if (navigator.onLine && typeof WikipediaImage !== 'undefined') {
            imageUrl = await WikipediaImage.getThumbnail(title);
        }
        // Chain 2: Wikimedia Commons search (free, no auth)
        if (!imageUrl && navigator.onLine && typeof WikimediaCommons !== 'undefined') {
            const kw = (typeof WikipediaImage !== 'undefined' && WikipediaImage.extractKeywords)
                ? WikipediaImage.extractKeywords(title) : title;
            imageUrl = await WikimediaCommons.searchImage(kw);
        }
        // Chain 3: Unsplash via server proxy
        if (!imageUrl && navigator.onLine && typeof UnsplashImage !== 'undefined') {
            const kw = (typeof WikipediaImage !== 'undefined' && WikipediaImage.extractKeywords)
                ? WikipediaImage.extractKeywords(title) : title;
            imageUrl = await UnsplashImage.searchImage(kw);
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
        document.body.classList.remove('drawer-open');
        this.drawer.style.transform = '';
        this.isOpen = false;
    }
};

window.DrawerManager = DrawerManager;