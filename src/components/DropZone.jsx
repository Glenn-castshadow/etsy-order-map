import { useRef, useState, useEffect } from 'react';
import { isInTauri, openNativeCsv } from '../utils/openFile.js';

/**
 * Drop / pick zone for CSV files.
 *
 * `onFile(file)` is called once per file — drop several at once and it
 * fires per-file.  `hasFiles` toggles the prompt text between "Drop a CSV"
 * and "Add another CSV" so the user knows they're appending, not replacing.
 */
export default function DropZone({ onFile, hasFiles = false, error }) {
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
    onFile(Array.from(e.dataTransfer.files));
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={e => e.key === 'Enter' && handleOpen()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={[
          'rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors select-none',
          dragging
            ? 'border-blue-400 bg-blue-950/40'
            : 'border-slate-600 hover:border-slate-400',
        ].join(' ')}
      >
        <p className="text-sm font-medium text-slate-300">
          {hasFiles ? '+ Add another CSV' : 'Drop a CSV here'}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {hasFiles ? 'one or more files' : 'or click to browse'}
        </p>
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
          multiple
          className="hidden"
          onChange={e => {
            onFile(Array.from(e.target.files));
            e.target.value = ''; // reset so the same file can be re-selected
          }}
        />
      )}

      {error && (
        <p className="text-xs text-red-400 rounded bg-red-950/40 px-2 py-1">{error}</p>
      )}
    </div>
  );
}
