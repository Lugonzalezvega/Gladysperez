import { useSyncExternalStore } from 'react';
import type { FilasPorTabla, Tabla } from '../lib/tipos.ts';
import { almacen, type InfoSync } from './store.ts';

export function useTabla<T extends Tabla>(tabla: T): FilasPorTabla[T][] {
  return useSyncExternalStore(almacen.suscribir, () => almacen.filas(tabla));
}

export function useSync(): InfoSync {
  return useSyncExternalStore(almacen.suscribir, almacen.estadoSync);
}

export function useAjustes() {
  const filas = useTabla('settings');
  return filas[0] ?? null;
}
