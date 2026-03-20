const MarkerPulse = {
    pulses: new Map(),

    create(entity, type) {
        if (!entity || !entity.point) return;

        let color;
        switch(type) {
            case 'war': color = CONFIG.LAYERS.wars ? CONFIG.LAYERS.wars.color : '#ff3b30'; break;
            case 'disaster': color = CONFIG.LAYERS.disasters.color; break;
            case 'mystery': color = CONFIG.LAYERS.mysteries ? CONFIG.LAYERS.mysteries.color : '#bf5af2'; break;
            default: color = '#00f2ff';
        }

        // We use GSAP to animate the pixelSize of the point
        const pulseObj = { size: 12, alpha: 1 };
        
        const tl = gsap.timeline({ repeat: -1, yoyo: true });
        tl.to(pulseObj, {
            size: 24,
            duration: 1.5,
            ease: "sine.inOut",
            onUpdate: () => {
                entity.point.pixelSize = pulseObj.size;
            }
        });

        this.pulses.set(entity.id, tl);
    },

    remove(entityId) {
        if (this.pulses.has(entityId)) {
            this.pulses.get(entityId).kill();
            this.pulses.delete(entityId);
        }
    }
};
