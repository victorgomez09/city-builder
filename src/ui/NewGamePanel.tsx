import { useState, type JSX } from 'react';
import type { MapArchetype, MapOptions } from '../shared/types';
import { randomSeed } from '../app/session';
import { PANEL_ROUNDED, LABEL } from './theme';

const CITY_NAMES = [
  'Serena Valley',
  'Esperanza Port',
  'Green Mountain',
  'East River',
  'Blue Coast',
  'Nueva Aurora',
];

interface ArchetypePreset {
  id: MapArchetype;
  label: string;
  desc: string;
  preset?: {
    relief: number;
    waterLevel: number;
    treeDensity: number;
  };
}

const ARCHETYPES: Array<ArchetypePreset> = [
  {
    id: 'valley',
    label: 'Valley',
    desc: 'Rivers & fertile plains',
    preset: { relief: 0.45, waterLevel: 0.40, treeDensity: 0.60 },
  },
  {
    id: 'coastal',
    label: 'Coastal Bay',
    desc: 'Ocean shore & beaches',
    preset: { relief: 0.35, waterLevel: 0.65, treeDensity: 0.45 },
  },
  {
    id: 'plains',
    label: 'Plains',
    desc: 'Flat & buildable',
    preset: { relief: 0.15, waterLevel: 0.20, treeDensity: 0.35 },
  },
  {
    id: 'island',
    label: 'Archipelago',
    desc: 'Island clusters',
    preset: { relief: 0.50, waterLevel: 0.75, treeDensity: 0.50 },
  },
  {
    id: 'mountain',
    label: 'Mountain',
    desc: 'Alpine peaks & ridges',
    preset: { relief: 0.85, waterLevel: 0.25, treeDensity: 0.30 },
  },
  {
    id: 'custom',
    label: 'Custom',
    desc: 'Freeform sliders',
  },
];

export interface NewGameConfig {
  cityName: string;
  seed: number;
  options: MapOptions;
}

export interface NewGamePanelProps {
  onStart: (config: NewGameConfig) => void;
  onBack: () => void;
}

export function NewGamePanel({ onStart, onBack }: NewGamePanelProps): JSX.Element {
  const [cityName, setCityName] = useState(() => CITY_NAMES[Math.floor(Math.random() * CITY_NAMES.length)]!);
  const [seed, setSeed] = useState(() => randomSeed());

  // Default to Valley preset
  const defaultPreset = ARCHETYPES[0]!.preset!;
  const [archetype, setArchetype] = useState<MapArchetype>('valley');
  const [relief, setRelief] = useState(defaultPreset.relief);
  const [waterLevel, setWaterLevel] = useState(defaultPreset.waterLevel);
  const [treeDensity, setTreeDensity] = useState(defaultPreset.treeDensity);

  const handleSelectArchetype = (arch: ArchetypePreset) => {
    setArchetype(arch.id);
    if (arch.preset) {
      setRelief(arch.preset.relief);
      setWaterLevel(arch.preset.waterLevel);
      setTreeDensity(arch.preset.treeDensity);
    }
  };

  const handleReliefChange = (value: number) => {
    setRelief(value);
    setArchetype('custom');
  };

  const handleWaterLevelChange = (value: number) => {
    setWaterLevel(value);
    setArchetype('custom');
  };

  const handleTreeDensityChange = (value: number) => {
    setTreeDensity(value);
    setArchetype('custom');
  };

  const handleRandomize = () => {
    setCityName(CITY_NAMES[Math.floor(Math.random() * CITY_NAMES.length)]!);
    setSeed(randomSeed());
    const presetsOnly = ARCHETYPES.filter((a) => a.id !== 'custom');
    const picked = presetsOnly[Math.floor(Math.random() * presetsOnly.length)]!;
    handleSelectArchetype(picked);
  };

  const handleStart = () => {
    onStart({
      cityName,
      seed,
      options: { relief, waterLevel, treeDensity, archetype },
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#05070cd9] p-4 backdrop-blur-sm"
      role="dialog"
      aria-label="New Game"
    >
      <div className={`flex w-full max-w-lg flex-col gap-5 p-6 text-white ${PANEL_ROUNDED}`}>
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h2 className="text-xl font-bold tracking-tight">New City</h2>
          <button
            type="button"
            onClick={handleRandomize}
            className="rounded bg-white/10 px-3 py-1 text-xs font-semibold hover:bg-white/20 transition-colors"
          >
            🎲 Randomize
          </button>
        </div>

        {/* City name */}
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>City Name</label>
          <input
            type="text"
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            className="rounded border border-white/15 bg-white/5 px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>

        {/* Landscape Type / Archetype */}
        <div className="flex flex-col gap-1.5">
          <label className={LABEL}>Landscape Type</label>
          <div className="grid grid-cols-3 gap-2">
            {ARCHETYPES.map((arch) => (
              <button
                key={arch.id}
                type="button"
                onClick={() => handleSelectArchetype(arch)}
                className={`flex flex-col items-start rounded p-2 text-left transition-colors border ${
                  archetype === arch.id
                    ? 'border-accent bg-accent/20 text-white'
                    : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                <span className="text-xs font-bold">{arch.label}</span>
                <span className="text-[10px] text-white/50">{arch.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Adjustment Sliders */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className={LABEL}>Relief / Mountains</span>
              <span>{Math.round(relief * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={relief}
              onChange={(e) => handleReliefChange(parseFloat(e.target.value))}
              className="accent-accent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className={LABEL}>Water Level</span>
              <span>{Math.round(waterLevel * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={waterLevel}
              onChange={(e) => handleWaterLevelChange(parseFloat(e.target.value))}
              className="accent-accent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs">
              <span className={LABEL}>Tree Density</span>
              <span>{Math.round(treeDensity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={treeDensity}
              onChange={(e) => handleTreeDensityChange(parseFloat(e.target.value))}
              className="accent-accent"
            />
          </div>
        </div>

        {/* Seed */}
        <div className="flex items-center justify-between text-xs text-white/60 pt-2 border-t border-white/10">
          <span>
            Seed: <span className="font-mono text-white/90">{seed}</span>
          </span>
          <button
            type="button"
            onClick={() => setSeed(randomSeed())}
            className="hover:text-white underline text-[11px]"
          >
            Change Seed
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="flex-1 rounded bg-white/10 py-2.5 text-sm font-semibold hover:bg-white/20 transition-colors"
          >
            Back
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="flex-1 rounded bg-accent py-2.5 text-sm font-semibold text-white shadow-lg hover:opacity-90 transition-opacity"
          >
            Found City
          </button>
        </div>
      </div>
    </div>
  );
}
