/**
 * Pool de objetos genérico para evitar alocaciones en el bucle de ejecución (Zero GC Pressure).
 */
export class ObjectPool<T> {
  private readonly _pool: T[] = [];
  private readonly _factory: () => T;
  private readonly _reset?: (item: T) => void;

  constructor(factory: () => T, reset?: (item: T) => void, initialSize: number = 0) {
    this._factory = factory;
    this._reset = reset;

    for (let i = 0; i < initialSize; i++) {
      this._pool.push(this._factory());
    }
  }

  /**
   * Obtiene una instancia disponible del pool o crea una nueva si está vacío.
   */
  acquire(): T {
    return this._pool.pop() ?? this._factory();
  }

  /**
   * Devuelve una instancia al pool para su reutilización.
   */
  release(item: T): void {
    if (this._reset) {
      this._reset(item);
    }
    this._pool.push(item);
  }

  /**
   * Cantidad de objetos actualmente en reserva en el pool.
   */
  get size(): number {
    return this._pool.length;
  }
}
