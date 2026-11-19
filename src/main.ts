import * as THREE from 'three';
import { C } from './core/constants';
import { U } from './core/utils';
import { World } from './world/world';
import { Gfx } from './render/gfx';
import { Meshes, GB } from './render/meshes';
import { Sim } from './sim/sim';
import { Traffic } from './traffic/traffic';
import { Transit } from './transit/transit';
import { Tools } from './tools/tools';
import { UI } from './ui/ui';
import { Game, boot } from './game';

// Set up global window objects for devtools, runtime inspection, and shaders
if (typeof window !== 'undefined') {
  (window as any).THREE = THREE;
  const CB: Record<string, unknown> = (window as any).CB || {};
  CB.C = C;
  CB.U = U;
  CB.World = World;
  CB.Gfx = Gfx;
  CB.Meshes = Meshes;
  CB.GB = GB;
  CB.Sim = Sim;
  CB.Traffic = Traffic;
  CB.Transit = Transit;
  CB.Tools = Tools;
  CB.UI = UI;
  CB.Game = Game;
  (window as any).CB = CB;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

export { C, U, World, Gfx, Meshes, GB, Sim, Traffic, Transit, Tools, UI, Game, boot };
