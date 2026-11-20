/**
 * Vira City — Multi-Slot Save & Load Hub Engine (`src/sim/saveSystem.ts`)
 *
 * Implements persistent multi-slot storage (IndexedDB + localStorage fallback + Tauri filesystem),
 * rolling autosaves (autosave_1..3), screenshot thumbnail capture, export/import of .viracity files,
 * drag-and-drop save loading, and save integrity validation.
 */

import { C } from '@/core/constants';
import { Gfx } from '@/render/gfx';
import { Sim } from '@/sim/sim';
import { World } from '@/world/world';
import { TauriBridge } from '@/sim/tauriBridge';
import {
  SaveMeta,
  SaveFileContainer,
  SaveHubConfig,
  SerializedCity,
} from '@/types';

const DB_NAME = 'viracity_save_db';
const DB_VERSION = 1;
const STORE_SAVES = 'saves';
const STORE_META = 'metadata';
const STORE_CONFIG = 'config';

const LOCAL_STORAGE_PREFIX = 'viracity.save.';
const LOCAL_STORAGE_META_KEY = 'viracity.saves.meta';
const LOCAL_STORAGE_CONFIG_KEY = 'viracity.saves.config';

export interface SaveRecord {
  id: string;
  meta: SaveMeta;
  data: SerializedCity;
}

export const SaveSystem = {
  dbPromise: null as Promise<IDBDatabase> | null,
  config: {
    autosaveIntervalMinutes: 5,
    maxAutosaves: 3,
    activeSlot: 'slot_1',
  } as SaveHubConfig,
  autosaveTimer: null as number | null,
  lastAutosaveTimestamp: Date.now(),
  autosaveRotationIndex: 1,

  /**
   * Initializes IndexedDB database and migrates any legacy single save.
   */
  async init(): Promise<void> {
    try {
      await this.getDB();
      await this.loadConfig();
      await this.migrateLegacySave();
    } catch (e) {
      console.warn('[SaveSystem] IndexedDB init failed, using localStorage fallback:', e);
    }
  },

  getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB not supported in this environment'));
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = ev => {
        const db = (ev.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_SAVES)) {
          db.createObjectStore(STORE_SAVES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_CONFIG)) {
          db.createObjectStore(STORE_CONFIG, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    return this.dbPromise;
  },

  /**
   * Migrates legacy single-save 'viracity.save' from localStorage into multi-slot store if needed.
   */
  async migrateLegacySave(): Promise<void> {
    try {
      const legacyRaw = localStorage.getItem(C.SAVE_KEY) || localStorage.getItem(C.LEGACY_SAVE_KEY);
      if (!legacyRaw) return;

      const saves = await this.listSaves();
      if (saves.length > 0) return; // Already has multi-slot saves

      const parsed = JSON.parse(legacyRaw) as SerializedCity;
      if (!parsed || !parsed.name) return;

      const meta: SaveMeta = {
        id: 'slot_1',
        name: parsed.name || 'Migrated City',
        type: 'manual',
        timestamp: Date.now(),
        dateStr: `Month ${parsed.month || 1}, Hour ${Math.floor(parsed.hour || 8)}:00`,
        pop: parsed.stats?.pop || 0,
        money: parsed.money || 100000,
        happy: parsed.stats?.happy || 75,
        milestone: parsed.milestone || 0,
        milestoneName: C.MILESTONES[parsed.milestone || 0]?.name || 'Settlement',
        seed: parsed.seed || 12345,
        map: parsed.map || 'valley',
        version: parsed.v || 1,
      };

      await this.saveRawRecord({ id: 'slot_1', meta, data: parsed });
    } catch (e) {
      console.warn('[SaveSystem] Migration of legacy save skipped:', e);
    }
  },

  /**
   * Lists all saved games sorted by timestamp descending.
   */
  async listSaves(): Promise<SaveMeta[]> {
    // 1. Try Tauri native directory first if on desktop
    if (TauriBridge.isTauri()) {
      const files = await TauriBridge.listFiles();
      if (files.length > 0) {
        const metas: SaveMeta[] = [];
        for (const f of files) {
          const content = await TauriBridge.loadFile(f.filename);
          if (content) {
            try {
              const parsed = JSON.parse(content);
              if (parsed.meta) metas.push(parsed.meta);
            } catch {
              /* ignore parse error */
            }
          }
        }
        if (metas.length > 0) {
          return metas.sort((a, b) => b.timestamp - a.timestamp);
        }
      }
    }

    // 2. Try IndexedDB
    try {
      const db = await this.getDB();
      return await new Promise<SaveMeta[]>((resolve, reject) => {
        const tx = db.transaction(STORE_META, 'readonly');
        const st = tx.objectStore(STORE_META);
        const req = st.getAll();
        req.onsuccess = () => {
          const list = (req.result as SaveMeta[]) || [];
          resolve(list.sort((a, b) => b.timestamp - a.timestamp));
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      // 3. Fallback to localStorage
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_META_KEY);
        if (!raw) return [];
        const list = JSON.parse(raw) as SaveMeta[];
        return list.sort((a, b) => b.timestamp - a.timestamp);
      } catch {
        return [];
      }
    }
  },

  /**
   * Saves the current live simulation city into a slot with a generated thumbnail.
   */
  async saveCity(
    slotId: string,
    slotName?: string,
    type: 'manual' | 'autosave' | 'quicksave' | 'imported' = 'manual'
  ): Promise<SaveMeta> {
    const city = Sim.serialize();
    const screenshot = Gfx.captureScreenshot(320, 180) || undefined;
    const st = Sim.stats;
    const msIdx = Sim.milestone || 0;

    const meta: SaveMeta = {
      id: slotId,
      name: slotName || Sim.name || 'Vira City',
      type,
      timestamp: Date.now(),
      dateStr: Sim.dateStr ? Sim.dateStr() : `Month ${Sim.month}`,
      pop: st.pop || 0,
      money: Math.round(Sim.money || 0),
      happy: Math.round(st.happy || 0),
      milestone: msIdx,
      milestoneName: C.MILESTONES[msIdx]?.name || 'Settlement',
      screenshot,
      seed: World.seed || 12345,
      map: World.map || 'valley',
      version: city.v || 1,
    };

    const record: SaveRecord = { id: slotId, meta, data: city };
    await this.saveRawRecord(record);

    // Keep primary localStorage updated for legacy compatibility
    try {
      localStorage.setItem(C.SAVE_KEY, JSON.stringify(city));
    } catch {
      /* ignore quota errors */
    }

    return meta;
  },

  /**
   * Internal worker to write a record to IndexedDB, Tauri, and localStorage.
   */
  async saveRawRecord(record: SaveRecord): Promise<void> {
    // 1. Native Tauri filesystem
    if (TauriBridge.isTauri()) {
      const container: SaveFileContainer = {
        format: 'viracity',
        version: 1,
        exportedAt: Date.now(),
        meta: record.meta,
        city: record.data,
      };
      await TauriBridge.saveFile(`${record.id}.viracity`, JSON.stringify(container));
    }

    // 2. IndexedDB
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_SAVES, STORE_META], 'readwrite');
        tx.objectStore(STORE_SAVES).put(record);
        tx.objectStore(STORE_META).put(record.meta);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      return;
    } catch (e) {
      console.warn('[SaveSystem] IndexedDB put failed, falling back to localStorage:', e);
    }

    // 3. Fallback localStorage
    try {
      // Save record data without heavy screenshot in localStorage to avoid QuotaExceededError
      const lightRecord = {
        ...record,
        meta: { ...record.meta, screenshot: undefined },
      };
      localStorage.setItem(LOCAL_STORAGE_PREFIX + record.id, JSON.stringify(lightRecord.data));

      const metas = (await this.listSaves()).filter(m => m.id !== record.id);
      metas.push(lightRecord.meta);
      localStorage.setItem(LOCAL_STORAGE_META_KEY, JSON.stringify(metas));
    } catch (err) {
      throw new Error('Almacenamiento de navegador bloqueado o sin espacio suficiente.');
    }
  },

  /**
   * Loads a city by slot ID.
   */
  async loadCityData(slotId: string): Promise<SerializedCity | null> {
    // 1. Native Tauri filesystem
    if (TauriBridge.isTauri()) {
      const content = await TauriBridge.loadFile(`${slotId}.viracity`);
      if (content) {
        try {
          const parsed = JSON.parse(content);
          return (parsed.city || parsed) as SerializedCity;
        } catch {
          /* fallback */
        }
      }
    }

    // 2. IndexedDB
    try {
      const db = await this.getDB();
      return await new Promise<SerializedCity | null>((resolve, reject) => {
        const tx = db.transaction(STORE_SAVES, 'readonly');
        const st = tx.objectStore(STORE_SAVES);
        const req = st.get(slotId);
        req.onsuccess = () => {
          const res = req.result as SaveRecord | undefined;
          resolve(res ? res.data : null);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      // 3. Fallback localStorage
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_PREFIX + slotId);
        if (raw) return JSON.parse(raw) as SerializedCity;
        if (slotId === 'slot_1') {
          const legacy = localStorage.getItem(C.SAVE_KEY);
          if (legacy) return JSON.parse(legacy) as SerializedCity;
        }
        return null;
      } catch {
        return null;
      }
    }
  },

  /**
   * Deletes a save slot permanently.
   */
  async deleteSlot(slotId: string): Promise<boolean> {
    if (TauriBridge.isTauri()) {
      await TauriBridge.deleteFile(`${slotId}.viracity`);
    }

    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([STORE_SAVES, STORE_META], 'readwrite');
        tx.objectStore(STORE_SAVES).delete(slotId);
        tx.objectStore(STORE_META).delete(slotId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      localStorage.removeItem(LOCAL_STORAGE_PREFIX + slotId);
      const metas = (await this.listSaves()).filter(m => m.id !== slotId);
      localStorage.setItem(LOCAL_STORAGE_META_KEY, JSON.stringify(metas));
    }
    return true;
  },

  /**
   * Renames a save slot.
   */
  async renameSlot(slotId: string, newName: string): Promise<boolean> {
    const data = await this.loadCityData(slotId);
    if (!data) return false;
    const saves = await this.listSaves();
    const target = saves.find(s => s.id === slotId);
    if (!target) return false;

    target.name = newName;
    data.name = newName;
    await this.saveRawRecord({ id: slotId, meta: target, data });
    return true;
  },

  /**
   * Triggers a rolling autosave (autosave_1 -> autosave_2 -> autosave_3).
   */
  async triggerRollingAutosave(): Promise<SaveMeta | null> {
    const max = Math.max(1, Math.min(5, this.config.maxAutosaves || 3));
    const slotNum = this.autosaveRotationIndex;
    const slotId = `autosave_${slotNum}`;

    this.autosaveRotationIndex = (slotNum % max) + 1;
    this.lastAutosaveTimestamp = Date.now();

    try {
      const meta = await this.saveCity(slotId, `${Sim.name} (Autosave ${slotNum})`, 'autosave');
      return meta;
    } catch (e) {
      console.warn('[SaveSystem] Rolling autosave failed:', e);
      return null;
    }
  },

  /**
   * Quick Save (F5 or Ctrl+S).
   */
  async quickSave(): Promise<SaveMeta> {
    return await this.saveCity('quicksave', `${Sim.name} (Quick Save)`, 'quicksave');
  },

  /**
   * Quick Load (F9).
   */
  async quickLoad(): Promise<SerializedCity | null> {
    return await this.loadCityData('quicksave');
  },

  /**
   * Exports a save slot to a downloadable .viracity file.
   */
  async exportToFile(slotId: string): Promise<boolean> {
    const data = await this.loadCityData(slotId);
    if (!data) return false;

    const saves = await this.listSaves();
    const meta = saves.find(s => s.id === slotId) || {
      id: slotId,
      name: data.name,
      type: 'manual',
      timestamp: Date.now(),
      dateStr: `Month ${data.month}`,
      pop: data.stats?.pop || 0,
      money: data.money || 0,
      happy: data.stats?.happy || 0,
      milestone: data.milestone || 0,
      milestoneName: C.MILESTONES[data.milestone || 0]?.name || 'City',
      seed: data.seed,
      map: data.map,
      version: data.v || 1,
    };

    const container: SaveFileContainer = {
      format: 'viracity',
      version: 1,
      exportedAt: Date.now(),
      meta,
      city: data,
    };

    const blob = new Blob([JSON.stringify(container, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const safeName = (data.name || 'city').replace(/[^a-z0-9_-]/gi, '_');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}_${slotId}_${Date.now()}.viracity`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  },

  /**
   * Imports a .viracity or .json file and saves it into the storage hub.
   */
  async importFromFile(file: File): Promise<{ success: boolean; meta?: SaveMeta; error?: string }> {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      let cityData: SerializedCity;
      let slotMeta: SaveMeta;

      if (parsed.format === 'viracity' && parsed.city) {
        cityData = parsed.city;
        const baseMeta = parsed.meta || {};
        slotMeta = {
          id: `imported_${Date.now()}`,
          name: baseMeta.name || cityData.name || 'Imported City',
          type: 'imported',
          timestamp: Date.now(),
          dateStr: baseMeta.dateStr || `Month ${cityData.month || 1}`,
          pop: cityData.stats?.pop || baseMeta.pop || 0,
          money: cityData.money || baseMeta.money || 0,
          happy: cityData.stats?.happy || baseMeta.happy || 0,
          milestone: cityData.milestone || 0,
          milestoneName: C.MILESTONES[cityData.milestone || 0]?.name || 'City',
          seed: cityData.seed || 12345,
          map: cityData.map || 'valley',
          version: cityData.v || 1,
          screenshot: baseMeta.screenshot,
        };
      } else if (parsed.name && parsed.road && parsed.buildings) {
        // Raw SerializedCity format
        cityData = parsed as SerializedCity;
        slotMeta = {
          id: `imported_${Date.now()}`,
          name: cityData.name || file.name.replace(/\.(viracity|json)$/i, ''),
          type: 'imported',
          timestamp: Date.now(),
          dateStr: `Month ${cityData.month || 1}`,
          pop: cityData.stats?.pop || 0,
          money: cityData.money || 0,
          happy: cityData.stats?.happy || 0,
          milestone: cityData.milestone || 0,
          milestoneName: C.MILESTONES[cityData.milestone || 0]?.name || 'City',
          seed: cityData.seed || 12345,
          map: cityData.map || 'valley',
          version: cityData.v || 1,
        };
      } else {
        return {
          success: false,
          error: 'Invalid file format. Must be a valid Vira City .viracity or .json save file.',
        };
      }

      // Validate core payload integrity
      if (!cityData.road || !Array.isArray(cityData.buildings)) {
        return {
          success: false,
          error: 'Save file is incomplete or corrupted (missing road or building data layers).',
        };
      }

      await this.saveRawRecord({ id: slotMeta.id, meta: slotMeta, data: cityData });
      return { success: true, meta: slotMeta };
    } catch (e: any) {
      return {
        success: false,
        error: 'Could not read file: ' + (e?.message || 'JSON parse error'),
      };
    }
  },

  /**
   * Loads hub config (autosave interval, etc.).
   */
  async loadConfig(): Promise<SaveHubConfig> {
    try {
      const db = await this.getDB();
      const cfg = await new Promise<any>((resolve, reject) => {
        const tx = db.transaction(STORE_CONFIG, 'readonly');
        const req = tx.objectStore(STORE_CONFIG).get('hub_config');
        req.onsuccess = () => resolve(req.result ? req.result.val : null);
        req.onerror = () => reject(req.error);
      });
      if (cfg) this.config = { ...this.config, ...cfg };
    } catch {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
        if (raw) this.config = { ...this.config, ...JSON.parse(raw) };
      } catch {
        /* ignore */
      }
    }
    return this.config;
  },

  /**
   * Saves hub config.
   */
  async saveConfig(cfg: Partial<SaveHubConfig>): Promise<void> {
    this.config = { ...this.config, ...cfg };
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_CONFIG, 'readwrite');
        tx.objectStore(STORE_CONFIG).put({ key: 'hub_config', val: this.config });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      try {
        localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(this.config));
      } catch {
        /* ignore */
      }
    }
  },

  /**
   * Binds global drag and drop events on the window for seamless file loading.
   */
  initDragAndDrop(onFileImported: (city: SerializedCity, meta: SaveMeta) => void): void {
    if (typeof window === 'undefined') return;

    let dragOverlay: HTMLElement | null = null;

    const createOverlay = () => {
      if (dragOverlay) return;
      dragOverlay = document.createElement('div');
      dragOverlay.id = 'dragDropOverlay';
      dragOverlay.style.cssText = `
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(10, 15, 25, 0.88);
        backdrop-filter: blur(8px);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        color: #fff; pointer-events: none; border: 4px dashed #38bdf8;
      `;
      dragOverlay.innerHTML = `
        <div style="font-size: 54px; margin-bottom: 16px;">💾</div>
        <h2 style="font-size: 24px; font-weight: 700; margin: 0 0 8px;">Load City Save</h2>
        <p style="color: #94a3b8; font-size: 15px; margin: 0;">Drop your .viracity or .json file here to load your city</p>
      `;
      document.body.appendChild(dragOverlay);
    };

    const removeOverlay = () => {
      if (dragOverlay) {
        dragOverlay.remove();
        dragOverlay = null;
      }
    };

    window.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      createOverlay();
    });

    window.addEventListener('dragleave', e => {
      e.preventDefault();
      e.stopPropagation();
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        removeOverlay();
      }
    });

    window.addEventListener('drop', async e => {
      e.preventDefault();
      e.stopPropagation();
      removeOverlay();

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      if (!file.name.endsWith('.viracity') && !file.name.endsWith('.json')) {
        alert('Please drop a valid file with .viracity or .json extension.');
        return;
      }

      const res = await SaveSystem.importFromFile(file);
      if (res.success && res.meta) {
        const cityData = await SaveSystem.loadCityData(res.meta.id);
        if (cityData) {
          onFileImported(cityData, res.meta);
        }
      } else {
        alert('Failed to import save file: ' + (res.error || 'Incompatible format'));
      }
    });
  },
};
