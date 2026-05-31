# StoreCSV Heatmaps v0.3.70

A desktop app that visualizes online store sales orders as US ZIP code heatmaps and financial dashboards. Drop in CSV exports from **Etsy, eBay, Poshmark, or BrickLink** — column names are auto-detected — and instantly see where your customers are concentrated and how revenue breaks down over time.

Built with React + Vite inside a Tauri v2 desktop wrapper. Runs on Windows (macOS and Linux supported by Tauri).

---

## Supported Platforms

| Platform | Map view | Chart view | How to export |
|----------|----------|------------|---------------|
| **Etsy** | ✓ | ✓ | Shop Manager → Orders & Deliveries → Export as CSV |
| **eBay** | ✓ | ✓ | Seller Hub → Orders → Download report |
| **Poshmark** | ✓ | ✓ | Account → My Seller Tools → My Sales Report |
| **BrickLink** | ✓ | ✓ | Orders Received → Export |

All four Etsy export types are supported simultaneously: `SoldOrderItems`, `SoldOrders`, `DirectCheckoutPayments`, and `Deposits`. Generic CSVs with any `zip` or `postal code` column also work.

---

## Features

### Import
- **Drag-and-drop CSV import** — drop one or many files at once; native file dialog also available via File → Open CSV or Ctrl+O
- **Auto platform detection** — recognizes Etsy, eBay, Poshmark, and BrickLink exports automatically from column headers
- **Multi-file combining** — drop several years of exports at once; ZIP counts aggregate across all files
- **Auto column detection** — ZIP, quantity, and date columns recognized by name across all platforms; regex fallback for generic CSVs
- **Column mapper** — override the detected ZIP and count columns live
- **Mixed-type drops** — order files and payment/deposit files land in separate pools; none are discarded

### Map view
- **Four map styles**, switchable without reloading:
  - **Heatmap** — density surface
  - **Bubbles** — circle markers sized and colored by order weight
  - **Arcs** — curved bezier shipping paths from your shop ZIP to each customer
  - **Pushpins** — map pin markers scaled by order volume
- **3-D Globe** — interactive globe with spikes, arcs, and animated shipping paths
- **Scale modes** — Linear, Log, and Rank normalization for heat weight
- **Color gradients** — six gradient themes for Heatmap and Globe
- **Click-to-inspect** — click any ZIP for a popup with order list, customers, products, and total value
- **Date range filter** — narrow any view to a from/to window
- **Stat cards** — Total Orders, Unique ZIPs, States Reached
- **Top States panel** — floating overlay ranking top 5 states with percentage breakdown
- **Export** — save the current map view as PNG or JPEG

### Chart view
- **Revenue over time** — monthly chart of gross and net revenue
- **Top buyers** — ranked list of top 10 buyers by spend
- **Top products** — ranked list of top 10 products by revenue
- **Orders by weekday** — donut chart showing day-of-week distribution
- **KPI tiles** — Gross Revenue, Net Revenue, Fees, Orders, Avg Order, Refunds

---

## Supported CSV formats

### Etsy
| Export | Key ZIP column | Key price columns |
|--------|---------------|-------------------|
| Sold Order Items | `Ship Zipcode` | `Item Total`, `Quantity` |
| Sold Orders | `Ship Zipcode` | `Order Value`, `Sale Date` |
| Direct Checkout Payments | — (chart only) | `Gross Amount`, `Net Amount`, `Fees` |
| Deposits | — (chart only) | `Amount` |

### eBay (Seller Hub Orders report)
| Key columns | |
|-------------|--|
| `Sales Record Number` | Platform identifier |
| `User ID` | Buyer's eBay handle |
| `Buyer Postcode` | ZIP for map |
| `Sale Price`, `Total Price` | Revenue |
| `Sales Date` | Date filter |

### Poshmark (My Sales Report)
| Key columns | |
|-------------|--|
| `Order Id` | Platform identifier |
| `Buyer Zip Code` | ZIP for map |
| `Order Price` | Gross revenue |
| `Net Earnings` | Net revenue |
| `Listing Title` | Product name |

### BrickLink (Orders Received export)
| Key columns | |
|-------------|--|
| `Order ID` + `Date Ordered` | Platform identifier |
| `Buyer Postal Code` | ZIP for map |
| `Grand Total`, `Sub Total` | Revenue |

### Generic CSV
Any CSV with a `zip` or `postal code` column works:

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

ZIP+4 format (`48124-1023`) and 9-digit concatenated ZIPs are normalized automatically. Currency symbols and commas in price fields (`$16.00`, `1,234.56`) are stripped before parsing.

---

## Sample data

Three sample CSVs are bundled in `src/data/` for testing:

- `sample-ebay.csv` — 20 orders, collectibles/vintage
- `sample-poshmark.csv` — 25 orders, clothing/accessories
- `sample-bricklink.csv` — 30 orders, LEGO parts
- `sample-orders.csv` — generic Etsy-style orders (used by the "Try with sample data" button)

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
node scripts/bump-version.js
npm run tauri:build
```

Output: `src-tauri/target/release/bundle/nsis/StoreCSV_Heatmaps_<version>_x64-setup.exe`

The first build downloads and compiles Rust dependencies (~5–10 min). Subsequent builds are incremental (~25 sec).

> **Note:** Always build on a local SSD. Building on a network drive causes file-lock issues with Cargo's incremental cache.

---

## Project structure

```
src/
├── data/
│   ├── zipCentroids.json          42,354 US ZIP centroids
│   ├── sample-orders.csv          Etsy-style sample data
│   ├── sample-ebay.csv            eBay Seller Hub sample data
│   ├── sample-poshmark.csv        Poshmark sales report sample data
│   └── sample-bricklink.csv       BrickLink orders sample data
├── mapStyles/
│   ├── index.js                   style registry
│   ├── heatmap.js                 leaflet.heat layer
│   ├── bubbles.jsx                CircleMarker layer
│   ├── arcs.jsx                   bezier arc layer
│   └── pushpins.jsx               map pin layer
├── components/
│   ├── DropZone.jsx               drag-and-drop / native file import
│   ├── FileList.jsx               loaded file chips with remove button
│   ├── ColumnMapper.jsx           live column assignment dropdowns
│   ├── DateRangeFilter.jsx        from/to date filter
│   ├── StyleSwitcher.jsx          map style tabs
│   ├── BaseMapToggle.jsx          flat map / globe toggle
│   ├── OriginInput.jsx            ship-from ZIP for Arcs and Globe
│   ├── Legend.jsx                 density gradient bar
│   ├── ScaleSwitcher.jsx          linear / log / rank normalization
│   ├── HeatGradientPicker.jsx     gradient theme selector
│   ├── GlobeView.jsx              3-D globe
│   ├── GlobeLayerControls.jsx     globe layer toggles
│   ├── PaymentsView.jsx           financial dashboard
│   ├── CollapsibleSection.jsx     accordion sidebar section
│   ├── StatCards.jsx              KPI bar
│   ├── TopStatesPanel.jsx         top 5 states overlay
│   ├── ZipDetailPopup.jsx         click-to-inspect ZIP detail
│   └── ExportButtons.jsx          PNG / JPEG download
├── utils/
│   ├── parseCsv.js                CSV parsing, platform detection, aggregation
│   ├── openFile.js                Tauri native file dialog
│   └── exportMap.js               html2canvas map export
└── App.jsx                        root component
src-tauri/                         Tauri v2 Rust backend
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

### v0.3.62
- **Multi-platform support** — eBay, Poshmark, and BrickLink CSV exports auto-detected and parsed alongside Etsy
- **Poshmark map support** — Poshmark's `Buyer Zip Code` column enables full map view (previously assumed chart-only)
- **Fix $0 charts for dollar-sign prices** — `parseMoney()` strips `$`, commas, and whitespace before parsing; fixes Poshmark and eBay price fields
- **eBay column names corrected** — real Seller Hub columns confirmed: `User ID`, `Buyer Postcode`, `Buyer Full Name`, `Sales Date`
- **Globe Ship From input** — origin ZIP input now visible in globe mode so arcs/origin toggles unlock
- **Remove treasure map style** — styles are now: Heatmap, Bubbles, Arcs, Pushpins
- **Rename to StoreCSV Heatmaps** — app name, binary, and installer updated

### v0.3.55
- Batch multi-type import — order and payment/deposit files load into separate pools simultaneously
- Fixed drag-and-drop race condition
- Weekday chart converted to donut/pie

### v0.3.53
- Developer Tools (F12) in installed app
- Detailed CSV error logging
- Lossy UTF-8 import for Windows-1252 encoded files

### v0.3.51
- Financial dashboard with revenue over time, top buyers, top products, weekday distribution
- Payment/deposit file auto-detection
- Click-to-inspect ZIP popup

### v0.3.49
- 3-D Globe with animated arcs, spikes, and origin marker

### v0.3.0
- Stat cards, Top States panel, auto-generated insights

### v0.2.0
- Arcs and Treasure map styles, date range filter, native file dialog, origin ZIP

### v0.1.0
- Initial release: Heatmap + Bubbles, CSV auto-detection, PNG/JPEG export

---

## License

MIT
