/**
 * Vira City — Save & Load Hub Panel / Modal (`src/ui/panels/saveHub.ts`)
 *
 * Provides a high-fidelity visual multi-slot game manager with screenshot previews,
 * rolling autosave configuration, manual saves, slot renaming/deletion,
 * and direct .viracity file export & import.
 */

import { U } from '@/core/utils';
import { Game } from '@/game';
import { SaveSystem } from '@/sim/saveSystem';
import { SaveMeta, SerializedCity } from '@/types';
import { q, $$ } from '@/ui/dom';
import { UI } from '@/ui/ui';
import { t } from '@/i18n';

let currentFilter: 'all' | 'manual' | 'autosave' | 'quicksave' | 'imported' = 'all';

export async function renderSaveHubModal(onLoadCity?: (city: SerializedCity, meta: SaveMeta) => void): Promise<void> {
  let modal = q<HTMLElement>('#saveHubModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'saveHubModal';
    modal.className = 'modal';
    modal.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: radial-gradient(circle at 50% 25%, rgba(15, 23, 42, 0.92), rgba(5, 10, 20, 0.97));
      backdrop-filter: blur(16px);
      display: flex; align-items: center; justify-content: center;
      padding: 24px; box-sizing: border-box;
    `;
    modal.addEventListener('click', e => {
      if (e.target === modal) closeSaveHubModal();
    });
    document.body.appendChild(modal);
  }

  modal.hidden = false;
  await updateSaveHubContent(modal, onLoadCity);
}

export function closeSaveHubModal(): void {
  const modal = q<HTMLElement>('#saveHubModal');
  if (modal) modal.hidden = true;
}

export async function updateSaveHubContent(
  container: HTMLElement,
  onLoadCity?: (city: SerializedCity, meta: SaveMeta) => void
): Promise<void> {
  const saves = await SaveSystem.listSaves();
  const cfg = SaveSystem.config;

  const filtered = saves.filter(s => {
    if (currentFilter === 'all') return true;
    if (currentFilter === 'manual') return s.type === 'manual';
    if (currentFilter === 'autosave') return s.type === 'autosave';
    if (currentFilter === 'quicksave') return s.type === 'quicksave';
    if (currentFilter === 'imported') return s.type === 'imported';
    return true;
  });

  const timeAgo = (ts: number): string => {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return 'Just now';
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    const d = new Date(ts);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const TYPE_BADGES: Record<string, { label: string; color: string; bg: string; border: string }> = {
    manual: { label: 'Manual', color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.16)', border: 'rgba(56, 189, 248, 0.3)' },
    autosave: { label: 'Autosave', color: '#34d399', bg: 'rgba(52, 211, 153, 0.16)', border: 'rgba(52, 211, 153, 0.3)' },
    quicksave: { label: 'Quick Save', color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.16)', border: 'rgba(251, 191, 36, 0.3)' },
    imported: { label: 'Imported', color: '#c084fc', bg: 'rgba(192, 132, 252, 0.16)', border: 'rgba(192, 132, 252, 0.3)' },
  };

  let html = `
    <style>
      #saveHubModal * { box-sizing: border-box; }
      .sh-hub-window {
        width: 100%; max-width: 950px; max-height: 88vh;
        display: flex; flex-direction: column; overflow: hidden;
        border-radius: 18px; border: 1px solid rgba(255, 255, 255, 0.12);
        background: #0f172a;
        box-shadow: 0 30px 90px rgba(0, 0, 0, 0.8), 0 0 50px rgba(56, 189, 248, 0.08);
        font-family: inherit; color: #f8fafc;
      }
      .sh-header {
        padding: 18px 26px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        display: flex; justify-content: space-between; align-items: center;
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.04) 0%, transparent 100%);
      }
      .sh-toolbar {
        padding: 12px 26px; background: rgba(0, 0, 0, 0.28);
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px;
      }
      .sh-tabs-bar {
        padding: 10px 26px 0; display: flex; gap: 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        background: rgba(15, 23, 42, 0.5);
      }
      .sh-tab-pill {
        border-radius: 8px 8px 0 0; padding: 8px 16px; font-size: 13px; font-weight: 500;
        background: transparent; color: #94a3b8; border: 1px solid transparent; border-bottom: none;
        cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 6px;
      }
      .sh-tab-pill:hover {
        color: #e2e8f0; background: rgba(255, 255, 255, 0.03);
      }
      .sh-tab-pill.active {
        background: rgba(56, 189, 248, 0.12); color: #38bdf8;
        border: 1px solid rgba(56, 189, 248, 0.28); border-bottom: 2px solid #38bdf8;
      }
      .sh-scroll-list {
        flex: 1; overflow-y: auto; padding: 20px 26px;
        display: flex; flex-direction: column; gap: 12px;
      }
      .sh-slot-item {
        display: flex; gap: 20px; align-items: center; padding: 14px 18px;
        border-radius: 14px; border: 1px solid rgba(255, 255, 255, 0.08);
        background: linear-gradient(135deg, rgba(30, 41, 59, 0.55) 0%, rgba(15, 23, 42, 0.75) 100%);
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .sh-slot-item:hover {
        border-color: rgba(56, 189, 248, 0.35);
        background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(15, 23, 42, 0.95) 100%);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35), 0 0 16px rgba(56, 189, 248, 0.06);
        transform: translateY(-1px);
      }
      .sh-thumb-box {
        width: 176px; height: 100px; flex-shrink: 0; border-radius: 9px; overflow: hidden;
        position: relative; background: #0b1120; border: 1px solid rgba(255, 255, 255, 0.1);
        display: flex; align-items: center; justify-content: center;
      }
      .sh-thumb-box img {
        width: 100%; height: 100%; object-fit: cover; display: block;
      }
      .sh-badge-tag {
        position: absolute; top: 7px; left: 7px; font-size: 10px; font-weight: 700;
        letter-spacing: 0.03em; text-transform: uppercase; padding: 2px 8px; border-radius: 5px;
        backdrop-filter: blur(8px);
      }
      .sh-info-col {
        flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 7px;
      }
      .sh-title-row {
        display: flex; align-items: center; gap: 10px;
      }
      .sh-city-name {
        font-size: 17.5px; font-weight: 700; color: #fff; margin: 0;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: -0.01em;
      }
      .sh-time-tag {
        font-size: 11.5px; color: #94a3b8; display: inline-flex; align-items: center; gap: 4px;
        background: rgba(255, 255, 255, 0.05); padding: 2px 8px; border-radius: 5px; flex-shrink: 0;
      }
      .sh-chips-wrap {
        display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
      }
      .sh-stat-chip {
        display: inline-flex; align-items: center; gap: 5px; font-size: 12px;
        background: rgba(255, 255, 255, 0.04); padding: 3px 9px; border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.06); color: #cbd5e1;
      }
      .sh-stat-chip b {
        color: #fff; font-weight: 600;
      }
      .sh-meta-details {
        display: flex; flex-wrap: wrap; gap: 14px; font-size: 11.5px; color: #64748b;
      }
      .sh-actions-col {
        display: flex; flex-direction: column; gap: 6px; width: 180px; flex-shrink: 0;
      }
      .sh-btn-primary-load {
        width: 100%; height: 38px; border-radius: 8px; border: none; cursor: pointer;
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: #fff; font-weight: 700; font-size: 13px;
        display: flex; align-items: center; justify-content: center; gap: 6px;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        transition: all 0.15s;
      }
      .sh-btn-primary-load:hover {
        background: linear-gradient(135deg, #34d399 0%, #059669 100%);
        box-shadow: 0 6px 16px rgba(16, 185, 129, 0.45);
        transform: translateY(-1px);
      }
      .sh-btn-grid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 5px; width: 100%;
      }
      .sh-btn-action {
        height: 29px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.06); color: #cbd5e1; font-size: 11.5px; font-weight: 600;
        cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 4px;
        padding: 0 6px; transition: all 0.15s;
      }
      .sh-btn-action:hover {
        background: rgba(255, 255, 255, 0.13); color: #fff; border-color: rgba(255, 255, 255, 0.22);
      }
      .sh-btn-action.danger:hover {
        background: rgba(239, 68, 68, 0.22); color: #fca5a5; border-color: rgba(239, 68, 68, 0.4);
      }
    </style>

    <div class="sh-hub-window">
      <!-- Titlebar -->
      <div class="sh-header">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="
            width: 44px; height: 44px; border-radius: 12px;
            background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(37, 99, 235, 0.2));
            border: 1px solid rgba(56, 189, 248, 0.3);
            display: flex; align-items: center; justify-content: center; font-size: 22px;
            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.2);
          ">💾</div>
          <div>
            <h2 style="margin: 0; font-size: 21px; font-weight: 700; color: #fff; letter-spacing: -0.02em;">
              ${t('save_hub.title', 'Save & Load Hub')}
            </h2>
            <div style="font-size: 13px; color: #94a3b8; margin-top: 2px;">
              ${t('save_hub.subtitle', 'Manage multi-slot saves, rolling autosaves, and .viracity file backups')}
            </div>
          </div>
        </div>
        <button id="btnHubClose" class="sh-btn-action" style="
          width: 36px; height: 36px; padding: 0; border-radius: 50%; font-size: 15px;
        " title="${t('common.close', 'Close')} (Esc)">✕</button>
      </div>

      <!-- Action & Config Bar -->
      <div class="sh-toolbar">
        <div style="display: flex; gap: 10px; align-items: center;">
          ${
            Game.running
              ? `<button id="btnNewSaveSlot" class="sh-btn-primary-load" style="
                  background: linear-gradient(135deg, #2563eb 0%, #0284c7 100%);
                  padding: 0 16px; width: auto; height: 36px; font-size: 12.5px;
                  box-shadow: 0 4px 14px rgba(37,99,235,0.3);
                "><span>+</span> ${t('save_hub.create_slot', 'Save Current City')}</button>`
              : ''
          }
          <button id="btnImportViracity" class="sh-btn-action" style="
            height: 36px; padding: 0 14px; font-size: 12.5px;
          "><span>📥</span> ${t('save_hub.import_file', 'Import .viracity')}</button>
          <input type="file" id="fileViracityInput" accept=".viracity,.json" style="display:none;" />
        </div>

        <div style="
          display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: #94a3b8;
          background: rgba(255, 255, 255, 0.03); padding: 5px 12px; border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.06);
        ">
          <label for="hubAutosaveInterval" style="font-weight: 500;">${t('save_hub.autosave_freq', 'Autosave Frequency:')}</label>
          <select id="hubAutosaveInterval" style="
            padding: 4px 10px; border-radius: 6px; font-size: 12px;
            background: #1e293b; color: #f8fafc; border: 1px solid rgba(255, 255, 255, 0.14);
            outline: none; cursor: pointer;
          ">
            <option value="5" ${cfg.autosaveIntervalMinutes === 5 ? 'selected' : ''}>Every 5 minutes</option>
            <option value="10" ${cfg.autosaveIntervalMinutes === 10 ? 'selected' : ''}>Every 10 minutes</option>
            <option value="15" ${cfg.autosaveIntervalMinutes === 15 ? 'selected' : ''}>Every 15 minutes</option>
            <option value="0" ${cfg.autosaveIntervalMinutes === 0 ? 'selected' : ''}>${t('save_hub.autosave_off', 'Disabled')}</option>
          </select>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="sh-tabs-bar">
        ${[
          ['all', 'All Saves', saves.length],
          ['manual', 'Manual', saves.filter(s => s.type === 'manual').length],
          ['autosave', 'Autosaves', saves.filter(s => s.type === 'autosave').length],
          ['quicksave', 'Quick Saves', saves.filter(s => s.type === 'quicksave').length],
          ['imported', 'Imported', saves.filter(s => s.type === 'imported').length],
        ]
          .map(([k, label, count]) => {
            const isActive = currentFilter === k;
            return `
              <button class="sh-tab-pill ${isActive ? 'active' : ''}" data-filter="${k}">
                ${label} <span style="opacity: ${isActive ? '0.9' : '0.5'}; font-size: 11px; margin-left: 2px;">(${count})</span>
              </button>
            `;
          })
          .join('')}
      </div>

      <!-- Save Slots List -->
      <div class="sh-scroll-list">
  `;

  if (filtered.length === 0) {
    html += `
      <div style="
        text-align: center; padding: 56px 20px; color: #94a3b8;
        background: rgba(255, 255, 255, 0.02); border-radius: 14px;
        border: 1px dashed rgba(255, 255, 255, 0.1);
      ">
        <div style="font-size: 46px; margin-bottom: 14px; opacity: 0.6;">🏙️</div>
        <b style="font-size: 16px; color: #fff; display: block; margin-bottom: 6px;">
          ${t('save_hub.no_saves', 'No saved cities found in this category')}
        </b>
        <p style="font-size: 13.5px; margin: 0; color: #64748b;">
          ${t('save_hub.no_saves_sub', 'Save your current city progress or drop a .viracity file anywhere to get started.')}
        </p>
      </div>
    `;
  } else {
    for (const s of filtered) {
      const badge = TYPE_BADGES[s.type] || TYPE_BADGES.manual;
      html += `
        <div class="sh-slot-item">
          <!-- 16:9 Thumbnail -->
          <div class="sh-thumb-box">
            ${
              s.screenshot
                ? `<img src="${s.screenshot}" alt="${s.name}" />`
                : `<div style="text-align: center; color: #64748b; font-size: 11px;">
                    <span style="font-size: 28px; display: block; margin-bottom: 3px; opacity: 0.5;">🏙️</span>
                    ${s.name}
                   </div>`
            }
            <span class="sh-badge-tag" style="background: ${badge.bg}; color: ${badge.color}; border: 1px solid ${badge.border};">
              ${badge.label}
            </span>
          </div>

          <!-- City Info & Stats -->
          <div class="sh-info-col">
            <div class="sh-title-row">
              <h3 class="sh-city-name">${s.name}</h3>
              <span class="sh-time-tag">🕒 ${timeAgo(s.timestamp)}</span>
            </div>

            <!-- Stats Chips -->
            <div class="sh-chips-wrap">
              <span class="sh-stat-chip">
                👥 <b style="color: #f1f5f9;">${U.num(s.pop)}</b> ${t('topbar.population', 'Citizens')}
              </span>
              <span class="sh-stat-chip">
                💵 <b style="color: #38bdf8;">${U.money(s.money)}</b>
              </span>
              <span class="sh-stat-chip">
                😊 <b style="color: #34d399;">${s.happy}%</b> ${t('topbar.happiness', 'Happiness')}
              </span>
              <span class="sh-stat-chip">
                🏆 <b style="color: #fbbf24;">${s.milestoneName || 'Settlement'}</b>
              </span>
            </div>

            <!-- Metadata info -->
            <div class="sh-meta-details">
              <span>📅 <b>${s.dateStr}</b></span>
              <span>🗺️ Map: <b style="color: #94a3b8;">${s.map || 'valley'}</b></span>
              <span>🔑 Seed: <b style="color: #94a3b8;">${s.seed}</b></span>
            </div>
          </div>

          <!-- Actions Column -->
          <div class="sh-actions-col">
            <button class="sh-btn-primary-load" data-load-slot="${s.id}">
              ${t('save_hub.load', '▶ Load City')}
            </button>
            <div class="sh-btn-grid">
              ${
                Game.running
                  ? `<button class="sh-btn-action" data-overwrite-slot="${s.id}" title="Overwrite slot with current game">${t('save_hub.overwrite', '💾 Save')}</button>`
                  : ''
              }
              <button class="sh-btn-action" data-export-slot="${s.id}" title="Download .viracity backup file">${t('save_hub.export', '📦 Export')}</button>
              <button class="sh-btn-action" data-rename-slot="${s.id}" title="Rename this save slot">${t('save_hub.rename', '✏️ Rename')}</button>
              <button class="sh-btn-action danger" data-delete-slot="${s.id}" title="Permanently delete this save">${t('save_hub.delete', '🗑️ Delete')}</button>
            </div>
          </div>
        </div>
      `;
    }
  }

  html += `
      </div>
    </div>
  `;

  container.innerHTML = html;

  // Bind close button
  const btnClose = q<HTMLElement>('#btnHubClose', container);
  if (btnClose) btnClose.onclick = () => closeSaveHubModal();

  // Bind filter tabs
  $$<HTMLElement>('[data-filter]', container).forEach(b => {
    b.onclick = () => {
      currentFilter = b.dataset.filter as any;
      updateSaveHubContent(container, onLoadCity);
    };
  });

  // Bind autosave interval selector
  const selInterval = q<HTMLSelectElement>('#hubAutosaveInterval', container);
  if (selInterval) {
    selInterval.onchange = async () => {
      await SaveSystem.saveConfig({ autosaveIntervalMinutes: Number(selInterval.value) });
      UI.toast(t('save_hub.autosave_updated', { freq: selInterval.selectedOptions[0].text }), 'good');
    };
  }

  // Bind New Save Slot button
  const btnNewSave = q<HTMLElement>('#btnNewSaveSlot', container);
  if (btnNewSave) {
    btnNewSave.onclick = async () => {
      const defaultName = (window as any).CB?.Sim?.name || 'Vira City';
      const slotName = prompt(t('save_hub.enter_name', 'Enter a name for this city save:'), defaultName);
      if (!slotName) return;

      const slotId = `slot_${Date.now()}`;
      try {
        await SaveSystem.saveCity(slotId, slotName.trim(), 'manual');
        UI.toast(t('save_hub.save_success', 'City saved successfully.'), 'good');
        await updateSaveHubContent(container, onLoadCity);
      } catch (err: any) {
        UI.toast(t('save_hub.save_failed', { error: err?.message || 'Storage error' }), 'bad');
      }
    };
  }

  // Bind Import file button
  const btnImport = q<HTMLElement>('#btnImportViracity', container);
  const fileInput = q<HTMLInputElement>('#fileViracityInput', container);
  if (btnImport && fileInput) {
    btnImport.onclick = () => fileInput.click();
    fileInput.onchange = async () => {
      if (!fileInput.files || fileInput.files.length === 0) return;
      const file = fileInput.files[0];
      const res = await SaveSystem.importFromFile(file);
      if (res.success && res.meta) {
        UI.toast(t('save_hub.import_success', { name: res.meta.name }), 'good');
        await updateSaveHubContent(container, onLoadCity);
      } else {
        UI.toast(t('save_hub.import_failed', { error: res.error || 'Incompatible format' }), 'bad');
      }
      fileInput.value = '';
    };
  }

  // Bind load slot buttons
  $$<HTMLElement>('[data-load-slot]', container).forEach(btn => {
    btn.onclick = async () => {
      const slotId = btn.dataset.loadSlot;
      if (!slotId) return;
      const cityData = await SaveSystem.loadCityData(slotId);
      if (!cityData) {
        UI.toast(t('save_hub.save_failed', { error: 'Failed to read save data from storage.' }), 'bad');
        return;
      }
      const savesList = await SaveSystem.listSaves();
      const meta = savesList.find(s => s.id === slotId) || {
        id: slotId,
        name: cityData.name,
        type: 'manual',
        timestamp: Date.now(),
        dateStr: `Month ${cityData.month}`,
        pop: cityData.stats?.pop || 0,
        money: cityData.money || 0,
        happy: cityData.stats?.happy || 0,
        milestone: cityData.milestone || 0,
        milestoneName: 'City',
        seed: cityData.seed,
        map: cityData.map,
        version: cityData.v || 1,
      };

      closeSaveHubModal();
      if (onLoadCity) {
        onLoadCity(cityData, meta);
      } else if ((window as any).CB?.Game?.loadCity) {
        (window as any).CB.Game.loadCity(cityData);
      } else {
        location.reload();
      }
    };
  });

  // Bind overwrite slot buttons
  $$<HTMLElement>('[data-overwrite-slot]', container).forEach(btn => {
    btn.onclick = async () => {
      const slotId = btn.dataset.overwriteSlot;
      if (!slotId) return;
      const savesList = await SaveSystem.listSaves();
      const existing = savesList.find(s => s.id === slotId);
      const confirmed = confirm(t('save_hub.confirm_overwrite', { name: existing?.name || slotId }));
      if (!confirmed) return;

      await SaveSystem.saveCity(slotId, existing?.name, existing?.type || 'manual');
      UI.toast(t('save_hub.overwrite_done', 'Save slot overwritten.'), 'good');
      await updateSaveHubContent(container, onLoadCity);
    };
  });

  // Bind export slot buttons
  $$<HTMLElement>('[data-export-slot]', container).forEach(btn => {
    btn.onclick = async () => {
      const slotId = btn.dataset.exportSlot;
      if (!slotId) return;
      const ok = await SaveSystem.exportToFile(slotId);
      if (ok) UI.toast(t('save_hub.backup_downloaded', '.viracity backup file downloaded.'), 'good');
      else UI.toast(t('save_hub.backup_failed', 'Failed to export save file.'), 'bad');
    };
  });

  // Bind rename slot buttons
  $$<HTMLElement>('[data-rename-slot]', container).forEach(btn => {
    btn.onclick = async () => {
      const slotId = btn.dataset.renameSlot;
      if (!slotId) return;
      const savesList = await SaveSystem.listSaves();
      const existing = savesList.find(s => s.id === slotId);
      const newName = prompt(t('save_hub.new_name', 'New name for this city save:'), existing?.name || '');
      if (!newName || !newName.trim()) return;

      await SaveSystem.renameSlot(slotId, newName.trim());
      UI.toast(t('save_hub.renamed_done', 'Save slot renamed.'), 'good');
      await updateSaveHubContent(container, onLoadCity);
    };
  });

  // Bind delete slot buttons
  $$<HTMLElement>('[data-delete-slot]', container).forEach(btn => {
    btn.onclick = async () => {
      const slotId = btn.dataset.deleteSlot;
      if (!slotId) return;
      const savesList = await SaveSystem.listSaves();
      const existing = savesList.find(s => s.id === slotId);
      const confirmed = confirm(t('save_hub.confirm_delete', { name: existing?.name || slotId }));
      if (!confirmed) return;

      await SaveSystem.deleteSlot(slotId);
      UI.toast(t('save_hub.deleted_done', 'Save deleted.'), 'warn');
      await updateSaveHubContent(container, onLoadCity);
    };
  });
}
