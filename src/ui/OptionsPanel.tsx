/**
 * Options panel: tabbed rendering + gameplay + audio toggles. Pure presentational —
 * no store access; the integrator supplies the current settings and receives
 * partial patches via onChange so it can decide how/where to persist them.
 */
import { useState } from 'react';
import type { JSX } from 'react';
import { LABEL, PANEL_ROUNDED } from './theme';
import type {
  AntiAliasingMode,
  AnisotropicFiltering,
  CloudQuality,
  GameSettings,
  GraphicsPreset,
  ResolutionScale,
  ShadowQuality,
  TerrainQuality,
} from '../app/session';
import type { MusicPlayer } from '../app/music';
import { MusicPanel } from './MusicPanel';

export type { GameSettings };

export type OptionsTab = 'graphics' | 'gameplay' | 'audio';

export interface OptionsPanelProps {
  settings: GameSettings;
  onChange: (partial: Partial<GameSettings>) => void;
  onBack: () => void;
  /** Optional so the panel still renders standalone (and in its own tests). */
  musicPlayer?: MusicPlayer;
}

export function OptionsPanel({
  settings,
  onChange,
  onBack,
  musicPlayer,
}: OptionsPanelProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<OptionsTab>('graphics');

  const handlePresetChange = (preset: GraphicsPreset) => {
    if (preset === 'custom') {
      onChange({ graphicsPreset: 'custom' });
      return;
    }
    switch (preset) {
      case 'low':
        onChange({
          graphicsPreset: 'low',
          resolutionScale: 'native',
          antiAliasing: 'off',
          anisotropicFiltering: '2x',
          shadowQuality: 'low',
          terrainQuality: 'low',
          clouds: 'off',
          vehicleLights: false,
          weatherEffects: false,
          bloom: false,
        });
        break;
      case 'medium':
        onChange({
          graphicsPreset: 'medium',
          resolutionScale: 'native',
          antiAliasing: 'msaa2x',
          anisotropicFiltering: '4x',
          shadowQuality: 'medium',
          terrainQuality: 'medium',
          clouds: 'low',
          vehicleLights: true,
          weatherEffects: true,
          bloom: true,
        });
        break;
      case 'high':
        onChange({
          graphicsPreset: 'high',
          resolutionScale: 'native',
          antiAliasing: 'msaa4x',
          anisotropicFiltering: '8x',
          shadowQuality: 'high',
          terrainQuality: 'high',
          clouds: 'high',
          vehicleLights: true,
          weatherEffects: true,
          bloom: true,
        });
        break;
      case 'ultra_4k':
        onChange({
          graphicsPreset: 'ultra_4k',
          resolutionScale: '4k',
          antiAliasing: 'ssaa4k',
          anisotropicFiltering: '16x',
          shadowQuality: 'ultra',
          terrainQuality: 'ultra',
          clouds: 'high',
          vehicleLights: true,
          weatherEffects: true,
          bloom: true,
        });
        break;
    }
  };

  const handleGraphicChange = (patch: Partial<GameSettings>) => {
    onChange({ ...patch, graphicsPreset: 'custom' });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[#05070cd9] p-6 backdrop-blur-sm"
      role="dialog"
      aria-label="Options"
    >
      <div className={`flex w-full max-w-lg min-h-[500px] max-h-[88vh] overflow-y-auto flex-col gap-4 p-6 text-white ${PANEL_ROUNDED}`}>
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h2 className="text-xl font-bold tracking-wide">Options</h2>
          <span className="text-xs uppercase text-white/50 tracking-wider">CityVI Settings</span>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 rounded-lg bg-black/20 p-1" role="tablist" aria-label="Settings Categories">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'graphics'}
            onClick={() => setActiveTab('graphics')}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold tracking-wider uppercase transition-all ${
              activeTab === 'graphics'
                ? 'bg-accent text-white shadow-sm'
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            Graphics
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'gameplay'}
            onClick={() => setActiveTab('gameplay')}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold tracking-wider uppercase transition-all ${
              activeTab === 'gameplay'
                ? 'bg-accent text-white shadow-sm'
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            Gameplay
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'audio'}
            onClick={() => setActiveTab('audio')}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold tracking-wider uppercase transition-all ${
              activeTab === 'audio'
                ? 'bg-accent text-white shadow-sm'
                : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            Audio
          </button>
        </div>

        {/* Tab 1: Graphics Settings */}
        {activeTab === 'graphics' && (
          <div className="flex flex-col gap-4 py-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">Preset</span>
              <select
                aria-label="Preset"
                value={settings.graphicsPreset ?? 'high'}
                onChange={(e) => handlePresetChange(e.target.value as GraphicsPreset)}
                className="cursor-pointer rounded border border-white/20 bg-panel px-3 py-1.5 text-xs text-white outline-none focus:border-accent"
              >
                <option value="low">Low (Performance)</option>
                <option value="medium">Medium (Balanced)</option>
                <option value="high">High (Quality HD)</option>
                <option value="ultra_4k">Ultra 4K (Max Fidelity SSAA)</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div className={LABEL}>Display &amp; Antialiasing</div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <span>Resolution Scale</span>
              <select
                aria-label="Resolution Scale"
                value={settings.resolutionScale ?? 'native'}
                onChange={(e) => handleGraphicChange({ resolutionScale: e.target.value as ResolutionScale })}
                className="cursor-pointer rounded border border-white/20 bg-panel px-3 py-1.5 text-xs text-white outline-none focus:border-accent"
              >
                <option value="native">Native (Display)</option>
                <option value="1080p">1080p (Full HD)</option>
                <option value="1440p">1440p (2K QHD)</option>
                <option value="4k">4K UHD (Supersampling SSAA)</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <span>Anti-Aliasing</span>
              <select
                aria-label="Anti-Aliasing"
                value={settings.antiAliasing ?? 'msaa4x'}
                onChange={(e) => handleGraphicChange({ antiAliasing: e.target.value as AntiAliasingMode })}
                className="cursor-pointer rounded border border-white/20 bg-panel px-3 py-1.5 text-xs text-white outline-none focus:border-accent"
              >
                <option value="off">Off (1x)</option>
                <option value="msaa2x">MSAA 2x</option>
                <option value="msaa4x">MSAA 4x (Standard)</option>
                <option value="msaa8x">MSAA 8x (High)</option>
                <option value="ssaa4k">SSAA 4K (Ultra Crisp)</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <span>Anisotropic Filtering</span>
              <select
                aria-label="Anisotropic Filtering"
                value={settings.anisotropicFiltering ?? '8x'}
                onChange={(e) => handleGraphicChange({ anisotropicFiltering: e.target.value as AnisotropicFiltering })}
                className="cursor-pointer rounded border border-white/20 bg-panel px-3 py-1.5 text-xs text-white outline-none focus:border-accent"
              >
                <option value="1x">1x (Bilinear / Off)</option>
                <option value="2x">2x</option>
                <option value="4x">4x</option>
                <option value="8x">8x (High)</option>
                <option value="16x">16x (Ultra Sharp)</option>
              </select>
            </div>

            <div className={LABEL}>Scene &amp; Environment Detail</div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <span>Shadows</span>
              <select
                aria-label="Shadows"
                value={settings.shadowQuality ?? 'high'}
                onChange={(e) => handleGraphicChange({ shadowQuality: e.target.value as ShadowQuality })}
                className="cursor-pointer rounded border border-white/20 bg-panel px-3 py-1.5 text-xs text-white outline-none focus:border-accent"
              >
                <option value="off">Off (Max FPS)</option>
                <option value="low">Low (1K Basic)</option>
                <option value="medium">Medium (2K PCF)</option>
                <option value="high">High (4K PCF Soft)</option>
                <option value="ultra">Ultra (4K Soft Penumbra)</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <span>Terrain &amp; Geometry</span>
              <select
                aria-label="Terrain Quality"
                value={settings.terrainQuality ?? 'high'}
                onChange={(e) => handleGraphicChange({ terrainQuality: e.target.value as TerrainQuality })}
                className="cursor-pointer rounded border border-white/20 bg-panel px-3 py-1.5 text-xs text-white outline-none focus:border-accent"
              >
                <option value="low">Low (1x quads / 20m)</option>
                <option value="medium">Medium (2x quads / 10m)</option>
                <option value="high">High (4x quads / 5m - HD)</option>
                <option value="ultra">Ultra (8x quads / 2.5m - UHD)</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <span>Dynamic Clouds</span>
              <select
                aria-label="Dynamic Clouds"
                value={settings.clouds ?? 'high'}
                onChange={(e) => handleGraphicChange({ clouds: e.target.value as CloudQuality })}
                className="cursor-pointer rounded border border-white/20 bg-panel px-3 py-1.5 text-xs text-white outline-none focus:border-accent"
              >
                <option value="off">Off</option>
                <option value="low">Low (50% density)</option>
                <option value="high">High (Full cumulus)</option>
              </select>
            </div>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Vehicle Headlights &amp; Night Lights</span>
              <input
                type="checkbox"
                aria-label="Vehicle Headlights & Night Lights"
                checked={settings.vehicleLights ?? true}
                onChange={(e) => handleGraphicChange({ vehicleLights: e.target.checked })}
                className="h-4 w-4 accent-accent"
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Weather Precipitation Effects</span>
              <input
                type="checkbox"
                aria-label="Weather Precipitation Effects"
                checked={settings.weatherEffects ?? true}
                onChange={(e) => handleGraphicChange({ weatherEffects: e.target.checked })}
                className="h-4 w-4 accent-accent"
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Bloom Glow</span>
              <input
                type="checkbox"
                aria-label="Bloom Glow"
                checked={settings.bloom}
                onChange={(e) => handleGraphicChange({ bloom: e.target.checked })}
                className="h-4 w-4 accent-accent"
              />
            </label>
          </div>
        )}

        {/* Tab 2: Gameplay Settings */}
        {activeTab === 'gameplay' && (
          <div className="flex flex-col gap-4 py-2">
            <div className={LABEL}>City Building Sandbox</div>

            <label className="flex items-center justify-between gap-3 text-sm">
              <div>
                <span className="block font-medium">Sandbox Mode</span>
                <span className="text-xs text-white/50">Unlock all milestones, building kits, and civic structures</span>
              </div>
              <input
                type="checkbox"
                aria-label="Sandbox: unlock all build items"
                checked={settings.sandboxUnlockAll}
                onChange={(e) => onChange({ sandboxUnlockAll: e.target.checked })}
                className="h-4 w-4 accent-accent"
              />
            </label>

            <label className="flex items-center justify-between gap-3 text-sm">
              <div>
                <span className="block font-medium">Unlimited Money</span>
                <span className="text-xs text-white/50">Build with infinite funds (budget flows are still simulated)</span>
              </div>
              <input
                type="checkbox"
                aria-label="Unlimited money"
                checked={settings.unlimitedMoney}
                onChange={(e) => onChange({ unlimitedMoney: e.target.checked })}
                className="h-4 w-4 accent-accent"
              />
            </label>
          </div>
        )}

        {/* Tab 3: Audio Settings */}
        {activeTab === 'audio' && (
          <div className="flex flex-col gap-4 py-2">
            <div className={LABEL}>Master Audio</div>

            <div className="flex items-center justify-between gap-3 text-sm">
              <span>Master Volume</span>
              <input
                type="range"
                aria-label="Master Volume"
                min={0}
                max={1}
                step={0.01}
                value={settings.masterVolume}
                onChange={(e) => onChange({ masterVolume: Number(e.target.value) })}
                className="w-36 accent-accent"
              />
            </div>

            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Mute All Audio</span>
              <input
                type="checkbox"
                aria-label="Mute"
                checked={settings.muted}
                onChange={(e) => onChange({ muted: e.target.checked })}
                className="h-4 w-4 accent-accent"
              />
            </label>

            <div className={LABEL}>Music Soundtrack</div>

            {musicPlayer && (
              <MusicPanel
                player={musicPlayer}
                musicVolume={settings.musicVolume}
                onVolumeChange={(musicVolume) => onChange({ musicVolume })}
                onModeChange={onChange}
              />
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-auto border-t border-white/10 pt-4 flex justify-between items-center">
          <button
            type="button"
            aria-label="Back"
            onClick={onBack}
            className="rounded-md bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white hover:bg-white/20 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
