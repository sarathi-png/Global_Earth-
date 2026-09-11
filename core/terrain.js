// TerrainManager — no-op under MapLibre globe projection (3D curvature is
// native; no terrain provider needed). Kept as a stub for boot compatibility.
const TerrainManager = {
    init() {
        console.log('Terrain Manager Loaded (MapLibre globe — native 3D)');
    },
    toggleTerrain() {}
};
