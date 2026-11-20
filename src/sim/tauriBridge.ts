/**
 * Vira City — Desktop Native Bridge (Tauri v2) (`src/sim/tauriBridge.ts`)
 *
 * Provides transparent fallback between native filesystem access (Tauri Desktop App)
 * and rich browser storage (IndexedDB / localStorage).
 */

export interface NativeSaveFile {
  filename: string;
  filepath: string;
  size: number;
  modified: number;
}

export const TauriBridge = {
  isTauri(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(
      (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ ||
      (window as unknown as { __TAURI__?: unknown }).__TAURI__
    );
  },

  async getSavesDir(): Promise<string | null> {
    if (!this.isTauri()) return null;
    try {
      const invoke = (window as any).__TAURI_INTERNALS__?.invoke || (window as any).__TAURI__?.core?.invoke;
      if (invoke) {
        return await invoke('get_saves_dir');
      }
    } catch {
      /* ignore */
    }
    return null;
  },

  async saveFile(filename: string, data: string): Promise<boolean> {
    if (!this.isTauri()) return false;
    try {
      const invoke = (window as any).__TAURI_INTERNALS__?.invoke || (window as any).__TAURI__?.core?.invoke;
      if (invoke) {
        await invoke('save_city_file', { filename, data });
        return true;
      }
    } catch (e) {
      console.warn('[TauriBridge] Native save error:', e);
    }
    return false;
  },

  async loadFile(filename: string): Promise<string | null> {
    if (!this.isTauri()) return null;
    try {
      const invoke = (window as any).__TAURI_INTERNALS__?.invoke || (window as any).__TAURI__?.core?.invoke;
      if (invoke) {
        return await invoke('load_city_file', { filename });
      }
    } catch (e) {
      console.warn('[TauriBridge] Native load error:', e);
    }
    return null;
  },

  async listFiles(): Promise<NativeSaveFile[]> {
    if (!this.isTauri()) return [];
    try {
      const invoke = (window as any).__TAURI_INTERNALS__?.invoke || (window as any).__TAURI__?.core?.invoke;
      if (invoke) {
        return await invoke('list_city_files');
      }
    } catch {
      /* ignore */
    }
    return [];
  },

  async deleteFile(filename: string): Promise<boolean> {
    if (!this.isTauri()) return false;
    try {
      const invoke = (window as any).__TAURI_INTERNALS__?.invoke || (window as any).__TAURI__?.core?.invoke;
      if (invoke) {
        await invoke('delete_city_file', { filename });
        return true;
      }
    } catch {
      /* ignore */
    }
    return false;
  },
};
