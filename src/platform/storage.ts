/**
 * Adaptador de almacenamiento agnóstico de plataforma.
 * Permite usar IndexedDB en la web y FileSystem nativo en Desktop (Tauri).
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Implementación de almacenamiento basada en Web Storage / IndexedDB (Web fallback).
 */
export class BrowserStorageAdapter implements StorageAdapter {
  private readonly prefix: string;

  constructor(prefix: string = 'city_builder_') {
    this.prefix = prefix;
  }

  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(this.prefix + key);
  }

  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(this.prefix + key, value);
  }

  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(this.prefix + key);
  }

  async clear(): Promise<void> {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(this.prefix)) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  }
}
