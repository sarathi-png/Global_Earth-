const DrawerManager = {
    isOpen: false,

    init() {
        this.drawer = document.getElementById('rightDrawer');
        this.closeBtn = document.getElementById('closeDrawer');
        
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }
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

        if (imgEl) {
            if (typeof IncidentImageGenerator !== 'undefined') {
                const dataUrl = IncidentImageGenerator.generate(type, title, year);
                imgEl.onload = () => {
                    imgEl.style.display = 'block';
                    if (placeholderEl) placeholderEl.style.display = 'none';
                };
                imgEl.onerror = () => {
                    imgEl.style.display = 'none';
                    if (placeholderEl) placeholderEl.style.display = 'flex';
                };
                imgEl.src = dataUrl;
            } else {
                imgEl.style.display = 'none';
                if (placeholderEl) placeholderEl.style.display = 'flex';
            }
        }

        if (!this.drawer) return;
        this.drawer.classList.add('open');
        this.isOpen = true;
        
        if (typeof gsap !== 'undefined' && gsap.fromTo) {
            gsap.fromTo(this.drawer, 
                { x: 420 }, 
                { x: 0, duration: 0.6, ease: "expo.out" }
            );
        }

        if (window.innerWidth < 768) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.add('collapsed');
        }
    },

    close() {
        if (!this.drawer) return;
        if (typeof gsap !== 'undefined' && gsap.to) {
            gsap.to(this.drawer, {
                x: 420,
                duration: 0.4,
                ease: "power2.in",
                onComplete: () => {
                    this.drawer.classList.remove('open');
                    this.isOpen = false;
                }
            });
        } else {
            this.drawer.classList.remove('open');
            this.isOpen = false;
        }
    }
};
