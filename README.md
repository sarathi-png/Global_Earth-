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

# Global Earth — GEO-INTEL Platform

A fully offline-capable 3D globe intelligence platform built with [CesiumJS](https://cesium.com/). Visualizes major disasters, wars, mysteries, historical events, aircraft, satellites, weather, and country borders on an interactive 3D earth with search, timeline playback, and hover/click detail panels.

## Features

- **6+ Live Data Sources** — Real-time data from NASA EONET, USGS Earthquakes, GDACS, NOAA Weather Alerts, NASA FIRMS Fires, FEMA Disasters, and Open-Meteo weather
- **Real Aircraft Tracking** — Live ADS-B data from airplanes.live API
- **Satellite Orbits** — CelesTrak TLE data with orbital propagation
- **GIBS Satellite Imagery** — NASA GIBS WMTS imagery layer
- **Entity Clustering** — Efficient marker clustering for 500+ data points
- **SSE Streaming** — Server-Sent Events for real-time updates with poll fallback
- **URL State Sync** — Share views via URL parameters
- **PWA Support** — Installable as a Progressive Web App
- **Offline Mode** — Works fully offline with bundled data

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
```

- **CESIUM_TOKEN** — Optional. Get from https://ion.cesium.com/ for Ion imagery/terrain
- **FIRMS_MAP_KEY** — Optional. Get from https://firms.modaps.eosdis.nasa.gov/api/area/ for fire data
- **NASA_API_KEY** — Optional. For additional NASA APIs

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
scripts/     Deploy scripts
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

## API Endpoints

The server provides proxy endpoints for live data:

- `GET /api/eonet` — NASA EONET events
- `GET /api/usgs` — USGS earthquakes
- `GET /api/gdacs` — GDACS alerts
- `GET /api/noaa` — NOAA weather alerts
- `GET /api/fema` — FEMA disasters
- `GET /api/stream` — SSE real-time events
- `GET /api/health` — Health check

## Notes

- `js/fallback.js` shows a "3D globe unavailable" banner only if CesiumJS itself fails to load
- No build step, no npm dependencies for the frontend
- Verified with headless browser tests in both online and fully-blocked-network modes
- All live data sources are 100% free with no API keys required (except FIRMS for fire data)

## License

MIT
