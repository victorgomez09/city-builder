// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize)]
pub struct NativeSaveFile {
    pub filename: String,
    pub filepath: String,
    pub size: u64,
    pub modified: u64,
}

fn resolve_saves_directory() -> PathBuf {
    let mut dir = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
    dir.push("viracity");
    dir.push("saves");
    let _ = fs::create_dir_all(&dir);
    dir
}

#[tauri::command]
fn get_saves_dir() -> String {
    resolve_saves_directory().to_string_lossy().to_string()
}

#[tauri::command]
fn save_city_file(filename: String, data: String) -> Result<(), String> {
    let mut path = resolve_saves_directory();
    path.push(filename);
    fs::write(path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_city_file(filename: String) -> Result<String, String> {
    let mut path = resolve_saves_directory();
    path.push(filename);
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_city_files() -> Result<Vec<NativeSaveFile>, String> {
    let dir = resolve_saves_directory();
    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
    let mut result = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("viracity") {
            if let Ok(meta) = entry.metadata() {
                let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                let filepath = path.to_string_lossy().to_string();
                let modified = meta
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);

                result.push(NativeSaveFile {
                    filename,
                    filepath,
                    size: meta.len(),
                    modified,
                });
            }
        }
    }

    Ok(result)
}

#[tauri::command]
fn delete_city_file(filename: String) -> Result<(), String> {
    let mut path = resolve_saves_directory();
    path.push(filename);
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_saves_dir,
            save_city_file,
            load_city_file,
            list_city_files,
            delete_city_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Vira City desktop application");
}
