// Friendly hints shown next to known column names in the "Weight by"
// dropdown so users can tell at a glance what each option measures.
const METRIC_HINTS = {
  'Number of Items':           'items shipped',
  'Items':                     'items shipped',
  'Quantity':                  'sales quantity',
  'Qty':                       'sales quantity',
  'Units':                     'units sold',
  'Order Total':               'net sale amount',
  'Order Net':                 'net sale amount',
  'Order Value':               'sale amount',
  'Adjusted Net Order Amount': 'net sale amount',
  'Item Total':                'item sale amount',
  'Price':                     'item price',
  'Gross Amount':              'gross revenue',
  'Net Amount':                'net revenue',
  'Total':                     'total amount',
};

function describeHeader(h) {
  const hint = METRIC_HINTS[h];
  return hint ? `${h} — ${hint}` : h;
}

export default function ColumnMapper({ headers, rows, zipIdx, countIdx, confidence, onChange }) {
  const sampleZips = rows
    .slice(0, 5)
    .map(r => r[zipIdx]?.trim())
    .filter(Boolean)
    .slice(0, 3);

  // Description for the currently-selected weight column
  const currentHint = countIdx >= 0
    ? (METRIC_HINTS[headers[countIdx]] ?? 'sum of this column per ZIP')
    : 'each order counted equally';

  return (
    <div className="flex flex-col gap-2">
      {confidence === 'high' && (
        <span className="self-start text-xs font-medium text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded">
          Etsy ✓
        </span>
      )}

      {/* ZIP column is auto-detected from headers — no user choice needed.
          Only the metric column is selectable. */}
      <div className="rounded-lg bg-slate-700/60 p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-16 flex-shrink-0">Weight by</span>
          <select
            value={countIdx}
            onChange={e => onChange(zipIdx, Number(e.target.value))}
            className="flex-1 min-w-0 bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value={-1}>— Order count —</option>
            {headers.map((h, i) => (
              <option key={i} value={i}>{describeHeader(h)}</option>
            ))}
          </select>
        </div>
        <p className="text-[11px] text-slate-500 leading-snug">{currentHint}</p>
      </div>

      <p className="text-xs text-slate-500 truncate">
        ZIP column: <span className="text-slate-400">{headers[zipIdx] ?? '—'}</span>
        {sampleZips.length > 0 && (
          <> · e.g. {sampleZips.join(', ')}</>
        )}
      </p>
    </div>
  );
}
