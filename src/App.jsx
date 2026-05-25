import { useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

import zipCentroids from './data/zipCentroids.json';
import { styles } from './mapStyles/index.js';
import DropZone from './components/DropZone.jsx';
import FileList from './components/FileList.jsx';
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
import { sniffCsv, aggregateRows, aggregatePayments, aggregateZipDetails, parseIsoDate } from './utils/parseCsv.js';
import ZipDetailPopup from './components/ZipDetailPopup.jsx';
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
  // csvFiles: order files (SoldOrderItems, SoldOrders) — drives the map and
  // order-based charts.  paymentCsvFiles: payment/deposit files — drives the
  // chart when no order files are loaded.  Both pools coexist so that dropping
  // all file types at once doesn't discard any files.
  const [csvFiles, setCsvFiles]           = useState([]);
  const [paymentCsvFiles, setPaymentCsvFiles] = useState([]);
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
  const [viewMode, setViewMode]           = useState('map');  // 'map' | 'chart'
  const [selectedZip, setSelectedZip]     = useState(null);   // clicked ZIP for popup
  const [error, setError]                 = useState(null);
  const [originZip, setOriginZip]         = useState(
    () => localStorage.getItem('zipmap-origin') ?? ''
  );
  const mapRef = useRef(null);

  const originEntry = useMemo(() => {
    if (originZip.length < 5) return null;
    return zipLookup.get(originZip.padStart(5, '0')) ?? null;
  }, [originZip]);

  // All files combined for date-range and file-list purposes.
  const allFiles = useMemo(
    () => [...csvFiles, ...paymentCsvFiles],
    [csvFiles, paymentCsvFiles],
  );

  const hasOrderData   = csvFiles.length > 0;
  const hasPaymentData = paymentCsvFiles.length > 0;
  // Chart-only mode: payment/deposit files loaded but no order files.
  const isPaymentsMode = !hasOrderData && hasPaymentData;
  // Kind forwarded to PaymentsView: prefer payment files when that's all we have.
  const chartKind = isPaymentsMode
    ? (paymentCsvFiles[0]?.kind ?? 'etsy-payments')
    : (csvFiles[0]?.kind ?? 'orders');

  const dateRange = useMemo(() => {
    if (!allFiles.length) return null;
    const allDates = [];
    for (const file of allFiles) {
      if (file.dateIdx < 0) continue;
      for (const row of file.rows) {
        const d = parseIsoDate(row[file.dateIdx]);
        if (d) allDates.push(d);
      }
    }
    if (!allDates.length) return null;
    allDates.sort();
    return { min: allDates[0], max: allDates[allDates.length - 1] };
  }, [allFiles]);

  // Combined zip→count across all order files, with date filter applied
  // per-file so each file uses its own dateIdx mapping.
  const csvData = useMemo(() => {
    if (!csvFiles.length) return [];
    const combined = new Map();
    for (const file of csvFiles) {
      const aggregated = aggregateRows(
        file.rows, file.zipIdx, file.countIdx,
        file.dateIdx, selectedRange.from || null, selectedRange.to || null,
      );
      for (const { zip, count } of aggregated) {
        combined.set(zip, (combined.get(zip) ?? 0) + count);
      }
    }
    return [...combined.entries()].map(([zip, count]) => ({ zip, count }));
  }, [csvFiles, selectedRange.from, selectedRange.to]);

  // Financial aggregation: prefer dedicated payment/deposit files when loaded;
  // fall back to order files which also carry revenue data.
  const payments = useMemo(() => {
    const src = hasPaymentData ? paymentCsvFiles : csvFiles;
    if (!src.length) return null;
    return aggregatePayments(src, selectedRange.from || null, selectedRange.to || null);
  }, [csvFiles, paymentCsvFiles, hasPaymentData, selectedRange.from, selectedRange.to]);

  const { heatPoints, matched, unmatched, total } = useMemo(() => {
    if (!csvData.length) return { heatPoints: [], matched: 0, unmatched: 0, total: 0 };

    const maxCount = Math.max(...csvData.map(d => d.count));
    const logMax   = Math.log(maxCount + 1);
    let matched = 0, unmatched = 0, total = 0;

    // Geocode first, collect resolved points (carry zip through for click-detail)
    const resolved = [];
    for (const { zip, count } of csvData) {
      total += count;
      const loc = zipLookup.get(zip);
      if (!loc) { unmatched++; continue; }
      matched++;
      resolved.push({ zip, lat: loc.lat, lng: loc.lng, count });
    }

    // Apply scale mode
    let heatPoints;
    if (scaleMode === 'rank') {
      const sorted = [...resolved].sort((a, b) => a.count - b.count);
      const n = sorted.length;
      heatPoints = sorted.map((p, i) => ({ zip: p.zip, lat: p.lat, lng: p.lng, weight: (i + 1) / n }));
    } else {
      heatPoints = resolved.map(p => ({
        zip: p.zip, lat: p.lat, lng: p.lng,
        weight: scaleMode === 'log'
          ? Math.log(p.count + 1) / logMax
          : p.count / maxCount,
      }));
    }

    return { heatPoints, matched, unmatched, total };
  }, [csvData, scaleMode]);

  // Per-ZIP detail bundle for the click-to-inspect popup (order files only).
  const zipDetails = useMemo(
    () => aggregateZipDetails(csvFiles, selectedRange.from || null, selectedRange.to || null),
    [csvFiles, selectedRange.from, selectedRange.to],
  );

  // Detail entry for the clicked ZIP, enriched with the centroid lookup's city/state
  const selectedDetail = useMemo(() => {
    if (!selectedZip) return null;
    const d = zipDetails.get(selectedZip);
    if (!d) return null;
    return {
      ...d,
      city:  d.city  || zipCityLookup.get(selectedZip)  || '',
      state: d.state || zipStateLookup.get(selectedZip) || '',
    };
  }, [selectedZip, zipDetails]);

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

  async function handleFile(fileOrFiles) {
    const files = Array.isArray(fileOrFiles) ? fileOrFiles : [fileOrFiles];
    setError(null);
    let stage = 'parsing';
    try {
      const settled = await Promise.allSettled(
        files.map(f => sniffCsv(f).then(sniff => ({ file: f, sniff })))
      );

      stage = 'validating';
      const orderEntries   = [];
      const paymentEntries = [];

      for (const r of settled) {
        if (r.status === 'rejected') { console.error('[ZipMap] parse failed', r.reason); continue; }
        const { file, sniff } = r.value;
        if (!sniff.rows.length) { console.warn('[ZipMap] no rows', file.name); continue; }
        const kind = sniff.kind ?? 'orders';
        const entry = {
          id:   `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          name: file.name,
          ...sniff,
          kind,
        };
        if (kind === 'etsy-payments' || kind === 'etsy-deposits') {
          paymentEntries.push(entry);
        } else {
          const test = aggregateRows(sniff.rows, sniff.zipIdx, sniff.countIdx);
          if (!test.length) { console.warn('[ZipMap] no valid ZIPs', file.name); continue; }
          orderEntries.push(entry);
        }
      }

      if (!orderEntries.length && !paymentEntries.length) {
        throw new Error('No valid files could be imported.');
      }

      stage = 'done';
      if (orderEntries.length)   setCsvFiles(prev => [...prev, ...orderEntries]);
      if (paymentEntries.length) setPaymentCsvFiles(prev => [...prev, ...paymentEntries]);
    } catch (e) {
      const msg = e?.message ?? String(e) ?? 'Unknown error';
      console.error('[ZipMap] import failed', { stage, error: msg, stack: e?.stack });
      setError(`[${stage}] ${msg}`);
    }
  }

  function handleRemoveFile(id) {
    setCsvFiles(prev => prev.filter(f => f.id !== id));
    setPaymentCsvFiles(prev => prev.filter(f => f.id !== id));
  }

  // Column-mapper edits propagate to every file whose headers match the
  // first file's — typical case is several years of the same Etsy export,
  // so one edit covers them all.  Files with different headers keep their
  // own auto-detected indices.
  function handleColumnChange(zipIdx, countIdx) {
    setCsvFiles(prev => {
      if (!prev.length) return prev;
      const firstKey = JSON.stringify(prev[0].headers);
      return prev.map(f =>
        JSON.stringify(f.headers) === firstKey
          ? { ...f, zipIdx, countIdx }
          : f
      );
    });
  }

  function handleDateRange(from, to) {
    setSelectedRange({ from, to });
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
  // True whenever the chart dashboard is visible.
  const isChartView = isPaymentsMode || viewMode === 'chart';
  const firstFile = csvFiles[0] ?? null; // drives the ColumnMapper UI

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-900 text-white">
      {/* ── Sidebar ── */}
      <aside className="w-64 flex-shrink-0 flex flex-col gap-3 p-4 bg-[#061526] border-r border-slate-700 overflow-y-auto">
        <img src={logoSmall} alt="ZipMap" className="h-20 w-auto self-start mb-1" />

        {/* ── Import CSV ── */}
        <CollapsibleSection title="Import CSV">
          <div className="flex flex-col gap-2">
            <DropZone
              onFile={handleFile}
              hasFiles={csvFiles.length > 0 || paymentCsvFiles.length > 0}
              error={error}
            />
            <FileList files={allFiles} onRemove={handleRemoveFile} />
            {csvFiles.length === 0 && paymentCsvFiles.length === 0 && (
              <button
                onClick={handleSample}
                className="inline-flex items-center gap-2 text-xs text-slate-400 hover:text-blue-400 transition-colors text-left"
              >
                <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                Try with sample data →
              </button>
            )}
            {csvFiles.length > 1 && (
              <p className="text-xs text-slate-500">
                Orders: {csvData.length.toLocaleString()} unique ZIP{csvData.length !== 1 ? 's' : ''}
              </p>
            )}
            {paymentCsvFiles.length > 0 && payments && hasPaymentData && (
              <p className="text-xs text-slate-500">
                Payments: {payments.totals.orderCount.toLocaleString()} record{payments.totals.orderCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </CollapsibleSection>

        {/* ── Map weighting (orders mode + map view) ── */}
        {!isChartView && firstFile?.headers && (
          <CollapsibleSection title="Map Weighting">
            <ColumnMapper
              headers={firstFile.headers}
              rows={firstFile.rows}
              zipIdx={firstFile.zipIdx}
              countIdx={firstFile.countIdx}
              confidence={firstFile.confidence}
              onChange={handleColumnChange}
            />
          </CollapsibleSection>
        )}

        {/* ── Payment/deposit file badge ── */}
        {hasPaymentData && (
          <div className="self-start text-xs font-medium text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded">
            {paymentCsvFiles.some(f => f.kind === 'etsy-deposits') ? 'Etsy Deposits ✓' : 'Etsy Payments ✓'}
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

        {/* ── Map-only controls (hidden in chart view of any kind) ── */}
        {!isChartView && (
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

        {!isChartView && (
          <div className="mt-auto pt-2 text-xs text-slate-600">
            {zipLookup.size.toLocaleString()} ZIP codes indexed
          </div>
        )}
      </aside>

      {/* ── Content area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* View-mode toggle — visible whenever there's data.  Map is disabled
            in payments mode (no ZIPs to plot). */}
        {allFiles.length > 0 && (
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-slate-800 bg-slate-900/60">
            <ViewToggleBtn
              label="🗺️ Map"
              active={viewMode === 'map' && hasOrderData}
              disabled={!hasOrderData}
              onClick={() => setViewMode('map')}
              title={!hasOrderData ? 'Load order files (SoldOrders / SoldOrderItems) to see the map' : undefined}
            />
            <ViewToggleBtn
              label="📊 Chart"
              active={viewMode === 'chart' || isPaymentsMode}
              onClick={() => setViewMode('chart')}
            />
          </div>
        )}

        {/* ── Chart view (or payments-only when no ZIP data) ───────────── */}
        {(viewMode === 'chart' || isPaymentsMode) && payments && (
          <PaymentsView payments={payments} kind={chartKind} />
        )}

        {/* ── Map view ─────────────────────────────────────────────────── */}
        {viewMode === 'map' && !isPaymentsMode && (
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
              onZipClick={setSelectedZip}
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
                <ActiveStyle
                  data={heatPoints}
                  origin={originEntry}
                  gradientId={heatGradientId}
                  onZipClick={setSelectedZip}
                />
              )}
            </MapContainer>
          )}

          {/* Click-to-inspect popup */}
          <ZipDetailPopup detail={selectedDetail} onClose={() => setSelectedZip(null)} />

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

function ViewToggleBtn({ label, active, disabled, onClick, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        'rounded px-3 py-1 text-xs font-medium transition-colors',
        disabled
          ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
          : active
            ? 'bg-blue-600 text-white'
            : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
