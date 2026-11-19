/**
 * Open Skylines — DOM Query and Manipulation Utilities for UI
 *
 * Lightweight, type-safe helpers for querying elements, updating reactive labels,
 * drawing sparkline canvases, and rendering consistent panel headers and meters.
 */

import { U } from '@/core/utils';

/**
 * Type-safe getElementById
 */
export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  return document.getElementById(id) as T;
};

/**
 * Type-safe querySelectorAll returning an Array
 */
export const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T[] => {
  return Array.from(root.querySelectorAll<T>(sel));
};

/**
 * Type-safe querySelector
 */
export const q = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T | null => {
  return root.querySelector<T>(sel);
};

/**
 * Common header markup for UI modal side-panels
 */
export const head = (title: string, sub?: string): string =>
  `<div class="phead"><div><h3>${title}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div><button class="x" data-close aria-label="Close">×</button></div>`;

/**
 * Bind the close button click handler for a side-panel
 */
export function bindClose(p: HTMLElement, fn: () => void): void {
  const btn = q<HTMLElement>('[data-close]', p);
  if (btn) btn.onclick = fn;
}

/**
 * Safely update textContent of a data-v attribute node only when the value changes
 */
export function sv(root: HTMLElement, k: string, v: string | number): void {
  const e = q<HTMLElement>(`[data-v="${k}"]`, root);
  if (e && e.textContent !== String(v)) {
    e.textContent = String(v);
  }
}

/**
 * Safely update width percentage of a meter bar
 */
export function sm(root: HTMLElement, k: string, frac: number, col?: string): void {
  const e = q<HTMLElement>(`[data-m="${k}"]`, root);
  if (e) {
    e.style.width = (U.clamp(frac, 0, 1) * 100).toFixed(1) + '%';
    if (col) e.style.background = col;
  }
}

/**
 * Health/Happiness color threshold utility
 */
export const goodCol = (f: number): string => (f > 0.66 ? 'var(--good)' : f > 0.4 ? 'var(--warn)' : 'var(--bad)');

/**
 * Meter HTML markup
 */
export const meter = (k: string): string => `<div class="meter"><i data-m="${k}"></i></div>`;

/**
 * Render a 2D sparkline chart onto a HTML canvas element
 */
export function spark(cv: HTMLCanvasElement | null, vals: number[], col: string): void {
  if (!cv) return;
  const g = cv.getContext('2d');
  if (!g) return;
  const w = cv.width, h = cv.height;
  g.clearRect(0, 0, w, h);
  if (vals.length < 2) {
    g.fillStyle = '#93a4b4';
    g.font = '22px Barlow, sans-serif';
    g.fillText('Shown after the first month', 8, h / 2 + 6);
    return;
  }
  const mx = Math.max(...vals), mn = Math.min(0, ...vals), rg = mx - mn || 1;
  g.strokeStyle = 'rgba(160,190,215,0.15)';
  g.lineWidth = 1;
  for (let k = 1; k < 4; k++) {
    g.beginPath();
    g.moveTo(0, h * k / 4);
    g.lineTo(w, h * k / 4);
    g.stroke();
  }
  g.beginPath();
  vals.forEach((v, k) => {
    const x = k / (vals.length - 1) * (w - 8) + 4;
    const y = h - 6 - (v - mn) / rg * (h - 14);
    if (k) g.lineTo(x, y);
    else g.moveTo(x, y);
  });
  g.strokeStyle = col;
  g.lineWidth = 3;
  g.stroke();
  g.lineTo(w - 4, h);
  g.lineTo(4, h);
  g.closePath();
  g.fillStyle = col + '30';
  g.fill();
  const lv = vals[vals.length - 1];
  const ly = h - 6 - (lv - mn) / rg * (h - 14);
  g.fillStyle = col;
  g.beginPath();
  g.arc(w - 4, ly, 5, 0, Math.PI * 2);
  g.fill();
}
