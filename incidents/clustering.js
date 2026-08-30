const ClusteringManager = {
    enabled: true,
    clusterDataSource: null,

    init() {
        if (!GlobeManager.viewer) return;
        this.clusterDataSource = new Cesium.CustomDataSource('clustered-incidents');
        GlobeManager.viewer.dataSources.add(this.clusterDataSource);

        this.clusterDataSource.clustering.enabled = true;
        this.clusterDataSource.clustering.pixelRange = 50;
        this.clusterDataSource.clustering.minimumClusterSize = 3;

        this.clusterDataSource.clustering.clusterEvent.addEventListener((clusteredEntities, cluster) => {
            if (clusteredEntities.length >= 3) {
                cluster.billboard.show = true;
                cluster.label.show = true;
                cluster.point.show = false;
                cluster.billboard.image = this.createClusterCanvas(clusteredEntities.length);
                cluster.label.text = clusteredEntities.length.toString();
                cluster.label.font = 'bold 14px Inter, sans-serif';
                cluster.label.fillColor = Cesium.Color.WHITE;
                cluster.label.outlineColor = Cesium.Color.BLACK;
                cluster.label.outlineWidth = 2;
                cluster.label.style = Cesium.LabelStyle.FILL_AND_OUTLINE;
                cluster.label.pixelOffset = new Cesium.Cartesian2(0, 0);
                cluster.billboard.scaleByDistance = new Cesium.NearFarScalar(100000, 1, 8000000, 0.3);
                cluster.label.scaleByDistance = new Cesium.NearFarScalar(100000, 1, 8000000, 0.3);
            }
        });

        console.log("Clustering System Initialized (EntityCluster)");
    },

    createClusterCanvas(count) {
        const canvas = document.createElement('canvas');
        const size = 48;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const radius = size / 2;
        const intensity = Math.min(count / 20, 1);

        const r = Math.round(255 * intensity);
        const g = Math.round(180 * (1 - intensity));
        const b = Math.round(0);

        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ',0.6)';

        ctx.beginPath();
        ctx.arc(radius, radius, radius - 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',0.8)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(count.toString(), radius, radius);

        return canvas;
    },

    toggle(show) {
        this.enabled = show;
        if (this.clusterDataSource) this.clusterDataSource.clustering.enabled = show;
    }
};
