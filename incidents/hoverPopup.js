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
        if (metaEl) {
            metaEl.innerHTML = `
                <span class="badge ${type}">${type}</span>
                <span>${year}</span>
            `;
        }
        
        this.element.style.display = 'block';
        this.element.classList.remove('hidden');
        
        if (typeof gsap !== 'undefined' && gsap.to) {
            gsap.to(this.element, {
                x: position.x + 20,
                y: position.y - 40,
                opacity: 1,
                duration: 0.2,
                ease: "power2.out"
            });
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
