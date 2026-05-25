export default function ColumnMapper({ headers, rows, zipIdx, countIdx, confidence, onChange }) {
  const sampleZips = rows
    .slice(0, 5)
    .map(r => r[zipIdx]?.trim())
    .filter(Boolean)
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Columns
        </span>
        {confidence === 'high' && (
          <span className="text-xs font-medium text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded">
            Etsy ✓
          </span>
        )}
      </div>

      <div className="rounded-lg bg-slate-700/60 p-3 flex flex-col gap-2">
        <ColRow
          label="ZIP"
          headers={headers}
          value={zipIdx}
          onChange={zi => onChange(zi, countIdx)}
        />
        <ColRow
          label="Count"
          headers={headers}
          value={countIdx}
          onChange={ci => onChange(zipIdx, ci)}
          optional
        />
      </div>

      {sampleZips.length > 0 && (
        <p className="text-xs text-slate-500 truncate">
          e.g. {sampleZips.join(', ')}
        </p>
      )}
    </div>
  );
}

function ColRow({ label, headers, value, onChange, optional }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 w-10 flex-shrink-0">{label}</span>
      <select
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 min-w-0 bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {optional && <option value={-1}>— none —</option>}
        {headers.map((h, i) => (
          <option key={i} value={i}>{h}</option>
        ))}
      </select>
    </div>
  );
}
