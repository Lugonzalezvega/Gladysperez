// Respaldo semanal: exporta las tablas a CSV en la carpeta "respaldo/".
// El workflow luego lo cifra con BACKUP_PASSWORD antes de guardarlo como artefacto.
import { mkdirSync, writeFileSync } from 'node:fs';
import { aCsv } from '../src/lib/csv.ts';
import { faltanSecretos, iniciarSesion, leerTodo } from './supabase-rest.ts';

const faltan = faltanSecretos(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'GLADYS_EMAIL', 'GLADYS_PASSWORD']);
if (faltan.length) {
  console.log(`Respaldo no configurado: faltan los secretos ${faltan.join(', ')}.`);
  process.exit(1);
}

const s = await iniciarSesion();
mkdirSync('respaldo', { recursive: true });
for (const [tabla, nombre] of [
  ['properties', 'propiedades'],
  ['clients', 'clientes'],
  ['tasks', 'tareas'],
  ['settings', 'ajustes'],
  ['historial', 'historial'],
] as const) {
  const filas = await leerTodo(s, tabla);
  const planas = filas.map((f) =>
    Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v !== null && typeof v === 'object' ? JSON.stringify(v) : v])),
  );
  writeFileSync(`respaldo/${nombre}.csv`, '﻿' + aCsv(planas));
  console.log(`${nombre}: ${filas.length} filas`);
}
