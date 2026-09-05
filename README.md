---
title: Global Earth
emoji: 🌍
colorFrom: blue
colorTo: green
sdk: static
app_file: index.html
pinned: false
license: mit
---

# Global Earth — GEO-INTEL Platform (OSIRIS-merged)

A fully offline-capable 3D globe intelligence platform built with [CesiumJS](https://cesium.com/) **merged with [OSIRIS](https://github.com/simplifaisoul/osiris)** — an 8k★ open-source OSINT map (Next.js 16 + MapLibre, MIT). Visualizes disasters, wars, mysteries, historical events, aircraft, satellites, weather, borders **plus OSIRIS live CCTV (60+ countries), maritime ports/chokepoints/AIS ships, conflict zones, flights and satellite constellations** on an interactive 3D earth with search, timeline, hover/click drawer (real images via Wikipedia → Wikimedia → Unsplash → canvas, Street View via Ion).

## Features

- **OSIRIS-merged Intelligence** — Single server at `http://localhost:8080` (`/api/osiris/*` native + proxy fallback to upstream OSIRIS on `:4000` if running). Vendored under `osiris/api + osiris/lib` (see `osiris-README.md`). Layers: **CCTV (TfL, WSDOT, worldwide)**, **Maritime ports + chokepoints + live AIS ships**, **Conflict zones + live RSS events**, **Flights (ADS-B)**, **Satellites (CelesTrak)** — all as CesiumJS entities via one `OSIRIS Intel` toggle (purple).
- **6+ Live NASA/USGS Sources** — EONET, USGS Earthquakes, GDACS, NOAA Weather Alerts, FIRMS Fires, FEMA Disasters, Open-Meteo
- **Real Aircraft & Satellites** — airplanes.live ADS-B + CelesTrak TLE propagation (also via OSIRIS-merged satellites endpoint)
- **Street View** — Cesium Ion Bing overlay + Google Street View panorama modal
- **Real Event Images** — Drawer fetches Wikipedia → Wikimedia Commons → Unsplash (`/api/unsplash` proxied with `UNSPLASH_ACCESS_KEY`) → canvas generator
- **GIBS / Heatmap / Ripple / DayNight** overlays
- **SSE Streaming, clustering, URL sync, PWA, fully offline with bundled assets**

## Requirements

- [Node.js](https://nodejs.org/) (v18+)

## Quick Start

```bash
npm start          # or: node server.js [port]
```

Open `http://localhost:8080/`

To use a different port: `node server.js 9000`

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```env
CESIUM_TOKEN=your_cesium_token_here
FIRMS_MAP_KEY=your_firms_api_key_here
NASA_API_KEY=your_nasa_api_key_here
UNSPLASH_ACCESS_KEY=your_unsplash_key  # from https://unsplash.com/developers — enables real drawer photos
OSIRIS_URL=http://localhost:4000       # optional: upstream OSIRIS for full live coverage
AIS_API_KEY=your_ais_key               # optional: live ships (otherwise ports/chokepoints static)
```

- **CESIUM_TOKEN** — Optional. Get from https://ion.cesium.com/ for Ion imagery/terrain
- **FIRMS_MAP_KEY** — Optional. Get from https://firms.modaps.eosdis.nasa.gov/api/area/ for fire data
- **NASA_API_KEY** — Optional. For additional NASA APIs
- **UNSPLASH_ACCESS_KEY** — Optional. Enables `/api/unsplash` real photos (free 50/hr demo, 5k/hr prod)
- **OSIRIS_URL** — Optional. Only needed if you run upstream OSIRIS separately for extended coverage; merged native `/api/osiris/*` already works without it
- **AIS_API_KEY** — Optional. Live AIS ships (overlaps static ports/chokepoints)

### URL Parameters

Share views with URL parameters:
```
?lat=40.7128&lng=-74.0060&zoom=5000000&layers=disasters,weather,live
```

## Architecture

### Live Data Sources (All Free)

| Source | Type | Update Frequency |
|--------|------|------------------|
| NASA EONET | Natural Events | Real-time |
| USGS Earthquakes | Seismic Data | Real-time |
| GDACS | Disaster Alerts | Real-time |
| NOAA NWS | Weather Alerts | Real-time |
| NASA FIRMS | Fire Detection | Daily |
| FEMA | Disaster Declarations | Daily |
| Open-Meteo | Weather Data | Hourly |
| airplanes.live | Aircraft ADS-B | Real-time |
| CelesTrak | Satellite TLE | Daily |
| NASA GIBS | Satellite Imagery | Daily |

### Offline Architecture

The entire app runs without internet:

- **CesiumJS 1.128** — Full bundle (JS, Workers, Assets, ThirdParty, Widgets) vendored locally under `vendor/cesium/`
- **Earth imagery** — Bundled Blue Marble equirectangular texture (`assets/textures/earth-texture.jpg`)
- **Terrain** — Ellipsoid fallback (no network terrain data bundled)
- **Data** — All incident datasets are static JSON in `data/`

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
| Aerospace | ADS-B Live | airplanes.live |
| Satellites | CelesTrak TLE | CelesTrak |
| Weather Overlay | Open-Meteo | Open-Meteo |
| Balance of Power | `data/countries.geo.json` | Natural Earth |
| Live Events | 6+ sources | EONET, USGS, GDACS, NOAA, FIRMS, FEMA |
| GIBS Satellite | NASA GIBS | NASA |
| **OSIRIS CCTV** | 60+ countries | TfL, WSDOT, Caltrans, 511, YouTube live (via OSIRIS) |
| **Maritime** | 30+ ports, 7 chokepoints, live AIS | aisstream.io (merged static + live) |
| **Conflicts** | 9+ warzones + live RSS | BBC/AlJazeera/ReliefWeb (merged) |
| **OSIRIS Flights** | ADS-B | airplanes.live (via OSIRIS) |
| **OSIRIS Satellites** | 400+ constellations | CelesTrak (via OSIRIS) |

## Project Structure

```
core/        Globe, camera, controls, terrain managers
layers/      One module per data layer (+ osirisLayer.js merged, streetViewLayer.js)
osiris/      Vendored OSIRIS source: api + lib (+ engine) — merged under single server (osiris-README.md, osiris-LICENSE)
incidents/   Marker factory, hover popup, clustering
search/      Search index + UI
timeline/    Year slider + playback
ui/          Incident detail drawer (with StreetView + OSIRIS extra panel)
animations/  GSAP UI animations, marker pulse
js/          Bootstrap, config (now with OSIRIS.merged), diagnostics, fallback, image chains
css/         Stylesheets
vendor/      CesiumJS (build-time vendored via scripts/vendor-cesium.js, gitignored), GSAP; Font Awesome via CDN
data/        JSON datasets + countries.geo.json
assets/      App icons + earth texture (build-time vendored, gitignored)
server.js    Merged single server: static + proxy + native /api/osiris/* + /api/unsplash + /api/firms
```

## Deployment

### Local Development

```bash
npm start
```

### GitHub Pages

```bash
npm run deploy
```

Or manually:

1. Enable GitHub Pages in repository settings
2. Run `npm run deploy`
3. Your site will be available at `https://<username>.github.io/<repo>/`

### Docker

```bash
docker build -t global-earth .
docker run -p 8080:8080 global-earth
```

## API Endpoints (Merged)

The single merged server provides:

- `GET /api/eonet, /api/usgs, /api/gdacs, /api/noaa, /api/fema` — NASA/USGS/NOAA proxies
- `GET /api/unsplash?query=&per_page=` — Unsplash image search (proxied, key hidden server-side)
- `GET /api/osiris/maritime` — ports + chokepoints (+ live ships if AIS key) — **merged native** (fallback proxies to `OSIRIS_URL`)
- `GET /api/osiris/conflicts` — conflict zones + live RSS events — merged native
- `GET /api/osiris/cctv?region=uk|us-west|all|&lat=&lng=` — worldwide CCTV — merged native (TfL, WSDOT, curated fallbacks; full coverage via upstream proxy)
- `GET /api/osiris/flights, /api/osiris/satellites, /api/osiris/earthquakes, /api/osiris/fires, /api/osiris/news` — merged native
- `GET /api/stream` — SSE real-time events
- `GET /api/health` — `{ merged: 'osiris+global-earth', osiris_native: [...] }`

## Notes

- `js/fallback.js` shows a "3D globe unavailable" banner only if CesiumJS itself fails to load
- No build step, no npm dependencies for the frontend
- Verified with headless browser tests in both online and fully-blocked-network modes
- All live data sources are 100% free with no API keys required (except FIRMS for fire data)

## License

MIT
