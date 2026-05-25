# Etsy Order Map v0.3.43

A desktop app that maps Etsy customer orders onto a US ZIP code heatmap. Drop in your Etsy order CSV export — column names are auto-detected — and instantly see where your customers are concentrated.

Built with React + Vite inside a Tauri v2 desktop wrapper. Runs on Windows (macOS and Linux supported by Tauri).

---

## Features

- **Drag-and-drop CSV import** — drop any Etsy order export directly onto the app; native file dialog also available via File → Open CSV or Cmd/Ctrl+O
- **Auto column detection** — `Ship Zipcode` and `Quantity` are recognized by name; falls back to regex for generic CSVs
- **Column mapper** — sidebar dropdowns let you override the detected ZIP and count columns live
- **Date range filter** — filter orders by date span when a date column is present
- **Four map styles**, switchable without reloading:
  - **Heatmap** — density surface via `leaflet.heat`
  - **Bubbles** — circle markers sized and colored by order weight
  - **Arcs** — curved bezier shipping paths from your shop ZIP to each customer location, color-coded by volume
  - **Treasure** — scattered coin piles that grow in size with order count
- **Stat cards** — KPI bar above the map showing Total Orders, Unique ZIPs, and States Reached
- **Top States panel** — floating overlay ranking the top 5 states by order share with percentage breakdown
- **Insights** — auto-generated sentences summarizing your top state, top ZIP, and geographic reach
- **Export** — save the current map view as PNG or JPEG
- **42,354 US ZIP centroids** bundled — no network call needed for lookups
- **Tauri desktop app** — native window, ships as a standalone `.exe` installer

---

## CSV format

The app accepts any CSV with at least a ZIP code column. Both formats work:

```
zip
10001
90210
60601
```

```
Ship Zipcode,Quantity,Sale Date
10001,3,2024-03-15
90210,1,2024-03-20
60601,2,2024-04-01
```

Recognized ZIP column names: `Ship Zipcode`, `Zip`, `Zip Code`, `Postal Code`, `Shipping Zip`, and more.  
Recognized count column names: `Quantity`, `Count`, `Qty`, `Orders`, `Sales`, and more.  
Recognized date column names: `Sale Date`, `Order Date`, `Date`, `Created At`, and more.

Duplicate ZIP codes are aggregated automatically.

---

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (for Tauri desktop builds)
- Windows: WebView2 runtime (pre-installed on Windows 10/11)

---

## Development

```bash
# Install dependencies
npm install

# Start the web dev server only (browser)
npm run dev

# Start the Tauri desktop app with hot reload
npm run tauri:dev
```

The web dev server runs on `http://localhost:5174`.

---

## Building a distributable

```bash
npm run tauri:build
```

Output is written to `src-tauri/target/release/bundle/`:

| File | Description |
|------|-------------|
| `nsis/*.exe` | NSIS installer (recommended for distribution) |
| `msi/*.msi` | MSI installer |

The first build downloads and compiles Rust dependencies (~5–10 min). Subsequent builds are incremental.

---

## Project structure

```
src/
├── data/
│   └── zipCentroids.json     42,354 ZIP centroids [{zip, city, state, lat, lon}]
├── mapStyles/
│   ├── index.js              style registry
│   ├── heatmap.js            leaflet.heat layer
│   ├── bubbles.jsx           CircleMarker layer
│   ├── arcs.jsx              bezier arc layer (origin → destinations)
│   └── treasure.jsx          scattered coin pile layer
├── components/
│   ├── DropZone.jsx          drag-and-drop / native file import
│   ├── ColumnMapper.jsx      live column assignment dropdowns
│   ├── DateRangeFilter.jsx   from/to date filter
│   ├── StyleSwitcher.jsx     style tab buttons
│   ├── OriginInput.jsx       ship-from ZIP for Arcs style
│   ├── Legend.jsx            density gradient bar + unrecognised ZIP warning
│   ├── StatCards.jsx         KPI bar — Total Orders, Unique ZIPs, States Reached
│   ├── TopStatesPanel.jsx    floating overlay — top 5 states + auto insights
│   └── ExportButtons.jsx     PNG / JPEG download
├── utils/
│   ├── parseCsv.js           PapaParse wrapper — sniff + aggregate
│   ├── openFile.js           Tauri native file dialog helper
│   └── exportMap.js          html2canvas capture + download
└── App.jsx
src-tauri/                    Tauri v2 Rust backend
```

### Adding a new map style

1. Create `src/mapStyles/myStyle.jsx` — export `{ id, label, component }`
2. The component receives `{ data, origin }`: `data` is an array of `{ lat, lng, weight }` (weight normalized 0–1); `origin` is `{ lat, lng }` when the Arcs-style ship-from ZIP is set
3. Import and add it to the `styles` array in `src/mapStyles/index.js`

The StyleSwitcher and App wire up automatically.

---

## Tech stack

| Library | Purpose |
|---------|---------|
| [React 19](https://react.dev/) + [Vite 8](https://vite.dev/) | UI framework + dev server |
| [Tauri v2](https://tauri.app/) | Desktop wrapper (Rust backend) |
| [react-leaflet](https://react-leaflet.js.org/) | Map container + tile layer |
| [leaflet.heat](https://github.com/Leaflet/Leaflet.heat) | Heatmap rendering |
| [PapaParse](https://www.papaparse.com/) | CSV parsing |
| [html2canvas](https://html2canvas.hertzen.com/) | Map export |
| [Tailwind CSS v4](https://tailwindcss.com/) | Styling |

---

## Changelog

### v0.3.0
- Added **Stat cards** — KPI bar above the map (Total Orders, Unique ZIPs, States Reached) with colour-coded accents; hidden until a CSV is loaded
- Added **Top States panel** — floating bottom-right overlay ranking the top 5 states by order share with percentage breakdown
- Added **Insights** — auto-generated summary sentences (leading state %, top ZIP with order count, states spanned)
- Simplified **Legend** — stripped to density gradient bar + unrecognised-ZIP count; stats moved to the KPI cards

### v0.2.0
- Added **Arcs** map style — quadratic bezier shipping paths from shop ZIP to customers
- Added **Treasure** map style — scattered coin piles scaled by order volume
- Added **Date range filter** — filter any date column to a from/to window
- Added **Native file dialog** — File → Open CSV menu item (Tauri only)
- Added **Origin ZIP input** with localStorage persistence for Arcs style

### v0.1.0
- Initial release: Heatmap + Bubbles styles, CSV auto-detection, PNG/JPEG export

---

## License

MIT
