const MarkerPulse = {
    entities: new Set(),

    create(entity, type) {
        if (!entity || !entity.point) return;

        const baseSize = entity.point.pixelSize || 6;
        const phase = Math.random() * Math.PI * 2;

        entity.point.pixelSize = new Cesium.CallbackProperty(() => {
            return baseSize + Math.sin(performance.now() / 1000 * 2 + phase) * 4;
        }, false);

        this.entities.add(entity);
    },

    remove(entityId) {
        this.entities.forEach(entity => {
            if (entity.id === entityId) {
                this.entities.delete(entity);
            }
        });
    }
};

window.MarkerPulse = MarkerPulse;