export default function DateRangeFilter({ min, max, from, to, onChange }) {
  const isFiltered = from || to;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Date Range
        </span>
        {isFiltered && (
          <button
            onClick={() => onChange('', '')}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Reset
          </button>
        )}
      </div>
      <div className="rounded-lg bg-slate-700/60 p-3 flex flex-col gap-2">
        <DateRow
          label="From"
          value={from}
          min={min}
          max={to || max}
          onChange={v => onChange(v, to)}
        />
        <DateRow
          label="To"
          value={to}
          min={from || min}
          max={max}
          onChange={v => onChange(from, v)}
        />
      </div>
      <p className="text-xs text-slate-500">
        Data spans {min} — {max}
      </p>
    </div>
  );
}

function DateRow({ label, value, min, max, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 w-8 flex-shrink-0">{label}</span>
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={e => onChange(e.target.value)}
        className="flex-1 bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 [color-scheme:dark]"
      />
    </div>
  );
}
