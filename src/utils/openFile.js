// True when running inside the Tauri desktop wrapper
export const isInTauri = () =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/**
 * Open a native OS file picker and return the chosen CSV as a File object.
 * Returns null if the user cancels or if not running in Tauri.
 */
export async function openNativeCsv() {
  if (!isInTauri()) return null;

  const { open } = await import('@tauri-apps/plugin-dialog');
  const { invoke } = await import('@tauri-apps/api/core');

  let path;
  try {
    path = await open({
      title: 'Open CSV',
      filters: [{ name: 'CSV files', extensions: ['csv', 'txt'] }],
      multiple: false,
    });
  } catch (e) {
    console.error('[ZipMap] file dialog failed', e);
    throw new Error(`File dialog error: ${e?.message ?? e}`);
  }

  if (!path || typeof path !== 'string') return null;

  let content;
  try {
    content = await invoke('read_file', { path });
  } catch (e) {
    console.error('[ZipMap] read_file invoke failed', { path, error: e });
    throw new Error(`Could not read file: ${e?.message ?? e}`);
  }

  if (typeof content !== 'string') {
    const msg = `read_file returned ${typeof content} (${content?.constructor?.name}) instead of string`;
    console.error('[ZipMap] read_file type mismatch', { path, type: typeof content });
    throw new Error(msg);
  }

  const name = path.split(/[/\\]/).pop() ?? 'file.csv';
  return new File([content], name, { type: 'text/csv' });
}
