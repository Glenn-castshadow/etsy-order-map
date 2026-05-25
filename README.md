# Etsy Order Map v0.3.56

A desktop app that maps Etsy customer orders onto a US ZIP code heatmap. Drop in your Etsy order CSV exports — column names are auto-detected — and instantly see where your customers are concentrated.

Built with React + Vite inside a Tauri v2 desktop wrapper. Runs on Windows (macOS and Linux supported by Tauri).

---

## Features

### Import
- **Drag-and-drop CSV import** — drop one or many CSVs at once; native file dialog also available via File → Open CSV or Ctrl+O
- **All four Etsy export types supported simultaneously**:
  - `SoldOrderItems` — per-line-item data (product, SKU, quantity, ZIP)
  - `SoldOrders` — per-order data (buyer name, ZIP, order total)
  - `DirectCheckoutPayments` — payment ledger (gross, fees, net, status)
  - `Deposits` — bank deposit records
- **Mixed-type drops** — order files and payment/deposit files land in separate pools; none are discarded
- **Multi-file combining** — drop several years of exports at once; ZIP counts aggregate across all order files
- **Auto column detection** — `Ship Zipcode`, `Quantity`, and date columns recognized by name; regex fallback for generic CSVs
- **Column mapper** — override the detected ZIP and count columns live

### Map view (order files)
- **Four map styles**, switchable without reloading:
  - **Heatmap** — density surface
  - **Bubbles** — circle markers sized and colored by order weight
  - **Arcs** — curved bezier shipping paths from your shop ZIP to each customer
  - **Treasure** — scattered coin piles scaled by order volume
- **3-D Globe** — interactive globe with spikes, arcs, and animated shipping paths
- **Scale modes** — Linear, Log, and Rank normalization for the heat weight
- **Color gradients** — six gradient themes for Heatmap and Globe
- **Click-to-inspect** — click any ZIP on the map for a popup with order list, customers, products, and total value
- **Date range filter** — narrow any view to a from/to window; applies per-file using each file's own date column
- **Stat cards** — Total Orders, Unique ZIPs, States Reached
- **Top States panel** — floating overlay ranking top 5 states with percentage breakdown and auto-generated insights
- **Export** — save the current map view as PNG or JPEG

### Chart view (all file types)
- **Revenue over time** — monthly bar chart of gross revenue
- **Top buyers** — ranked list of top 10 buyers by spend
- **Top products** — ranked list of top 10 products by revenue (from SoldOrderItems)
- **Orders by weekday** — donut chart showing day-of-week distribution
- **Order status breakdown** — status distribution (from payment files)
- **KPI tiles** — Total Revenue, Orders, Avg Order, Fees, Net, Refunds

### App
- **Developer Tools** — View → Developer Tools (F12) in the installed app
- **42,354 US ZIP centroids** bundled — no network calls needed
- **Tauri desktop app** — ships as a standalone `.exe` NSIS installer

---

## Supported CSV formats

Any CSV with a ZIP column works. The app also recognizes all four Etsy export types automatically:

| Export type | How to get it | Key columns |
|-------------|--------------|-------------|
| Sold Order Items | Shop Manager → Orders → Export as CSV | Ship Zipcode, Item Name, Quantity, Sale Date |
| Sold Orders | Shop Manager → Orders → Export | Ship Zipcode, Full Name, Order Value, Sale Date |
| Direct Checkout Payments | Finances → Payment Account | Posted Gross, Card Processing Fees, Net Amount, Order Date |
| Deposits | Finances → Deposits | Amount, Date |

Generic CSVs with `zip` or `postal code` columns also work:

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

ZIP+4 format (`48124-1023`) and 9-digit concatenated ZIPs are normalized automatically.

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

Output: `src-tauri/target/release/bundle/nsis/etsy-order-map_<version>_x64-setup.exe`

The first build downloads and compiles Rust dependencies (~5–10 min). Subsequent builds are incremental.

---

## Project structure

```
src/
├── data/
│   ├── zipCentroids.json     42,354 ZIP centroids [{zip, city, state, lat, lon}]
│   └── sample-orders.csv     bundled sample data for the "Try with sample data" button
├── mapStyles/
│   ├── index.js              style registry
│   ├── heatmap.js            leaflet.heat layer
│   ├── bubbles.jsx           CircleMarker layer
│   ├── arcs.jsx              bezier arc layer (origin → destinations)
│   └── treasure.jsx          scattered coin pile layer
├── components/
│   ├── DropZone.jsx          drag-and-drop / native file import (batch-aware)
│   ├── FileList.jsx          loaded file chips with remove button
│   ├── ColumnMapper.jsx      live column assignment dropdowns
│   ├── DateRangeFilter.jsx   from/to date filter
│   ├── StyleSwitcher.jsx     style tab buttons
│   ├── BaseMapToggle.jsx     flat map / globe toggle
│   ├── OriginInput.jsx       ship-from ZIP for Arcs style
│   ├── Legend.jsx            density gradient bar + unrecognised ZIP warning
│   ├── ScaleSwitcher.jsx     linear / log / rank weight normalization
│   ├── HeatGradientPicker.jsx gradient theme selector
│   ├── GlobeView.jsx         3-D globe with spikes, arcs, origin marker
│   ├── GlobeLayerControls.jsx globe layer toggles
│   ├── PaymentsView.jsx      financial dashboard (revenue, buyers, products, weekday)
│   ├── CollapsibleSection.jsx accordion sidebar section
│   ├── StatCards.jsx         KPI bar — Total Orders, Unique ZIPs, States Reached
│   ├── TopStatesPanel.jsx    floating overlay — top 5 states + auto insights
│   ├── ZipDetailPopup.jsx    click-to-inspect ZIP detail overlay
│   └── ExportButtons.jsx     PNG / JPEG download
├── utils/
│   ├── parseCsv.js           PapaParse wrapper — sniff, aggregate, payments aggregation
│   ├── openFile.js           Tauri native file dialog helper
│   └── exportMap.js          html2canvas capture + download
└── App.jsx                   root — dual-pool state (order files + payment files)
src-tauri/                    Tauri v2 Rust backend
```

---

## Tech stack

| Library | Purpose |
|---------|---------|
| [React 19](https://react.dev/) + [Vite 8](https://vite.dev/) | UI framework + dev server |
| [Tauri v2](https://tauri.app/) | Desktop wrapper (Rust backend) |
| [react-leaflet](https://react-leaflet.js.org/) | Map container + tile layer |
| [leaflet.heat](https://github.com/Leaflet/Leaflet.heat) | Heatmap rendering |
| [react-globe.gl](https://github.com/vasturiano/react-globe.gl) | 3-D globe |
| [PapaParse](https://www.papaparse.com/) | CSV parsing |
| [html2canvas](https://html2canvas.hertzen.com/) | Map export |
| [Tailwind CSS v4](https://tailwindcss.com/) | Styling |

---

## Changelog

### v0.3.55
- **Batch multi-type import** — order files (SoldOrders / SoldOrderItems) and payment/deposit files (Payments / Deposits) now load into separate pools simultaneously; dropping all 10 Etsy exports at once no longer discards any files
- **Fixed drag-and-drop race condition** — all dropped files are now parsed concurrently and committed in one atomic state update, so import order no longer affects the result
- **Weekday chart** — replaced bar chart with a donut/pie chart for visual variety; legend bars show both order count and percentage

### v0.3.53
- **Developer Tools** — View → Developer Tools menu item (F12) opens DevTools in the installed app, not just during development
- **CSV error logging** — detailed `[ZipMap]`-prefixed console logs at every import stage (dialog, read, parse, validate) for diagnosing intermittent failures
- **Lossy UTF-8 import** — Rust backend now uses byte-level read + lossy conversion so Windows-1252 / Latin-1 encoded files no longer hard-fail

### v0.3.51
- **Financial dashboard** — Chart view with revenue over time, top buyers, top products, order status breakdown, and weekday distribution; works with SoldOrderItems, SoldOrders, and DirectCheckoutPayments exports
- **Payment / Deposit file support** — auto-detected from headers; routes to chart-only mode when no ZIP data is present
- **Click-to-inspect ZIP popup** — click any map ZIP for order list, customer names, products, and total value

### v0.3.49
- **3-D Globe** — interactive globe view with animated arcs, spikes, and origin marker; switchable via Base Map toggle
- **Globe layer controls** — toggle spikes, arcs, origin marker, arc animation, and gradient theme independently

### v0.3.0
- Added **Stat cards** — KPI bar above the map (Total Orders, Unique ZIPs, States Reached)
- Added **Top States panel** — floating overlay ranking top 5 states by order share
- Added **Insights** — auto-generated summary sentences
- Simplified **Legend**

### v0.2.0
- Added **Arcs** map style — quadratic bezier shipping paths from shop ZIP to customers
- Added **Treasure** map style — scattered coin piles scaled by order volume
- Added **Date range filter**
- Added **Native file dialog** — File → Open CSV
- Added **Origin ZIP input** with localStorage persistence

### v0.1.0
- Initial release: Heatmap + Bubbles styles, CSV auto-detection, PNG/JPEG export

---

## License

MIT
