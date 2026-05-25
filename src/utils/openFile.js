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

  const path = await open({
    title: 'Open CSV',
    filters: [{ name: 'CSV files', extensions: ['csv', 'txt'] }],
    multiple: false,
  });

  if (!path || typeof path !== 'string') return null;

  const content = await invoke('read_file', { path });
  const name = path.split(/[/\\]/).pop() ?? 'file.csv';
  return new File([content], name, { type: 'text/csv' });
}
