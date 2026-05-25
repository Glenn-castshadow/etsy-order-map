use tauri::Emitter;
use tauri::menu::{Menu, MenuItem, Submenu};

/// Read a file chosen by the user via the native dialog.
/// Called from JS after plugin-dialog returns the selected path.
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
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
            let menu = Menu::with_items(app, &[&file_menu])?;
            app.set_menu(menu)?;

            // Forward menu events to the frontend as Tauri events
            app.on_menu_event(|app, event| match event.id().as_ref() {
                "open-csv" => {
                    app.emit("menu-open-file", ()).ok();
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
