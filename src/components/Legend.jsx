export default function Legend({ matched, unmatched, total }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        Summary
      </span>
      <div className="rounded-lg bg-slate-700/60 p-3 flex flex-col gap-1.5 text-sm">
        <Row label="ZIP codes matched" value={matched.toLocaleString()} />
        {unmatched > 0 && (
          <Row label="Unrecognized ZIPs" value={unmatched.toLocaleString()} dim />
        )}
        <Row label="Total count" value={total.toLocaleString()} />
      </div>

      {/* Gradient bar */}
      <div className="flex flex-col gap-1">
        <div
          className="h-2.5 w-full rounded"
          style={{
            background:
              'linear-gradient(to right, #0000ff, #00ffff, #ffff00, #ff0000)',
          }}
        />
        <div className="flex justify-between text-xs text-slate-500">
          <span>Low</span>
          <span>High</span>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, dim }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={dim ? 'text-slate-500' : 'text-slate-300'}>{label}</span>
      <span className={`font-mono tabular-nums ${dim ? 'text-slate-500' : 'text-slate-100'}`}>
        {value}
      </span>
    </div>
  );
}
