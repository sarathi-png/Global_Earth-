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

# Global Earth — GEO-INTEL Platform (fully static)

A fully static 3D globe intelligence platform built with [MapLibre GL](https://maplibre.org/) (same engine + CARTO dark-matter globe design as [osirisai.live](https://osirisai.live/)). Visualizes disasters, wars, mysteries, historical events, aircraft, satellites, weather, borders plus a live multi-source event feed on an interactive 3D earth with search, hover tooltips, single-click fly-to drawer (images via Wikipedia → Wikimedia → canvas), tabbed Street View (Google / Mapillary / OSM), and an outbound deep-link to the reference live app [osirisai.live](https://osirisai.live/) (external — no vendored code, no backend).

## Features

- **7+ Live NASA/USGS Sources** — EONET, USGS Earthquakes (FDSN), GDACS JSON API, NOAA Weather Alerts, FIRMS Fires, FEMA Disasters, ReliefWeb, Open-Meteo — direct browser calls, no server
- **Committed monthly archive** — `data/archive-latest.json` (built by `npm run archive`) covers 2025-01-01 → last day of previous month; sidebar badge shows "Through {Mon YYYY}"; app works offline from snapshot, then merges live
- **Real Aircraft & Satellites** — airplanes.live ADS-B + CelesTrak
- **Street View (tabbed)** — Google keyless embed + Mapillary (nearest-photo embed with `?mapillary_key=`, graceful app-link fallback without) + OSM map fallback; lazy iframes with spinner/timeout/external links; sidebar toggle switches a keyless aerial-imagery overlay
- **Legend hover + click** — hover tooltip (label, visible count, description); single click enables the layer and flies to it; markers single-click opens drawer + flies, double-click zooms closer, clusters expand on click; pulse rings only on Critical/Extreme events
- **View controls (OSIRIS parity)** — bottom-left 3D/2D globe switch (`G`), MAP/SAT basemap switch (SAT = keyless ESRI aerial under markers), live scale bar, `?` shortcuts overlay (`R` home, `F` fullscreen, `S` copy share link, `L` panel, `I` feed, `ESC` close); projection persists in `&proj=`
- **Panels (OSIRIS parity)** — sidebar layer rows + group headers show live counts; intel feed has severity filter chips (ALL/CRIT/HIGH/MOD) and opens the drawer on click; share modal copies the view link or map-center OSIRIS deep-link; saved views (localStorage) restore position + layers; bottom status bar shows live state, event total, 3D/2D + MAP/SAT tags, cursor coords; aircraft drawers link FlightAware/ADS-B/RadarBox, satellites link N2YO/CelesTrak
- **OSIRIS Live mapping** — sidebar, legend, and per-incident drawer buttons open `https://osirisai.live/?lat=…&lng=…&zoom=…&label=…` (the OSIRIS app flies to the shared incident on load)
- **GIBS / Heatmap / Ripple / DayNight** overlays; clustering, URL sync, PWA, offline-capable static assets

## Requirements

- Any static host (GitHub Pages / Netlify / Render Static) — or [Node.js](https://nodejs.org/) v18+ for local dev / `npm run archive`

## Quick Start (static)

```bash
npx serve .                 # or: python -m http.server 8080
# dev alternative: node server.js [port]   (dev-only static server, optional)
```

Open `http://localhost:8080/` (or `3000` for `npm run dev`).

Monthly archive snapshot:

```bash
npm run archive             # writes data/archive-latest.json (START 2025-01-01 → previous-month-end)
```

## Configuration

### Client keys (no server; optional)

```
?firms_key=...&unsplash_key=...&mapillary_key=...&map_style=<style.json URL>
```

- **FIRMS_MAP_KEY** — Optional. https://firms.modaps.eosdis.nasa.gov/api/area/ for fire data (else fires omitted)
- **NASA_API_KEY** — Optional, defaults to `DEMO_KEY`
- **UNSPLASH_ACCESS_KEY** — Optional. Without it, drawer images use Wikipedia → Wikimedia → canvas (no breakage)
- **MAPILLARY_KEY** — Optional. https://mapillary.com/dashboard/developers — resolves the nearest street photo for the Mapillary tab (else the tab links out to the Mapillary app)
- **MAP_STYLE** — Optional. Override the CARTO dark-matter basemap with any MapLibre style URL. No token needed for anything — the globe runs fully keyless.

### URL Parameters

Share views with URL parameters:
```
?lat=40.7128&lng=-74.0060&zoom=6.5&layers=disasters,weather,live
```

## Architecture

### Live Data Sources (All Free, keyless unless noted)

| Source | Type | Range support |
|--------|------|---------------|
| USGS FDSN Event (`earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=&endtime=&minmagnitude=`) | Earthquakes back to 1900 | Full date range → previous-month-end |
| NASA EONET (`eonet.gsfc.nasa.gov/api/v3/events?status=all`) | Natural events | Bounded client-side to window |
| GDACS JSON API (`gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?fromdate=&todate=`) | EQ/TC/FL/VO/WF/DR alerts | Native from/to (≤100/page) |
| NOAA NWS (`api.weather.gov/alerts/active`) | Weather alerts | Current (US) |
| NASA FIRMS VIIRS CSV (key via `?firms_key=`) | Fire detection | Per-date archive loop |
| FEMA (`fema.gov/api/open/v2/...?$filter=declarationDate ge/le`) | US disaster declarations | Native date filter |
| ReliefWeb (`api.reliefweb.int/v2/disasters?appname=`) | Humanitarian disasters | Date filter |
| GDELT 2.1 Doc (`api.gdeltproject.org/...&startdatetime=&enddatetime=`) | News events | Native datetime range |
| Open-Meteo Archive (`archive-api.open-meteo.com/...&start_date=&end_date=`) | Weather history per point | Native date range |
| airplanes.live / CelesTrak / GIBS | Aircraft / satellites / imagery | Live |

### Engine (OSIRIS design)

- **MapLibre GL v4** — vendored locally under `vendor/maplibre/` (`npm run vendor`), pinned CDN fallbacks (jsDelivr → unpkg)
- **Basemap** — CARTO dark-matter vector style with `projection: 'globe'`, maxPitch 85; if the style fails, a bundled dark raster style takes over so the globe always renders (no token, no texture files needed)
- **Markers** — clustered GeoJSON sources with glow + dot + label layers (OSIRIS paint expressions); aircraft as rotated canvas plane icons; satellites ground-projected from Keplerian elements; day/night terminator fill; native heatmap layer; animated ripple rings/arcs
- **Data** — All incident datasets are static JSON in `data/`; live feed merges the committed monthly snapshot first, then live sources

Every network path has a catch-and-fallback, so a dead network never breaks the globe.

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
| Live Events | 7+ sources + snapshot | EONET, USGS FDSN, GDACS JSON, NOAA, FIRMS, FEMA, ReliefWeb, GDELT |
| Archive | `data/archive-latest.json` | Built by `npm run archive` (start → previous-month-end) |
| GIBS Satellite | NASA GIBS | NASA |
| External intel | Outbound deep-link | [osirisai.live](https://osirisai.live/) (reference app, no integration) |

## Project Structure

```
core/        Globe, camera, controls, terrain managers
layers/      One module per data layer (streetViewLayer.js = tabbed Google/Mapillary/OSM)
incidents/   Marker factory, hover popup, clustering
search/      Search index + UI
ui/          Incident detail drawer (Street View tabs + OSIRIS Live deep-link), legend interactions
animations/  GSAP UI animations, marker pulse
js/          Bootstrap, config, archiveRange, osirisLink, liveApi (direct + snapshot), diagnostics, fallback, image chains
scripts/     Vendor (vendor-maplibre.js) + deploy + build-archive.mjs (monthly snapshot → data/archive-latest.json)
css/         Stylesheets
vendor/      MapLibre GL (build-time vendored via scripts/vendor-maplibre.js, gitignored), GSAP; Font Awesome via CDN
data/        JSON datasets + countries.geo.json + archive-latest.json
assets/      App icons + earth texture (build-time vendored, gitignored)
server.js    Dev-only static file server (production needs no server)
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

## Data endpoints (direct, no backend)

The app calls public APIs straight from the browser (see table above); the only
same-origin file is the committed `data/archive-latest.json` snapshot.
Dev server exposes `GET /api/health` → `{ status: 'ok', mode: 'static-dev' }` for smoke tests only.

## Notes

- `js/fallback.js` shows a "3D globe unavailable" banner only if MapLibre GL itself fails to load
- No build step, no npm dependencies for the frontend
- Verified with headless browser tests in both online and fully-blocked-network modes
- All live data sources are 100% free with no API keys required (except FIRMS for fire data)

## License

MIT
