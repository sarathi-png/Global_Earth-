const MarkerPulse = {
    entities: new Set(),
    running: false,

    create(entity, type) {
        if (!entity || !entity.point) return;

        entity._pulseBase = entity.point.pixelSize || 6;
        entity._pulsePhase = Math.random() * Math.PI * 2;

        this.entities.add(entity);
        this.start();
    },

    start() {
        if (this.running) return;
        this.running = true;

        const tick = () => {
            if (!this.running) return;
            const t = performance.now() / 1000;

            this.entities.forEach(entity => {
                if (!entity.show || !entity.point || !entity.point.show) return;
                entity.point.pixelSize = entity._pulseBase + Math.sin(t * 2 + entity._pulsePhase) * 4;
            });

            requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
    },

    remove(entityId) {
        let removed = false;
        this.entities.forEach(entity => {
            if (entity.id === entityId) {
                this.entities.delete(entity);
                removed = true;
            }
        });
        if (removed && this.entities.size === 0) {
            this.running = false;
        }
    }
};

window.MarkerPulse = MarkerPulse;