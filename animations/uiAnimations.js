const UIAnimations = {
    init() {
        try {
            this.setupSidebarAnimations();
        } catch (e) {
            console.warn("Sidebar animations setup failed:", e);
        }
        try {
            this.setupPanelReveals();
        } catch (e) {
            console.warn("Panel reveal animations setup failed:", e);
        }
        console.log("UI Animation System Online");
    },

    setupSidebarAnimations() {
        const toggleBtn = document.getElementById('toggleSidebar');
        const sidebar = document.getElementById('sidebar');

        if (!toggleBtn || !sidebar) return;

        toggleBtn.addEventListener('click', () => {
            const isCollapsing = !sidebar.classList.contains('collapsed');

            if (isCollapsing) {
                sidebar.classList.add('collapsed');
            } else {
                sidebar.classList.remove('collapsed');
            }

            if (typeof gsap !== 'undefined' && gsap.to) {
                if (isCollapsing) {
                    gsap.to(sidebar, { width: 60, duration: 0.5, ease: "power3.inOut" });
                    const targets = document.querySelectorAll('#sidebar .sidebar-header span, #sidebar .layer-item span, #sidebar .status-indicators');
                    if (targets.length) gsap.to(targets, { opacity: 0, duration: 0.2 });
                } else {
                    gsap.to(sidebar, { width: 280, duration: 0.5, ease: "power3.inOut" });
                    const targets = document.querySelectorAll('#sidebar .sidebar-header span, #sidebar .layer-item span, #sidebar .status-indicators');
                    if (targets.length) gsap.to(targets, { opacity: 1, duration: 0.4, delay: 0.2 });
                }
            }
        });
    },

    setupPanelReveals() {
        if (typeof gsap !== 'undefined' && gsap.from) {
            const panels = document.querySelectorAll('#searchBar, #sidebar, #rightDrawer, #timeline, #legend');
            if (panels.length) {
                gsap.from(panels, {
                    y: 20,
                    opacity: 0,
                    duration: 1,
                    stagger: 0.15,
                    ease: "power4.out",
                    delay: 0.3
                });
            }
        }
    }
};
