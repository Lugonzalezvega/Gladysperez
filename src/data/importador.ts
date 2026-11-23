import { enlacesDeAjustes, planificarImportacion, resumenPlan, type PlanImportacion } from '../lib/importar.ts';
import { hoyISO } from '../lib/texto.ts';
import { almacen } from './store.ts';

// Con la app abierta, la hoja se revisa cada 2 minutos.
const CADA = 2 * 60 * 1000;

async function aplicarPlan(plan: PlanImportacion) {
  for (const n of plan.clientes.nuevos) await almacen.guardar('clients', { id: n.id, ...n.campos });
  for (const c of plan.clientes.cambios) await almacen.guardar('clients', { id: c.id, ...c.cambios });
  for (const n of plan.propiedades.nuevas) await almacen.guardar('properties', { id: n.id, ...n.campos });
  for (const c of plan.propiedades.cambios) await almacen.guardar('properties', { id: c.id, ...c.cambios });
  for (const t of plan.tareas) {
    if (!almacen.obtener('tasks', t.id)) await almacen.guardar('tasks', { ...t, hecha: false, hora: null, llamo: null });
  }
}

/** Importa un texto CSV (archivo elegido a mano o descargado de Drive). */
export async function importarCsv(texto: string, userId: string): Promise<string> {
  // Antes de comparar, asegura que la copia local esté al día (evita pisar datos).
  if (navigator.onLine) await almacen.esperarPrimeraDescarga();
  const plan = await planificarImportacion(texto, {
    userId,
    hoy: hoyISO(),
    clientesExistentes: almacen.todas('clients') as never,
    propiedadesExistentes: almacen.todas('properties') as never,
  });
  await aplicarPlan(plan);
  return resumenPlan(plan);
}

/** Descarga cada hoja configurada en Ajustes y la importa. */
export async function importarDesdeDrive(userId: string): Promise<string> {
  const ajustes = almacen.ajustes();
  const enlaces = enlacesDeAjustes(ajustes?.drive_url ?? '');
  if (!enlaces.length) throw new Error('Primero pega en Ajustes el enlace de tu hoja de Google Sheets.');
  if (!navigator.onLine) throw new Error('Sin conexión: la importación se hará cuando vuelva el internet.');

  const resultados: string[] = [];
  for (const url of enlaces) {
    let texto: string;
    try {
      const r = await fetch(url, { credentials: 'omit', redirect: 'follow', cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      texto = await r.text();
    } catch {
      throw new Error(
        'No pude descargar la hoja. Revisa que esté publicada en la web como CSV. ' +
          'Si sigue fallando, la importación automática de GitHub la traerá en menos de 15 minutos.',
      );
    }
    if (/^\s*<!doctype html|<html/i.test(texto)) {
      throw new Error('La hoja no es pública. En Google Sheets usa Archivo › Compartir › Publicar en la web › CSV.');
    }
    resultados.push(await importarCsv(texto, userId));
  }
  await almacen.guardarAjustes({ ultima_importacion: new Date().toISOString() });
  return resultados.join(' ');
}

/** Importación automática mientras la app está abierta (cada 2 min). */
export async function importarSiToca(userId: string): Promise<void> {
  const a = almacen.ajustes();
  if (!a?.drive_url || !navigator.onLine) return;
  const ultima = a.ultima_importacion ? Date.parse(a.ultima_importacion) : 0;
  if (Date.now() - ultima < CADA) return;
  try {
    await importarDesdeDrive(userId);
  } catch {
    /* silencioso: el workflow de GitHub también importa */
  }
}
