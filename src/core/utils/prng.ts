/**
 * Generador Pseudoaleatorio Deterministico (PRNG) usando el algoritmo Mulberry32.
 * 
 * Garantiza reproducibilidad absoluta en la simulación lógica, sin importar
 * la plataforma o el navegador, asegurando que un mismo seed produzca el mismo mundo.
 */
export class PRNG {
  private _state: number;

  constructor(seed: number) {
    this._state = seed >>> 0;
  }

  /**
   * Obtiene el siguiente float pseudoaleatorio en el rango [0, 1).
   */
  next(): number {
    let t = (this._state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Obtiene un entero pseudoaleatorio en el rango [min, max] inclusivo.
   */
  rangeInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /**
   * Obtiene un float pseudoaleatorio en el rango [min, max).
   */
  rangeFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  /**
   * Guarda el estado actual para persistencia/serialización.
   */
  getState(): number {
    return this._state;
  }

  /**
   * Restaura el estado interno del generador.
   */
  setState(state: number): void {
    this._state = state >>> 0;
  }
}
