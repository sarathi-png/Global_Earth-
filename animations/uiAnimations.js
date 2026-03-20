const UIAnimations = {
    init() {
        this.setupSidebarAnimations();
        this.setupPanelReveals();
        console.log("UI Animation System Online");
    },

    setupSidebarAnimations() {
        const toggleBtn = document.getElementById('toggleSidebar');
        const sidebar = document.getElementById('sidebar');

        toggleBtn.addEventListener('click', () => {
            const isCollapsing = !sidebar.classList.contains('collapsed');
            
            if (isCollapsing) {
                gsap.to(sidebar, { width: 60, duration: 0.5, ease: "power3.inOut" });
                gsap.to('.sidebar-header span, .layer-item span, .status-indicators', { opacity: 0, duration: 0.2 });
            } else {
                gsap.to(sidebar, { width: 280, duration: 0.5, ease: "power3.inOut" });
                gsap.to('.sidebar-header span, .layer-item span, .status-indicators', { opacity: 1, duration: 0.4, delay: 0.2 });
            }
        });
    },

    setupPanelReveals() {
        // Staggered reveal for initial load
        gsap.from('.glass-panel', {
            y: 20,
            opacity: 0,
            duration: 1,
            stagger: 0.2,
            ease: "power4.out",
            delay: 0.5
        });
    }
};
