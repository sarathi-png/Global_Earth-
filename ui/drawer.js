const DrawerManager = {
    isOpen: false,

    init() {
        this.drawer = document.getElementById('rightDrawer');
        this.closeBtn = document.getElementById('closeDrawer');
        
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', () => this.close());
        }
    },

    open(entity) {
        if (!entity.properties) return;
        const props = entity.properties;

        // Content Update
        document.getElementById('drawerTitle').innerText = props.title.getValue();
        document.getElementById('drawerDescription').innerText = props.description.getValue();
        document.getElementById('drawerType').innerText = props.type.getValue();
        document.getElementById('metaYear').innerText = props.year.getValue();
        document.getElementById('metaSeverity').innerText = props.severity.getValue();
        
        // CSS Badge update
        const typeBadge = document.getElementById('drawerType');
        typeBadge.className = `badge ${props.type.getValue()}`;

        // Animation
        this.drawer.classList.add('open');
        this.isOpen = true;
        
        gsap.fromTo(this.drawer, 
            { x: 420 }, 
            { x: 0, duration: 0.6, ease: "expo.out" }
        );

        // Sidebar auto-collapse on mobile if needed
        if (window.innerWidth < 768) {
            document.getElementById('sidebar').classList.add('collapsed');
        }
    },

    close() {
        gsap.to(this.drawer, {
            x: 420,
            duration: 0.4,
            ease: "power2.in",
            onComplete: () => {
                this.drawer.classList.remove('open');
                this.isOpen = false;
            }
        });
    }
};
