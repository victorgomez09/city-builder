/**
 * Open Skylines — SVG Road and Path Thumbnail Generators
 */

import { RoadDef, PathDef } from '../types';

/**
 * Top-down cross-section thumbnail of a road profile
 */
export function roadSvg(R: RoadDef): string {
  const L = R.L,
    S = 6; // px per metre
  const W = 10 * S * R.w,
    H = 44;
  let g = '';
  const rect = (x: number, w: number, col: string) => {
    g += `<rect x="${x.toFixed(1)}" y="0" width="${Math.max(0.5, w).toFixed(1)}" height="${H}" fill="${col}"/>`;
  };
  const dash = (x: number, col?: string) => {
    g += `<line x1="${x}" y1="2" x2="${x}" y2="${H - 2}" stroke="${
      col || '#e6e6df'
    }" stroke-width="1" stroke-dasharray="5 4"/>`;
  };
  const solid = (x: number, col: string) => {
    g += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="${col}" stroke-width="1.2"/>`;
  };
  const arrow = (x: number, up: boolean) => {
    g += up
      ? `<path d="M${x} 13l-3 5h6z M${x - 0.6} 18h1.2v12h-1.2z" fill="#fff" opacity="0.85"/>`
      : `<path d="M${x} 31l-3 -5h6z M${x - 0.6} 14h1.2v12h-1.2z" fill="#fff" opacity="0.85"/>`;
  };
  if (!R.car) {
    rect(0, W, '#6b9444');
    rect(W / 2 - 10, 20, R.key === 'bikepath' ? '#7a4a3c' : '#c9c1ad');
    if (R.key === 'bikepath') dash(W / 2);
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${g}</svg>`;
  }
  const asph = R.surf === 'dirt' ? '#8a7458' : '#3c3f44';
  const strip = (ox: number, mirror: boolean) => {
    const X = (u: number) => ox + (mirror ? 10 - u : u) * S;
    const band = (u0: number, u1: number, col: string) => {
      const a = X(u0),
        b = X(u1);
      rect(Math.min(a, b), Math.abs(b - a), col);
    };
    band(0, 10, asph);
    const sw = R.side,
      bw = L.bw;
    const sides = R.w === 2 ? [1] : [0, 1];
    for (const sd of sides) {
      if (sw > 0) band(sd ? 10 - sw : 0, sd ? 10 : sw, R.grp === 'highway' ? '#6b6b66' : '#aeada6');
      if (R.trees && sw > 0) {
        const cx = X(sd ? 10 - sw / 2 : sw / 2);
        g += `<circle cx="${cx}" cy="12" r="4.5" fill="#4f7d34"/><circle cx="${cx}" cy="32" r="4.5" fill="#4f7d34"/>`;
      }
      if (bw > 0) {
        band(sd ? 10 - sw - bw : sw, sd ? 10 - sw : sw + bw, '#3f7a4e');
        if (R.bike === 2)
          band(
            sd ? 10 - sw - bw : sw + bw - 0.35,
            sd ? 10 - sw - bw + 0.35 : sw + bw,
            '#aeada6'
          );
      }
    }
    if (R.surf === 'dirt') return;
    if (R.w === 2) {
      if (R.med === 'paint') solid(X(0.07), '#dfb33a');
      else if (R.med === 'barrier') band(0, 0.4, '#b9b6ad');
      else band(0, L.med, R.med === 'curb' ? '#aeada6' : '#5d8c3c');
      if (R.med === 'trees') g += `<circle cx="${X(0.3)}" cy="22" r="4" fill="#3f6b30"/>`;
      for (let j = 0; j < L.fwd.length - 1; j++) dash(X(5 + (L.fwd[j] + L.fwd[j + 1]) / 2));
      for (const o of L.fwd) arrow(X(5 + o), !mirror);
      if (R.tram)
        for (const o of L.fwd.slice(-1)) {
          solid(X(5 + o - 0.7), '#9095a0');
          solid(X(5 + o + 0.7), '#9095a0');
        }
    } else if (R.oneway) {
      for (let j = 0; j < L.fwd.length - 1; j++) dash(X(5 + (L.fwd[j] + L.fwd[j + 1]) / 2));
      for (const o of L.fwd) arrow(X(5 + o), true);
    } else {
      const mx = L.medX;
      if (R.med === 'curb') band(mx - L.med / 2, mx + L.med / 2, '#aeada6');
      else if (R.grp === 'highway') dash(X(mx));
      else {
        solid(X(mx - 0.13), '#dfb33a');
        solid(X(mx + 0.13), '#dfb33a');
      }
      for (let j = 0; j < L.fwd.length - 1; j++) dash(X(5 + (L.fwd[j] + L.fwd[j + 1]) / 2));
      for (let j = 0; j < L.back.length - 1; j++) dash(X(5 - (L.back[j] + L.back[j + 1]) / 2));
      for (const o of L.fwd) arrow(X(5 + o), true);
      for (const o of L.back) arrow(X(5 - o), false);
      if (R.tram)
        for (const x of [5 + L.fwd[0], 5 - L.back[0]]) {
          solid(X(x - 0.7), '#9095a0');
          solid(X(x + 0.7), '#9095a0');
        }
    }
  };
  if (R.w === 2) {
    strip(0, true);
    strip(10 * S, false);
  } else strip(0, false);
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${g}</svg>`;
}

/**
 * Top-down cross-section thumbnail of a pedestrian/bike path profile
 */
export function pathSvg(P: PathDef): string {
  return `<svg viewBox="0 0 60 44" preserveAspectRatio="none"><rect width="60" height="44" fill="#6b9444"/><rect x="0" y="0" width="30" height="44" fill="#aeada6" opacity="0.35"/><rect x="11" y="0" width="8" height="44" fill="${
    P.col
  }"/><rect x="11" y="18" width="38" height="8" fill="${P.col}"/>${
    P.key === 'shared'
      ? '<line x1="15" y1="2" x2="15" y2="16" stroke="#f2c230" stroke-dasharray="3 3"/><line x1="22" y1="22" x2="47" y2="22" stroke="#f2c230" stroke-dasharray="3 3"/><rect x="10" y="0" width="1" height="44" fill="#eee"/><rect x="19" y="0" width="1" height="18" fill="#eee"/>'
      : ''
  }${
    P.key === 'bike'
      ? '<line x1="15" y1="2" x2="15" y2="16" stroke="#fff" stroke-dasharray="3 3"/><line x1="22" y1="22" x2="47" y2="22" stroke="#fff" stroke-dasharray="3 3"/>'
      : ''
  }<text x="44" y="11" fill="#fff" font-size="8" text-anchor="middle" opacity="0.8">½</text></svg>`;
}
