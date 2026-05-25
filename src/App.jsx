import { useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

import zipCentroids from './data/zipCentroids.json';
import { styles } from './mapStyles/index.js';
import DropZone from './components/DropZone.jsx';
import ColumnMapper from './components/ColumnMapper.jsx';
import DateRangeFilter from './components/DateRangeFilter.jsx';
import StyleSwitcher from './components/StyleSwitcher.jsx';
import OriginInput from './components/OriginInput.jsx';
import Legend from './components/Legend.jsx';
import ExportButtons from './components/ExportButtons.jsx';
import StatCards from './components/StatCards.jsx';
import TopStatesPanel from './components/TopStatesPanel.jsx';
import ScaleSwitcher from './components/ScaleSwitcher.jsx';
import { sniffCsv, aggregateRows, parseIsoDate } from './utils/parseCsv.js';

const zipLookup      = new Map();
const zipStateLookup = new Map();
const zipCityLookup  = new Map();
for (const { zip, lat, lon, state, city } of zipCentroids) {
  zipLookup.set(zip, { lat, lng: lon });
  zipStateLookup.set(zip, state);
  zipCityLookup.set(zip, city);
}

export default function App() {
  const [rawCsv, setRawCsv]               = useState(null);
  const [csvData, setCsvData]             = useState([]);
  const [selectedRange, setSelectedRange] = useState({ from: '', to: '' });
  const [activeStyleId, setActiveStyleId] = useState(styles[0].id);
  const [scaleMode, setScaleMode]         = useState('linear');
  const [fileName, setFileName]           = useState(null);
  const [error, setError]                 = useState(null);
  const [originZip, setOriginZip]         = useState(
    () => localStorage.getItem('zipmap-origin') ?? ''
  );
  const mapRef = useRef(null);

  const originEntry = useMemo(() => {
    if (originZip.length < 5) return null;
    return zipLookup.get(originZip.padStart(5, '0')) ?? null;
  }, [originZip]);

  const dateRange = useMemo(() => {
    if (!rawCsv || rawCsv.dateIdx < 0) return null;
    const dates = rawCsv.rows
      .map(r => parseIsoDate(r[rawCsv.dateIdx]))
      .filter(Boolean)
      .sort();
    if (!dates.length) return null;
    return { min: dates[0], max: dates[dates.length - 1] };
  }, [rawCsv]);

  const { heatPoints, matched, unmatched, total } = useMemo(() => {
    if (!csvData.length) return { heatPoints: [], matched: 0, unmatched: 0, total: 0 };

    const maxCount = Math.max(...csvData.map(d => d.count));
    const logMax   = Math.log(maxCount + 1);
    let matched = 0, unmatched = 0, total = 0;

    // Geocode first, collect resolved points
    const resolved = [];
    for (const { zip, count } of csvData) {
      total += count;
      const loc = zipLookup.get(zip);
      if (!loc) { unmatched++; continue; }
      matched++;
      resolved.push({ lat: loc.lat, lng: loc.lng, count });
    }

    // Apply scale mode
    let heatPoints;
    if (scaleMode === 'rank') {
      const sorted = [...resolved].sort((a, b) => a.count - b.count);
      const n = sorted.length;
      heatPoints = sorted.map((p, i) => ({ lat: p.lat, lng: p.lng, weight: (i + 1) / n }));
    } else {
      heatPoints = resolved.map(p => ({
        lat: p.lat, lng: p.lng,
        weight: scaleMode === 'log'
          ? Math.log(p.count + 1) / logMax
          : p.count / maxCount,
      }));
    }

    return { heatPoints, matched, unmatched, total };
  }, [csvData, scaleMode]);

  const stats = useMemo(() => {
    if (!csvData.length) return null;
    const stateCounts = new Map();
    let topZip = null;
    for (const { zip, count } of csvData) {
      const state = zipStateLookup.get(zip);
      if (!state) continue;
      stateCounts.set(state, (stateCounts.get(state) ?? 0) + count);
      if (!topZip || count > topZip.count) {
        topZip = { zip, count, city: zipCityLookup.get(zip) };
      }
    }
    const topStates = [...stateCounts.entries()]
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return { topStates, topZip, stateCount: stateCounts.size };
  }, [csvData]);

  function reAggregate(sniff, from, to) {
    return aggregateRows(
      sniff.rows, sniff.zipIdx, sniff.countIdx,
      sniff.dateIdx, from || null, to || null,
    );
  }

  async function handleFile(file) {
    setError(null);
    setSelectedRange({ from: '', to: '' });
    try {
      const sniff = await sniffCsv(file);
      if (!sniff.rows.length) throw new Error('No rows found in file.');
      const parsed = reAggregate(sniff, '', '');
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
    setCsvData(reAggregate(updated, selectedRange.from, selectedRange.to));
  }

  function handleDateRange(from, to) {
    setSelectedRange({ from, to });
    if (rawCsv) setCsvData(reAggregate(rawCsv, from, to));
  }

  function handleOriginZip(zip) {
    setOriginZip(zip);
    if (zip.length === 5) localStorage.setItem('zipmap-origin', zip);
    else localStorage.removeItem('zipmap-origin');
  }

  const ActiveStyle = styles.find(s => s.id === activeStyleId)?.component;
  const arcsActive  = activeStyleId === 'arcs';
  const needsOrigin = arcsActive && heatPoints.length > 0 && !originEntry;

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

        {dateRange && (
          <DateRangeFilter
            min={dateRange.min}
            max={dateRange.max}
            from={selectedRange.from}
            to={selectedRange.to}
            onChange={handleDateRange}
          />
        )}

        <StyleSwitcher
          styles={styles}
          active={activeStyleId}
          onChange={setActiveStyleId}
        />

        {arcsActive && (
          <OriginInput
            value={originZip}
            onChange={handleOriginZip}
            isValid={!!originEntry}
          />
        )}

        {heatPoints.length > 0 && (
          <ScaleSwitcher active={scaleMode} onChange={setScaleMode} />
        )}

        {heatPoints.length > 0 && (
          <Legend unmatched={unmatched} />
        )}

        {heatPoints.length > 0 && (
          <ExportButtons mapRef={mapRef} />
        )}

        <div className="mt-auto text-xs text-slate-600">
          {zipLookup.size.toLocaleString()} ZIP codes indexed
        </div>
      </aside>

      {/* ── Content area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Stat cards — only shown when data is loaded */}
        {heatPoints.length > 0 && stats && (
          <StatCards total={total} matched={matched} stateCount={stats.stateCount} />
        )}

        {/* Map */}
        <div ref={mapRef} className="flex-1 relative">
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
              crossOrigin="anonymous"
            />
            {ActiveStyle && heatPoints.length > 0 && (
              <ActiveStyle data={heatPoints} origin={originEntry} />
            )}
          </MapContainer>

          {/* Empty state */}
          {!heatPoints.length && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-slate-900/80 rounded-xl px-6 py-4 text-center">
                <p className="text-slate-300 text-sm">Upload a CSV to see your heatmap</p>
                <p className="text-slate-500 text-xs mt-1">zip column · or · zip, count columns</p>
              </div>
            </div>
          )}

          {/* Arcs hint when origin ZIP not yet set */}
          {needsOrigin && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-slate-900/80 rounded-xl px-6 py-4 text-center">
                <p className="text-slate-300 text-sm">Enter your shop ZIP in the sidebar</p>
                <p className="text-slate-500 text-xs mt-1">to draw shipping arcs from your location</p>
              </div>
            </div>
          )}

          {/* Top states + insights overlay */}
          {heatPoints.length > 0 && stats && (
            <TopStatesPanel
              topStates={stats.topStates}
              total={total}
              topZip={stats.topZip}
              stateCount={stats.stateCount}
            />
          )}
        </div>
      </div>
    </div>
  );
}
