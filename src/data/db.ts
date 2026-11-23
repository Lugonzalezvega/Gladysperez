import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Ajustes, Cliente, Propiedad, Tabla, Tarea } from '../lib/tipos.ts';

export interface PendienteSync {
  clave: string; // "tabla:id"
  tabla: Tabla;
  id: string;
  fila: Record<string, unknown>;
  rev: number;
}

interface GladysDB extends DBSchema {
  properties: { key: string; value: Propiedad };
  clients: { key: string; value: Cliente };
  tasks: { key: string; value: Tarea };
  settings: { key: string; value: Ajustes };
  pendientes: { key: string; value: PendienteSync };
  meta: { key: string; value: unknown };
}

export type BaseLocal = IDBPDatabase<GladysDB>;

export const TABLAS: Tabla[] = ['properties', 'clients', 'tasks', 'settings'];

export function abrirBase(): Promise<BaseLocal> {
  return openDB<GladysDB>('gladys-en-el-valle', 1, {
    upgrade(db) {
      for (const t of TABLAS) db.createObjectStore(t, { keyPath: 'id' });
      db.createObjectStore('pendientes', { keyPath: 'clave' });
      db.createObjectStore('meta');
    },
  });
}
