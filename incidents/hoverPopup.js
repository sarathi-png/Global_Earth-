const HoverPopup = {
    element: null,

    init() {
        this.element = document.getElementById('popup');
        console.log("Hover Popup System Initialized");
    },

    show(entity, position) {
        if (!this.element || !entity.properties) return;

        const title = entity.properties.title ? entity.properties.title.getValue() : 'Unknown';
        const year = entity.properties.year ? entity.properties.year.getValue() : '-';
        const type = entity.properties.type ? entity.properties.type.getValue() : 'info';
        
        document.getElementById('popupTitle').innerText = title;
        document.getElementById('popupMeta').innerHTML = `
            <span class="badge ${type}">${type}</span>
            <span>${year}</span>
        `;
        
        this.element.style.display = 'block';
        this.element.classList.remove('hidden');
        
        // Use GSAP for smooth following and fade
        gsap.to(this.element, {
            x: position.x + 20,
            y: position.y - 40,
            opacity: 1,
            duration: 0.2,
            ease: "power2.out"
        });
    },

    hide() {
        if (!this.element) return;
        gsap.to(this.element, {
            opacity: 0,
            duration: 0.2,
            onComplete: () => {
                this.element.classList.add('hidden');
            }
        });
    }
};
