/**
 * Compact list of imported CSVs.  Each row shows the file name, its row
 * count, and an × button to remove it from the pool.  Hidden when the
 * pool is empty.
 */
export default function FileList({ files, onRemove }) {
  if (!files.length) return null;
  return (
    <div className="flex flex-col gap-1">
      {files.map(f => (
        <div
          key={f.id}
          className="group flex items-center gap-2 bg-slate-700/40 hover:bg-slate-700/70 rounded px-2 py-1.5 text-xs transition-colors"
        >
          <span className="flex-1 truncate text-slate-200" title={f.name}>
            {f.name}
          </span>
          <span className="text-[10px] text-slate-500 flex-shrink-0 tabular-nums">
            {f.rows.length.toLocaleString()} rows
          </span>
          <button
            onClick={() => onRemove(f.id)}
            className="text-slate-500 hover:text-red-400 transition-colors flex-shrink-0 text-base leading-none w-4 h-4 flex items-center justify-center"
            title="Remove file"
            aria-label={`Remove ${f.name}`}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
