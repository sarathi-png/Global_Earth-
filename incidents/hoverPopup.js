const HoverPopup = {
    element: null,

    init() {
        this.element = document.getElementById('popup');
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
        
        const titleEl = document.getElementById('popupTitle');
        const metaEl = document.getElementById('popupMeta');
        if (titleEl) titleEl.innerText = title;
        const typeSafe = (typeof type === 'string' && type.length < 40) ? type : 'info';
        const yearSafe = (typeof year === 'string' || typeof year === 'number') ? String(year).slice(0, 20) : '-';
        if (metaEl) {
            metaEl.innerHTML = `<span class="badge ${typeSafe}">${typeSafe}</span><span>${yearSafe}</span>`;
        }
        
        this.element.style.display = 'block';
        this.element.classList.remove('hidden');

        // Position: always set left/top (works without GSAP); GSAP only fades.
        var x = Math.min(position.x + 20, window.innerWidth - 320);
        var y = Math.max(position.y - 40, 12);
        this.element.style.left = Math.max(x, 12) + 'px';
        this.element.style.top = y + 'px';
        this.element.style.transform = '';
        if (typeof gsap !== 'undefined' && gsap.to) {
            gsap.fromTo(this.element, { opacity: 0 }, {
                opacity: 1,
                duration: 0.2,
                ease: "power2.out"
            });
        } else {
            this.element.style.opacity = '1';
        }
    },

    hide() {
        if (!this.element) return;
        if (typeof gsap !== 'undefined' && gsap.to) {
            gsap.to(this.element, {
                opacity: 0,
                duration: 0.2,
                onComplete: () => {
                    this.element.classList.add('hidden');
                }
            });
        } else {
            this.element.style.opacity = '0';
            this.element.classList.add('hidden');
        }
    }
};
