import * as THREE from 'three';
import { C } from '@/core/constants';
import { U } from '@/core/utils';
import { World } from '@/world/world';
import { Gfx } from '@/render/gfx';
import { Meshes } from '@/render/meshes';
import { Sim } from '@/sim/sim';
import { Traffic } from '@/traffic/traffic';
import { Transit } from '@/transit/transit';
import { Tools } from '@/tools/tools';
import { UI } from '@/ui/ui';
import { SaveSystem } from '@/sim/saveSystem';
import { renderSaveHubModal } from '@/ui/panels/saveHub';

if (typeof window !== 'undefined') {
  (window as any).THREE = THREE;
}

export interface GameSettings {
  preset?: string;
  dayNight?: boolean;
  fps?: boolean;
  cars?: number;
  shadows?: number;
  detail?: boolean;
  trees?: number;
  post?: boolean;
  ssao?: boolean;
  pbr?: boolean;
  waterWaves?: boolean;
  dof?: boolean;
  bloom?: boolean;
  [key: string]: unknown;
}

export interface GameInstance {
  running: boolean;
  applySettings?: (ns: Partial<GameSettings>) => void;
  save?: (quiet?: boolean) => boolean;
  showStart?: (restart?: boolean) => void;
  start?: () => void;
  pause?: () => void;
  resume?: () => void;
  newCity?: (seed: number, map?: string) => void;
  loadCity?: (d: unknown) => void;
  saveCity?: () => unknown;
  boot?: () => void;
  [key: string]: unknown;
}

export const Game: GameInstance = { running: false };

/**
 * Helper tipado para selección de elementos del DOM por identificador
 */
const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

/**
 * Muestra una notificación visual en pantalla cuando ocurre un error crítico
 */
function showErr(msg: string) {
  let e = $('err');
  if (!e) {
    e = document.createElement('div');
    e.id = 'err';
    document.body.appendChild(e);
  }
  e.textContent = msg;
}

window.addEventListener('error', ev =>
  showErr('Error: ' + ev.message + (ev.filename ? '\n' + ev.filename.split('/').pop() + ':' + ev.lineno : ''))
);

/**
 * Acceso seguro y tipado a localStorage
 */
function store(k: string, v?: string): string | null {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
    return v;
  } catch (e) {
    return null;
  }
}

function storeDel(k: string) {
  try {
    localStorage.removeItem(k);
  } catch (e) {
    /* storage blocked */
  }
}

function defaultPreset() {
  const mobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency || 4;
  if (mobile || cores <= 2) return 'low';
  return 'medium';
}

function loadSettings(): GameSettings {
  let s: Partial<GameSettings> | null = null;
  try {
    const raw = store(C.SET_KEY) || store(C.LEGACY_SET_KEY);
    s = JSON.parse(raw || 'null');
  } catch (e) {
    s = null;
  }
  const preset = (s && s.preset) || defaultPreset();
  const base = Object.assign(
    { preset, dayNight: true, fps: false },
    C.QUALITY[preset === 'custom' ? 'medium' : preset]
  );
  return Object.assign(base, s || {});
}

Game.applySettings = function (ns: Partial<GameSettings>) {
  const old = Gfx.settings;
  Gfx.applySettings(ns);
  if (old.cars !== ns.cars || old.shadows !== ns.shadows || old.detail !== ns.detail) {
    Meshes.resizeVehicles();
  }
  if (old.trees !== ns.trees) Meshes.treesDirty = true;
  store(C.SET_KEY, JSON.stringify(ns));
};

Game.save = function (quiet?: boolean) {
  if (!Game.running) return false;
  try {
    const serialized = Sim.serialize();
    try {
      localStorage.setItem(C.SAVE_KEY, JSON.stringify(serialized));
    } catch {
      /* ignore quota errors */
    }
    SaveSystem.saveCity(SaveSystem.config.activeSlot || 'slot_1', Sim.name, 'manual').catch(err => {
      console.warn('[SaveSystem] async save error:', err);
    });
    return true;
  } catch (e) {
    if (!quiet) UI.toast('Could not save: browser storage is blocked or full.', 'bad');
    return false;
  }
};

Game.autosave = function () {
  if (!Game.running) return;
  SaveSystem.triggerRollingAutosave();
};

function readSave() {
  try {
    const s = store(C.SAVE_KEY) || store(C.LEGACY_SAVE_KEY);
    return s ? JSON.parse(s) : null;
  } catch (e) {
    return null;
  }
}

  Game.showStart = function (fresh) {
    if (fresh) {
      storeDel(C.SAVE_KEY);
      storeDel(C.LEGACY_SAVE_KEY);
      try { sessionStorage.setItem('viracity.fresh', '1'); } catch (e) { /* ignore */ }
      location.reload();
    }
  };

  // ------------------------------------------------------------------
  function boot() {
    if (!(window as any).THREE) {
      $('loading').textContent = 'Could not load the 3D engine. Check your internet connection and reload.';
      return;
    }
    const save = readSave();
    const params = new URLSearchParams(location.search);
    let fresh = false;
    try {
      fresh = sessionStorage.getItem('viracity.fresh') === '1';
      sessionStorage.removeItem('viracity.fresh');
    } catch (e) {
      /* ignore */
    }
    let pick: string | null = null,
      auto = false;
    try {
      pick = sessionStorage.getItem('viracity.map');
      sessionStorage.removeItem('viracity.map');
      auto = sessionStorage.getItem('viracity.autoload') === '1';
      sessionStorage.removeItem('viracity.autoload');
    } catch (e) {
      /* ignore */
    }
    const useSave = save && !fresh && !pick;
    let seed = useSave ? save.seed : Math.floor(Math.random() * 1e6) + 1;
    let map = useSave ? save.map || 'valley' : pick || 'valley';
    if (params.get('seed')) seed = +params.get('seed')!;
    if (params.get('map')) map = params.get('map')!;
    if (params.get('trace')) console.log('seed ' + seed);
    const settings = loadSettings();
    if (params.get('preset')) {
      Object.assign(settings, C.QUALITY[params.get('preset')!], { preset: params.get('preset') });
    }
    World.init(seed, map);
    Gfx.init($('view'), settings);
    Meshes.init();
    Sim.init({ seed, name: 'Port Alder' });
    Tools.init($('view'));
    UI.init();
    Meshes.updateZoneTex(false);
    $('loading').remove();

    // Pantalla inicial
    const st = $('start');
    st.hidden = false;
    $('topbar').hidden = true;
    $('toolbar').hidden = true;

    const presetSelect = $<HTMLSelectElement>('presetStart');
    presetSelect.value = settings.preset === 'custom' ? 'medium' : settings.preset;
    presetSelect.onchange = () => {
      const p = presetSelect.value;
      Game.applySettings(Object.assign({}, Gfx.settings, C.QUALITY[p], { preset: p }));
    };

    if (save && !fresh) {
      $('btnContinue').hidden = false;
      $('btnContinue').textContent = 'Continue ' + save.name;
    }

    const ms = $<HTMLSelectElement>('mapStart');
    ms.innerHTML = C.MAPS.map(m => `<option value="${m.key}">${m.name}</option>`).join('');
    ms.value = World.map;
    const mdesc = () => {
      const m = C.MAPS.find(q => q.key === ms.value);
      $('mapDesc').textContent = m ? m.desc : '';
    };
    mdesc();
    ms.onchange = () => {
      try {
        sessionStorage.setItem('viracity.map', ms.value);
        sessionStorage.setItem('viracity.name', $<HTMLInputElement>('cityInput').value);
      } catch (e) {
        /* ignore */
      }
      location.reload();
    };
    try {
      const nm = sessionStorage.getItem('viracity.name');
      if (nm && pick) $<HTMLInputElement>('cityInput').value = nm;
      sessionStorage.removeItem('viracity.name');
    } catch (e) {
      /* ignore */
    }

    $('btnNew').onclick = () => startNew(($<HTMLInputElement>('cityInput').value || 'Port Alder').trim());
    $('btnContinue').onclick = () => {
      if (save.seed === World.seed && (save.map || 'valley') === World.map) {
        continueSave(save);
        return;
      }
      try {
        sessionStorage.setItem('viracity.autoload', '1');
      } catch (e) {
        /* ignore */
      }
      location.reload();
    };

    SaveSystem.init();
    SaveSystem.initDragAndDrop((city, meta) => {
      continueSave(city);
      UI.toast(`City "${meta.name}" loaded from file.`, 'good');
    });

    const btnOpenSaveHub = $('btnOpenSaveHub');
    if (btnOpenSaveHub) {
      btnOpenSaveHub.onclick = () => {
        renderSaveHubModal(city => continueSave(city));
      };
    }

    // Keyboard shortcuts for Quick Save (Ctrl+S / F5) and Quick Load (F9)
    window.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (Game.running) {
          SaveSystem.quickSave().then(() => UI.toast('Quick save completed.', 'good'));
        }
      } else if (e.key === 'F5') {
        e.preventDefault();
        if (Game.running) {
          SaveSystem.quickSave().then(() => UI.toast('Quick save completed.', 'good'));
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (Game.running) {
          SaveSystem.quickLoad().then(data => {
            if (data) {
              continueSave(data);
              UI.toast('Quick save loaded.', 'good');
            } else {
              UI.toast('No quick save file found.', 'bad');
            }
          });
        }
      }
    });

    if (auto && save && useSave) continueSave(save);
    G0.orbit = true;
    requestAnimationFrame(loop);

    if (params.get('demo')) { startNew('Demo City'); demoCity(+params.get('ms') || 0); }
    if (params.get('play')) { startNew('Play Test'); playTest(); }
    if (params.get('autoload') && save) continueSave(save);
    if (params.get('ff')) fastForward(+params.get('ff'));
    if (params.get('autosave')) Game.save();
    if (params.get('cam')) { const c = Gfx.cam; const v = params.get('cam').split(',').map(Number); c.tx = v[0]; c.tz = v[1]; c.tdist = c.dist = v[2]; c.yaw = v[3]; c.pitch = v[4]; }
    if (params.get('view')) { const c = Gfx.cam; const v = params.get('view').split(',').map(Number); c.tdist = c.dist = v[0]; c.yaw = v[1]; c.pitch = v[2]; if (v.length > 3) { c.tx += v[3]; c.tz += v[4]; } }
    if (params.get('hour')) Sim.hour = +params.get('hour');
    if (params.get('seed')) { /* seed is chosen at boot; see below */ }
    if (params.get('ov')) UI.setOverlay(params.get('ov'));
    if (params.get('panel')) UI.openPanel(params.get('panel'));
    if (params.get('cat')) UI.openCat(params.get('cat'));
    if (params.get('sel')) { const z = +params.get('sel'); for (const b of Sim.buildings.values()) if (b.zone === z && b.state === 'live') { UI.select(b); break; } }
    if (params.get('dbg')) {
      const pre = document.createElement('pre'); pre.id = 'dbg'; pre.style.display = 'none'; document.body.appendChild(pre);
      const S = Sim;
      const counts = {}; S.buildings.forEach(b => { const k = b.kind === 'svc' ? 'svc' : C.ZONES[b.zone].key + ':' + b.state; counts[k] = (counts[k] || 0) + 1; });
      pre.textContent = JSON.stringify({ month: S.month, hour: S.hour, money: Math.round(S.money), stats: S.stats, demand: S.demand, ms: S.milestone, last: S.last, veh: Traffic.stats, nveh: Traffic.vehicles.length, counts, riders: Transit.stats,
        lines: Transit.lines.map(l => ({ b: l.broken, n: l.stops.length, p: l.path && l.path.length, veh: Transit.vehiclesOf(l).length, rm: l.ridersMonth })),
        rt: (() => { const s = Transit.stops; if (s.length < 3) return null; const r = Transit.route(s[0].tile, s[2].tile); return r ? { t: r.time, legs: r.legs } : 'null'; })(),
        wait: Transit.stops.map(s => s.waiting.length), play: Game.playLog }, (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v);
    }
  }
  const G0 = { orbit: false };

  function startNew(name) {
    Sim.name = name || 'Port Alder';
    $('start').hidden = true;
    $('topbar').hidden = false; $('toolbar').hidden = false;
    G0.orbit = false;
    Game.running = true;
    $('goals').hidden = false;
    UI.setSpeed(1);
    const hw = World.hwRow;
    Gfx.focus((C.P0 + 18) * C.TILE, (hw + 1) * C.TILE, 260);
    UI.toast('Welcome to ' + Sim.name + '. Open Roads and drag a street from the little road at the end of the highway.', 'good');
    Game.save(true);
  }
  function continueSave(save) {
    try {
      Sim.load(save);
      Transit.buildAll();
      Meshes.rebuildAll();
      Meshes.updateZoneTex(false);
    } catch (e) { showErr('Could not load the saved city: ' + e.message); return; }
    $('start').hidden = true;
    $('topbar').hidden = false; $('toolbar').hidden = false;
    G0.orbit = false;
    Game.running = true;
    $('goals').hidden = false;
    UI.setSpeed(1);
    // look at the city centre
    let sx = 0, sz = 0, n = 0;
    Sim.buildings.forEach(b => { sx += b.x; sz += b.y; n++; });
    if (n) Gfx.focus(sx / n * C.TILE, sz / n * C.TILE, 420);
  }
  Game.loadCity = continueSave;

  // ------------------------------------------------------------------
  let last = performance.now(), fpsT = 0, fpsN = 0, iconT = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000; last = now;
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, 0.1);
    const S = Sim, Gx = Gfx, Mx = Meshes;
    if (Game.running && S.speed > 0) {
      let simDt = dt * S.speed;
      const steps = Math.ceil(simDt / 0.1);
      const sd = simDt / steps;
      for (let k = 0; k < steps; k++) { S.step(sd); Traffic.update(sd); Transit.update(sd); }

      // Periodic rolling autosave check
      const intervalMin = SaveSystem.config.autosaveIntervalMinutes || 5;
      if (intervalMin > 0 && Date.now() - SaveSystem.lastAutosaveTimestamp > intervalMin * 60 * 1000) {
        SaveSystem.lastAutosaveTimestamp = Date.now();
        SaveSystem.triggerRollingAutosave().then(meta => {
          if (meta) UI.toast(`Autosave complete (${meta.name}).`, 'good');
        });
      }
    }
    if (G0.orbit) { Gx.cam.yaw += dt * 0.04; Gx.cam.tdist = 520; Gx.cam.pitch = 0.5; }
    Gx.uni.uTime.value += dt;
    Gx.setTime(S.hour);
    Tools.update();
    if (UI.follow && UI.selVehicle) { const v = UI.selVehicle; Gx.cam.tx += (v.x - Gx.cam.tx) * Math.min(1, dt * 5); Gx.cam.tz += (v.z - Gx.cam.tz) * Math.min(1, dt * 5); }
    Gx.updateCamera(dt);
    if (Gx.terrainDirty) { Gx.terrainDirty = false; Gx.refreshTerrain(); }
    Mx.update(6);
    if (S.zoneTexDirty) { S.zoneTexDirty = false; Mx.updateZoneTex(Tools.zoneView); }
    Mx.beginVehicles(); Traffic.render(); Transit.render(); Mx.endVehicles();
    iconT += dt;
    if (iconT > 0.5) { iconT = 0; Mx.setIcons(Game.running ? S.icons : []); }
    Mx.cullTrees(Gx.camera);
    Gx.render();
    fpsN++; fpsT += dt;
    if (fpsT > 0.5) {
      const f = $('fps');
      f.textContent = Gx.settings.fps ? Math.round(fpsN / fpsT) + ' fps · ' + Gx.renderer.info.render.calls + ' draws · ' + (Gx.renderer.info.render.triangles / 1000).toFixed(0) + 'k tris' : '';
      fpsN = 0; fpsT = 0;
    }
  }

  // ------------------------------------------------------------------
  // Test helpers (URL params): ?demo=1 builds a starter town, ?ff=N runs N game hours
  function fastForward(hours) {
    const S = Sim;
    const steps = Math.round(hours * C.SIM_SEC / 0.25);
    const trace = new URLSearchParams(location.search).get('trace');
    for (let k = 0; k < steps; k++) {
      if (trace) console.log('ff ' + k + ' S h=' + S.hour.toFixed(2));
      S.step(0.25);
      if (trace) console.log('ff ' + k + ' T veh=' + Traffic.vehicles.length + ' q=' + Traffic.queue.length);
      Traffic.update(0.25);
      if (trace) console.log('ff ' + k + ' X');
      Transit.update(0.25);
      if (k % 40 === 0) { if (trace) console.log('ff ' + k + ' M'); Meshes.update(1); }
    }
  }
  function demoCity(ms) {
    const Wd = World, S = Sim, U2 = U, I = U.idx, Tl = Tools;
    S.money = 900000;
    S.milestone = ms || 0;
    const r = Wd.hwRow, x0 = C.P0 + 16;
    const road = (rt, a, b) => { Tl._simulate({ type: 'road', rt }, a, b); };
    const AVE = C.ROADS.findIndex(q => q && q.key === 'ave4');
    const BIKE = C.ROADS.findIndex(q => q && q.key === 'bike2');
    // main avenue east from the connector
    road(ms >= 2 ? AVE : 1, I(x0, r + 1), I(x0 + 46, r + 1));
    for (let k = 0; k <= 6; k++) road(k % 2 && ms >= 1 ? BIKE : 1, I(x0 + 6 + k * 6, r - 20), I(x0 + 6 + k * 6, r + 21));
    for (let j = 0; j <= 7; j++) { const y = r - 20 + j * 6; if (Math.abs(y - r) <= 2) continue; road(1, I(x0 + 6, y), I(x0 + 42, y)); }
    if (ms >= 6) { for (let x = x0 + 4; x <= x0 + 46; x++) S.setRail(U2.idx(x, r - 7), 1); S.networkChanged(); }
    const X = Transit;
    if (ms >= 3) {
      // eastbound along the avenue (south kerb), westbound back along the street to the north (north kerb)
      const ids = [[x0 + 9, r + 1, 2], [x0 + 21, r + 1, 2], [x0 + 33, r + 1, 2], [x0 + 33, r - 8, 0], [x0 + 21, r - 8, 0], [x0 + 9, r - 8, 0]].map(([x, y, sd]) => (X.stopAtTile(I(x, y), 'bus', sd) || X.addStop('bus', I(x, y), null, sd)).id);
      X.createLine('bus', ids);
    }
    if (ms >= 6) { const ids = [x0 + 6, x0 + 25, x0 + 44].map(x => X.addStop('rail', I(x, r - 7)).id); X.createLine('rail', ids); X.setVehicles(X.lines[X.lines.length - 1], 2); }
    const place = (key, tx, ty) => {
      for (let rad = 0; rad < 12; rad++) for (let dy = -rad; dy <= rad; dy++) for (let dx = -rad; dx <= rad; dx++) {
        const lot = S.serviceLot(key, tx + dx, ty + dy, 0);
        if (lot.ok) { S.placeService(key, lot); return true; }
      }
      return false;
    };
    if (ms >= 1) { place('clinic', x0 + 14, r - 3); place('garbage', x0 + 40, r + 15); place('park', x0 + 9, r - 9); place('playground', x0 + 27, r - 15); }
    if (ms >= 2) { place('fire', x0 + 26, r + 4); place('police', x0 + 32, r - 3); place('elem', x0 + 20, r - 9); }
    if (ms >= 3) place('plaza', x0 + 20, r + 5);
    if (ms >= 7) { place('claude', x0 + 33, r + 10); place('vscode', x0 + 14, r + 10); place('octocat', x0 + 38, r - 15); place('duck', x0 + 9, r - 15); }
    for (let i = 0; i < Wd.zone.length; i++) {
      if (!Wd.zonable[i] || Wd.bld[i]) continue;
      const x = U2.tx(i), y = U2.ty(i);
      if (x < x0 + 3 || x > x0 + 47 || Math.abs(y - r) > 22) continue;
      const dy = y - r;
      let z = 1;
      if (Math.abs(dy) <= 3) z = 4;
      else if (dy > 12) z = 6;
      else if (dy > 3 && x > x0 + 30) z = 4;
      else if (dy < -12 && ms >= 3) z = 2;
      if (ms >= 6 && Math.abs(dy) <= 8 && x < x0 + 20 && dy < 0) z = 3;
      if (ms >= 5 && dy > 3 && dy <= 8 && x < x0 + 18) z = 7;
      S.setZone(i, z);
    }
    S.zoneTexDirty = true;
    Tl.setTool(null);
    Gfx.focus((x0 + 24) * C.TILE, r * C.TILE, 520);
  }
  // drives the real tools the way a player would
  function playTest() {
    const Wd = World, Tl = Tools, I = U.idx;
    const r = Wd.hwRow, x0 = C.P0 + 16;
    const log = [];
    const m0 = Sim.money;
    Tl._simulate({ type: "road", rt: 1 }, I(x0, r + 1), I(x0 + 24, r + 1));            // main street east
    Tl._simulate({ type: 'road', rt: 1 }, I(x0 + 8, r - 10), I(x0 + 8, r + 10)); // cross street
    Tl._simulate({ type: 'road', rt: 1 }, I(x0 + 16, r - 10), I(x0 + 16, r + 10));
    Tl._simulate({ type: 'road', rt: 1 }, I(x0 + 8, r - 10), I(x0 + 16, r - 10));
    log.push('roads cost ' + Math.round(m0 - Sim.money) + ', conn tiles ' + Wd.conn.reduce((a, b) => a + b, 0));
    Tl._simulate({ type: 'zone', z: 1 }, I(x0 + 1, r - 9), I(x0 + 15, r - 1));
    Tl._simulate({ type: 'zone', z: 4 }, I(x0 + 1, r + 1), I(x0 + 7, r + 3));
    Tl._simulate({ type: 'zone', z: 6 }, I(x0 + 17, r + 1), I(x0 + 24, r + 3));
    let zc = [0, 0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < Wd.zone.length; i++) zc[Wd.zone[i]]++;
    log.push('zones ' + zc.join(','));
    Tl._simulate({ type: 'svc', key: 'clinic' }, I(x0 + 11, r + 2), I(x0 + 11, r + 2));
    Tl._simulate({ type: 'bulldoze' }, I(x0 + 24, r), I(x0 + 24, r));
    log.push('buildings ' + Sim.buildings.size + ', road at end ' + Wd.road[I(x0 + 24, r)]);
    Tl.setTool(null);
    Game.playLog = log;
  }
  Game.demoCity = demoCity;
  Game.fastForward = fastForward;

  if (typeof window !== 'undefined') {
    (window as any).CB = (window as any).CB || {};
    (window as any).CB.Game = Game;
  }

  export { boot };
  export default Game;
