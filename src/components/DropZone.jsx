import { useRef, useState, useEffect } from 'react';
import { isInTauri, openNativeCsv } from '../utils/openFile.js';

export default function DropZone({ onFile, fileName, error }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  // Listen for File → Open CSV menu event (Tauri only)
  useEffect(() => {
    if (!isInTauri()) return;
    let unlisten;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen('menu-open-file', () => handleOpen()).then(fn => { unlisten = fn; });
    });
    return () => { unlisten?.(); };
  }, []);

  async function handleOpen() {
    if (isInTauri()) {
      const file = await openNativeCsv();
      if (file) onFile(file);
    } else {
      inputRef.current?.click();
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
        Import CSV
      </span>
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={e => e.key === 'Enter' && handleOpen()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={[
          'rounded-lg border-2 border-dashed p-5 text-center cursor-pointer transition-colors select-none',
          dragging
            ? 'border-blue-400 bg-blue-950/40'
            : 'border-slate-600 hover:border-slate-400',
        ].join(' ')}
      >
        {fileName ? (
          <>
            <p className="text-sm font-medium text-slate-200 truncate">{fileName}</p>
            <p className="text-xs text-slate-500 mt-1">Click or drop to replace</p>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-400">Drop a CSV here</p>
            <p className="text-xs text-slate-500 mt-1">or click to browse</p>
          </>
        )}
      </div>
      <p className="text-xs text-slate-500">
        Accepts <code className="text-slate-400">zip</code> or{' '}
        <code className="text-slate-400">zip, count</code> columns
      </p>

      {/* Browser fallback only — hidden in Tauri */}
      {!isInTauri() && (
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); }}
        />
      )}

      {error && (
        <p className="text-xs text-red-400 rounded bg-red-950/40 px-2 py-1">{error}</p>
      )}
    </div>
  );
}
