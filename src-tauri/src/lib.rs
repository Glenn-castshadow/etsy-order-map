use tauri::{Emitter, Manager};
use tauri::menu::{Menu, MenuItem, Submenu};

/// Read a file chosen by the user via the native dialog.
/// Uses lossy UTF-8 conversion so files with Windows-1252 / Latin-1 encoded
/// customer names (accented chars, etc.) don't hard-fail — replacement chars
/// appear in those cells but the rest of the CSV parses correctly.
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|e| {
        eprintln!("[ZipMap] read_file IO error: path={path} err={e}");
        e.to_string()
    })?;
    let text = String::from_utf8_lossy(&bytes).into_owned();
    eprintln!("[ZipMap] read_file ok: path={path} bytes={} chars={}", bytes.len(), text.len());
    Ok(text)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // ── Native menu ──────────────────────────────────────────────
            let open_item =
                MenuItem::with_id(app, "open-csv", "Open CSV...", true, Some("CmdOrCtrl+O"))?;
            let quit_item =
                MenuItem::with_id(app, "quit", "Quit", true, Some("CmdOrCtrl+Q"))?;
            let file_menu =
                Submenu::with_items(app, "File", true, &[&open_item, &quit_item])?;

            let devtools_item =
                MenuItem::with_id(app, "devtools", "Developer Tools", true, Some("F12"))?;
            let view_menu =
                Submenu::with_items(app, "View", true, &[&devtools_item])?;

            let menu = Menu::with_items(app, &[&file_menu, &view_menu])?;
            app.set_menu(menu)?;

            // Forward menu events to the frontend as Tauri events
            app.on_menu_event(|app, event| match event.id().as_ref() {
                "open-csv" => {
                    app.emit("menu-open-file", ()).ok();
                }
                "devtools" => {
                    if let Some(win) = app.get_webview_window("main") {
                        win.open_devtools();
                    }
                }
                "quit" => {
                    app.exit(0);
                }
                _ => {}
            });

            // ── Debug logging ─────────────────────────────────────────────
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
