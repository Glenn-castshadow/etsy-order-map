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
import BaseMapToggle from './components/BaseMapToggle.jsx';
import HeatGradientPicker from './components/HeatGradientPicker.jsx';
import GlobeLayerControls from './components/GlobeLayerControls.jsx';
import GlobeView from './components/GlobeView.jsx';
import PaymentsView from './components/PaymentsView.jsx';
import CollapsibleSection from './components/CollapsibleSection.jsx';
import { sniffCsv, aggregateRows, aggregatePayments, parseIsoDate } from './utils/parseCsv.js';
import logoSmall from '../images/logo_small.png';
import sampleCsv from './data/sample-orders.csv?raw';

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
  const [paymentsRaw, setPaymentsRaw]     = useState(null); // { headers, rows } for Etsy Payments CSV
  const [selectedRange, setSelectedRange] = useState({ from: '', to: '' });
  const [activeStyleId, setActiveStyleId] = useState(styles[0].id);
  const [scaleMode, setScaleMode]         = useState('linear');
  const [heatGradientId, setHeatGradientId]   = useState('spectrum');
  const [globeGradientId,   setGlobeGradientId]   = useState('spectrum');
  const [globeShowSpikes,   setGlobeShowSpikes]   = useState(true);
  const [globeShowArcs,     setGlobeShowArcs]     = useState(true);
  const [globeShowOrigin,   setGlobeShowOrigin]   = useState(true);
  const [globeArcsAnimated, setGlobeArcsAnimated] = useState(true);
  const [baseMap, setBaseMap]             = useState('flat');
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
    if (paymentsRaw) {
      const dateIdx = paymentsRaw.headers.findIndex(h => h.toLowerCase() === 'order date');
      if (dateIdx < 0) return null;
      const dates = paymentsRaw.rows
        .map(r => parseIsoDate(r[dateIdx]))
        .filter(Boolean)
        .sort();
      if (!dates.length) return null;
      return { min: dates[0], max: dates[dates.length - 1] };
    }
    if (!rawCsv || rawCsv.dateIdx < 0) return null;
    const dates = rawCsv.rows
      .map(r => parseIsoDate(r[rawCsv.dateIdx]))
      .filter(Boolean)
      .sort();
    if (!dates.length) return null;
    return { min: dates[0], max: dates[dates.length - 1] };
  }, [rawCsv, paymentsRaw]);

  const payments = useMemo(() => {
    if (!paymentsRaw) return null;
    return aggregatePayments(
      paymentsRaw.headers, paymentsRaw.rows,
      selectedRange.from || null, selectedRange.to || null,
    );
  }, [paymentsRaw, selectedRange.from, selectedRange.to]);

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
      if (sniff.kind === 'etsy-payments') {
        // Payments mode: clear map state, store raw rows for re-aggregation
        setRawCsv(null);
        setCsvData([]);
        setPaymentsRaw({ headers: sniff.headers, rows: sniff.rows });
        setFileName(file.name);
        return;
      }
      const parsed = reAggregate(sniff, '', '');
      if (!parsed.length) throw new Error('No valid ZIP codes found in the detected column.');
      // Orders mode: clear payments state
      setPaymentsRaw(null);
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

  function handleSample() {
    const file = new File([sampleCsv], 'sample-orders.csv', { type: 'text/csv' });
    handleFile(file);
  }

  function handleOriginZip(zip) {
    setOriginZip(zip);
    if (zip.length === 5) localStorage.setItem('zipmap-origin', zip);
    else localStorage.removeItem('zipmap-origin');
  }

  const ActiveStyle = styles.find(s => s.id === activeStyleId)?.component;
  const arcsActive  = activeStyleId === 'arcs';
  const needsOrigin = arcsActive && heatPoints.length > 0 && !originEntry;
  const isPaymentsMode = !!paymentsRaw;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-900 text-white">
      {/* ── Sidebar ── */}
      <aside className="w-64 flex-shrink-0 flex flex-col gap-3 p-4 bg-[#061526] border-r border-slate-700 overflow-y-auto">
        <img src={logoSmall} alt="ZipMap" className="h-20 w-auto self-start mb-1" />

        {/* ── Import CSV ── */}
        <CollapsibleSection title="Import CSV">
          <div className="flex flex-col gap-2">
            <DropZone onFile={handleFile} fileName={fileName} error={error} />
            {!fileName && (
              <button
                onClick={handleSample}
                className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-blue-400 transition-colors text-left"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                Try with sample data →
              </button>
            )}
          </div>
        </CollapsibleSection>

        {/* ── Columns ── */}
        {rawCsv?.headers && (
          <CollapsibleSection title="Columns">
            <ColumnMapper
              headers={rawCsv.headers}
              rows={rawCsv.rows}
              zipIdx={rawCsv.zipIdx}
              countIdx={rawCsv.countIdx}
              confidence={rawCsv.confidence}
              onChange={handleColumnChange}
            />
          </CollapsibleSection>
        )}

        {/* ── Payments badge (Etsy Payments CSV detected) ── */}
        {isPaymentsMode && (
          <div className="self-start text-xs font-medium text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded">
            Etsy Payments ✓
          </div>
        )}

        {/* ── Date Range ── */}
        {dateRange && (
          <CollapsibleSection title="Date Range">
            <DateRangeFilter
              min={dateRange.min}
              max={dateRange.max}
              from={selectedRange.from}
              to={selectedRange.to}
              onChange={handleDateRange}
            />
          </CollapsibleSection>
        )}

        {/* ── Map-only controls (hidden in Payments mode) ── */}
        {!isPaymentsMode && (
          <>
            <CollapsibleSection title="Base Map">
              <BaseMapToggle active={baseMap} onChange={setBaseMap} />
            </CollapsibleSection>

            {baseMap === 'flat' && (
              <CollapsibleSection title="Map Style">
                <div className="flex flex-col gap-2">
                  <StyleSwitcher
                    styles={styles}
                    active={activeStyleId}
                    onChange={setActiveStyleId}
                  />
                  {activeStyleId === 'heatmap' && heatPoints.length > 0 && (
                    <HeatGradientPicker
                      active={heatGradientId}
                      onChange={setHeatGradientId}
                    />
                  )}
                </div>
              </CollapsibleSection>
            )}

            {baseMap === 'globe' && heatPoints.length > 0 && (
              <CollapsibleSection title="Globe Layers">
                <GlobeLayerControls
                  showSpikes={globeShowSpikes}     onSpikes={setGlobeShowSpikes}
                  showArcs={globeShowArcs}         onArcs={setGlobeShowArcs}
                  showOrigin={globeShowOrigin}     onOrigin={setGlobeShowOrigin}
                  arcsAnimated={globeArcsAnimated} onArcsAnimated={setGlobeArcsAnimated}
                  hasOrigin={!!originEntry}
                  gradientId={globeGradientId}     onGradient={setGlobeGradientId}
                />
              </CollapsibleSection>
            )}

            {arcsActive && (
              <CollapsibleSection title="Ship From">
                <OriginInput
                  value={originZip}
                  onChange={handleOriginZip}
                  isValid={!!originEntry}
                />
              </CollapsibleSection>
            )}

            {heatPoints.length > 0 && (
              <CollapsibleSection title="Color Scale" defaultOpen={false}>
                <ScaleSwitcher active={scaleMode} onChange={setScaleMode} />
              </CollapsibleSection>
            )}

            {heatPoints.length > 0 && (
              <CollapsibleSection title="Legend" defaultOpen={false}>
                <Legend unmatched={unmatched} />
              </CollapsibleSection>
            )}

            {heatPoints.length > 0 && (
              <CollapsibleSection title="Export" defaultOpen={false}>
                <ExportButtons mapRef={mapRef} />
              </CollapsibleSection>
            )}
          </>
        )}

        <div className="mt-auto pt-2 text-xs text-slate-600">
          {zipLookup.size.toLocaleString()} ZIP codes indexed
        </div>
      </aside>

      {/* ── Content area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── Payments mode ─────────────────────────────────────────────── */}
        {isPaymentsMode && payments && (
          <PaymentsView payments={payments} />
        )}

        {/* ── Map mode ──────────────────────────────────────────────────── */}
        {!isPaymentsMode && (
        <>
        {/* Stat cards — only shown when data is loaded */}
        {heatPoints.length > 0 && stats && (
          <StatCards total={total} matched={matched} stateCount={stats.stateCount} />
        )}

        {/* Map / Globe */}
        <div ref={mapRef} className="flex-1 min-h-0 relative overflow-hidden">

          {baseMap === 'globe' ? (
            /* ── 3-D Globe ─────────────────────────────────────────────── */
            <GlobeView
              data={heatPoints}
              origin={originEntry}
              showSpikes={globeShowSpikes}
              showArcs={globeShowArcs}
              showOrigin={globeShowOrigin}
              arcsAnimated={globeArcsAnimated}
              gradientId={globeGradientId}
            />
          ) : (
            /* ── Flat map ──────────────────────────────────────────────── */
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
                <ActiveStyle data={heatPoints} origin={originEntry} gradientId={heatGradientId} />
              )}
            </MapContainer>
          )}

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
        </>
        )}
      </div>
    </div>
  );
}
