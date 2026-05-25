import { useState, useMemo } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

import zipCentroids from './data/zipCentroids.json';
import { styles } from './mapStyles/index.js';
import DropZone from './components/DropZone.jsx';
import ColumnMapper from './components/ColumnMapper.jsx';
import StyleSwitcher from './components/StyleSwitcher.jsx';
import Legend from './components/Legend.jsx';
import { sniffCsv, aggregateRows } from './utils/parseCsv.js';

// Built once at module load — O(1) lookup by 5-digit string zip
const zipLookup = new Map(
  zipCentroids.map(({ zip, lat, lon }) => [zip, { lat, lng: lon }])
);

export default function App() {
  const [rawCsv, setRawCsv] = useState(null);  // { headers, rows, zipIdx, countIdx, confidence }
  const [csvData, setCsvData] = useState([]);   // [{ zip, count }]
  const [activeStyleId, setActiveStyleId] = useState(styles[0].id);
  const [fileName, setFileName] = useState(null);
  const [error, setError] = useState(null);

  const { heatPoints, matched, unmatched, total } = useMemo(() => {
    if (!csvData.length) return { heatPoints: [], matched: 0, unmatched: 0, total: 0 };
    const maxCount = Math.max(...csvData.map(d => d.count));
    let matched = 0, unmatched = 0, total = 0;
    const heatPoints = csvData.flatMap(({ zip, count }) => {
      total += count;
      const loc = zipLookup.get(zip);
      if (!loc) { unmatched++; return []; }
      matched++;
      return [{ lat: loc.lat, lng: loc.lng, weight: count / maxCount }];
    });
    return { heatPoints, matched, unmatched, total };
  }, [csvData]);

  async function handleFile(file) {
    setError(null);
    try {
      const sniff = await sniffCsv(file);
      if (!sniff.rows.length) throw new Error('No rows found in file.');
      const parsed = aggregateRows(sniff.rows, sniff.zipIdx, sniff.countIdx);
      if (!parsed.length) throw new Error('No valid ZIP codes found in the detected column.');
      setRawCsv(sniff);
      setCsvData(parsed);
      setFileName(file.name);
    } catch (e) {
      setError(e.message ?? 'Failed to parse CSV.');
    }
  }

  function handleColumnChange(zipIdx, countIdx) {
    if (!rawCsv) return;
    const updated = { ...rawCsv, zipIdx, countIdx };
    setRawCsv(updated);
    setCsvData(aggregateRows(rawCsv.rows, zipIdx, countIdx));
  }

  const ActiveStyle = styles.find(s => s.id === activeStyleId)?.component;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-900 text-white">
      {/* ── Sidebar ── */}
      <aside className="w-64 flex-shrink-0 flex flex-col gap-5 p-4 bg-slate-800 border-r border-slate-700 overflow-y-auto">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-white">ZipMap</h1>
          <p className="text-xs text-slate-400 mt-0.5">US ZIP code heatmap</p>
        </div>

        <DropZone onFile={handleFile} fileName={fileName} error={error} />

        {rawCsv?.headers && (
          <ColumnMapper
            headers={rawCsv.headers}
            rows={rawCsv.rows}
            zipIdx={rawCsv.zipIdx}
            countIdx={rawCsv.countIdx}
            confidence={rawCsv.confidence}
            onChange={handleColumnChange}
          />
        )}

        <StyleSwitcher
          styles={styles}
          active={activeStyleId}
          onChange={setActiveStyleId}
        />

        {heatPoints.length > 0 && (
          <Legend matched={matched} unmatched={unmatched} total={total} />
        )}

        <div className="mt-auto text-xs text-slate-600">
          {zipLookup.size.toLocaleString()} ZIP codes indexed
        </div>
      </aside>

      {/* ── Map ── */}
      <main className="flex-1 relative">
        <MapContainer
          center={[39.5, -98.35]}
          zoom={4}
          style={{ height: '100%', width: '100%' }}
          zoomControl
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            subdomains="abcd"
            maxZoom={19}
          />
          {ActiveStyle && heatPoints.length > 0 && (
            <ActiveStyle data={heatPoints} />
          )}
        </MapContainer>

        {!heatPoints.length && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-slate-900/80 rounded-xl px-6 py-4 text-center">
              <p className="text-slate-300 text-sm">Upload a CSV to see your heatmap</p>
              <p className="text-slate-500 text-xs mt-1">zip column · or · zip, count columns</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
