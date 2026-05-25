// Friendly hints shown next to known column names in the fallback
// dropdown (non-Etsy CSVs only).
const METRIC_HINTS = {
  'Number of Items':           'items shipped',
  'Items':                     'items shipped',
  'Quantity':                  'items shipped',
  'Qty':                       'items shipped',
  'Units':                     'units sold',
  'Order Total':               'sale amount',
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

// Column-name patterns for the three Etsy metric options
const ITEMS_RE = /^(number of items|quantity|qty|items|units)$/i;
const NET_RE   = /^(order net|adjusted net order amount|net amount|item total|order total)$/i;

export default function ColumnMapper({ headers, rows, zipIdx, countIdx, confidence, onChange }) {
  const sampleZips = rows
    .slice(0, 5)
    .map(r => r[zipIdx]?.trim())
    .filter(Boolean)
    .slice(0, 3);

  // Resolve the items / net columns from headers, if present
  const itemsIdx = headers.findIndex(h => ITEMS_RE.test((h ?? '').trim()));
  const netIdx   = headers.findIndex(h => NET_RE.test((h ?? '').trim()));

  // Pick the Etsy semantic UI when we recognised the file AND at least one
  // weight-by column is available.  Falls back to the generic dropdown for
  // anything else.
  const useSemantic = confidence === 'high' && (itemsIdx >= 0 || netIdx >= 0);

  const zipLine = (
    <p className="text-xs text-slate-500 truncate">
      ZIP column: <span className="text-slate-400">{headers[zipIdx] ?? '—'}</span>
      {sampleZips.length > 0 && <> · e.g. {sampleZips.join(', ')}</>}
    </p>
  );

  if (useSemantic) {
    return (
      <div className="flex flex-col gap-2">
        {confidence === 'high' && (
          <span className="self-start text-xs font-medium text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded">
            Etsy ✓
          </span>
        )}

        <div className="rounded-lg bg-slate-700/60 p-2 flex flex-col gap-1">
          {itemsIdx >= 0 && (
            <Choice
              label="Items shipped"
              hint={`Sum of ${headers[itemsIdx]}`}
              active={countIdx === itemsIdx}
              onClick={() => onChange(zipIdx, itemsIdx)}
            />
          )}
          {netIdx >= 0 && (
            <Choice
              label="Net sale amount"
              hint={`Sum of ${headers[netIdx]}`}
              active={countIdx === netIdx}
              onClick={() => onChange(zipIdx, netIdx)}
            />
          )}
        </div>

        {zipLine}
      </div>
    );
  }

  // ── Fallback: generic dropdown for unknown CSV shapes ──────────────────
  const currentHint = countIdx >= 0
    ? (METRIC_HINTS[headers[countIdx]] ?? 'sum of this column per ZIP')
    : 'each order counted equally';

  return (
    <div className="flex flex-col gap-2">
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
      {zipLine}
    </div>
  );
}

function Choice({ label, hint, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex items-start gap-2 rounded px-2 py-1.5 text-left transition-colors',
        active
          ? 'bg-blue-600/30 ring-1 ring-blue-500/60'
          : 'hover:bg-slate-700',
      ].join(' ')}
    >
      <span className={[
        'mt-0.5 w-3 h-3 rounded-full border flex-shrink-0',
        active ? 'border-blue-300 bg-blue-400' : 'border-slate-500',
      ].join(' ')} />
      <span className="flex-1 min-w-0">
        <span className={['block text-xs font-medium', active ? 'text-white' : 'text-slate-200'].join(' ')}>
          {label}
        </span>
        <span className="block text-[10px] text-slate-400 truncate">{hint}</span>
      </span>
    </button>
  );
}
