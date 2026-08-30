# Global Earth — GEO-INTEL Platform

A fully offline-capable 3D globe intelligence platform built with [CesiumJS](https://cesium.com/). Visualizes major disasters, wars, mysteries, historical events, aircraft, satellites, weather, and country borders on an interactive 3D earth with search, timeline playback, and hover/click detail panels.

## Requirements

- [Node.js](https://nodejs.org/) (any modern version, tested on v24)

## Run

```bash
npm start          # or: node server.js [port]
```

Open `http://localhost:8080/`

To use a different port: `node server.js 9000`

## Offline Architecture

The entire app runs without internet:

- **CesiumJS 1.128** — full bundle (JS, Workers, Assets, ThirdParty, Widgets) vendored locally under `vendor/cesium/`, loaded via `CESIUM_BASE_URL` (see `index.html`).
- **Earth imagery** — bundled Blue Marble equirectangular texture (`assets/textures/earth-texture.jpg`), served as a single-tile layer when offline.
- **Terrain** — ellipsoid fallback (no network terrain data bundled).
- **Data** — all incident datasets are static JSON in `data/`.

### Online behavior (graceful upgrade)

When the machine is online **and** a valid Cesium Ion token is set, the app automatically upgrades to:

1. Ion world terrain (asset 1)
2. Ion imagery (asset 3)
3. OpenStreetMap tiles (last-resort fallback)

Every network path has a catch-and-fallback, so a dead token or missing network never breaks the globe.

## Layers & Data

| Layer | Data | Source |
|-------|------|--------|
| Disasters | `data/disasters.json` | USGS, NOAA, Red Cross |
| Conflicts & Wars | `data/wars.json` | History, UN |
| Mysteries | `data/mysteries.json` | curated |
| Major Events | `data/historical-events.json` | curated |
| Aerospace | simulated | in-code |
| Satellites | simulated orbits | in-code |
| Weather Overlay | simulated | in-code |
| Balance of Power | `data/countries.geo.json` | Natural Earth |

## Project Structure

```
core/        Globe, camera, controls, terrain managers
layers/      One module per data layer
incidents/   Marker factory, hover popup, clustering
search/      Search index + UI
timeline/    Year slider + playback
ui/          Incident detail drawer
animations/  GSAP UI animations, marker pulse
js/          Bootstrap, config, diagnostics, fallback banner
css/         Stylesheets
vendor/      CesiumJS, GSAP, Font Awesome (all local)
data/        JSON datasets
assets/      Bundled earth texture
```

## Configuration

`js/config.js` — `CESIUM_TOKEN` is optional; the app runs fully without it (offline texture + ellipsoid). Set a valid token from https://ion.cesium.com/ to enable Ion imagery/terrain when online.

## Notes

- `js/fallback.js` shows a "3D globe unavailable" banner only if CesiumJS itself fails to load (corrupt bundle / wrong path).
- No build step, no npm dependencies.
- Verified with headless browser tests in both online and fully-blocked-network modes.
