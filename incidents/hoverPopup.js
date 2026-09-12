const HoverPopup = {
    element: null,
    _imgEl: null,

    init() {
        this.element = document.getElementById('popup');
        this._imgEl = document.getElementById('popupImage');
        console.log("Hover Popup System Initialized");
    },

    getVal(prop) {
        if (prop === null || prop === undefined) return prop;
        if (typeof prop.getValue === 'function') return prop.getValue();
        return prop;
    },

    show(entity, position) {
        if (!this.element || !entity || !entity.properties) return;

        const title = this.getVal(entity.properties.title) || 'Unknown';
        const year = this.getVal(entity.properties.year) || '-';
        const type = (this.getVal(entity.properties.type) || 'info').toLowerCase();
        const wikiQuery = this.getVal(entity.properties.wikiQuery) || title;

        const titleEl = document.getElementById('popupTitle');
        const metaEl = document.getElementById('popupMeta');
        if (titleEl) titleEl.innerText = title;
        const typeSafe = (typeof type === 'string' && type.length < 40) ? type : 'info';
        const yearSafe = (typeof year === 'string' || typeof year === 'number') ? String(year).slice(0, 20) : '-';
        if (metaEl) {
            metaEl.innerHTML = `<span class="badge ${typeSafe}">${typeSafe}</span><span>${yearSafe}</span>`;
        }

        this._loadPopupImage(wikiQuery);

        this.element.style.display = 'block';
        this.element.classList.remove('hidden');

        var x = Math.min(position.x + 20, window.innerWidth - 320);
        var y = Math.max(position.y - 40, 12);
        this.element.style.left = Math.max(x, 12) + 'px';
        this.element.style.top = y + 'px';
        this.element.style.transform = '';
        if (typeof gsap !== 'undefined' && gsap.to) {
            gsap.fromTo(this.element, { opacity: 0 }, {
                opacity: 1, duration: 0.2, ease: "power2.out"
            });
        } else {
            this.element.style.opacity = '1';
        }
    },

    _loadPopupImage(query) {
        if (!this._imgEl) return;
        this._imgEl.style.display = 'none';
        this._imgEl.src = '';
        if (!navigator.onLine || !query) return;
        if (typeof WikipediaImage === 'undefined' || !WikipediaImage.getThumbnail) return;
        WikipediaImage.getThumbnail(query).then(url => {
            if (!url) return;
            this._imgEl.onload = () => { this._imgEl.style.display = 'block'; };
            this._imgEl.onerror = () => { this._imgEl.style.display = 'none'; };
            this._imgEl.src = url;
        }).catch(() => {});
    },

    hide() {
        if (!this.element) return;
        if (typeof gsap !== 'undefined' && gsap.to) {
            gsap.to(this.element, {
                opacity: 0, duration: 0.2,
                onComplete: () => { this.element.classList.add('hidden'); }
            });
        } else {
            this.element.style.opacity = '0';
            this.element.classList.add('hidden');
        }
    }
};
