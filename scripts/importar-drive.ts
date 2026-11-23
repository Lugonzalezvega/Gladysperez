// Importación automática desde Google Sheets (la ejecuta GitHub Actions cada 15 minutos).
// Uso local: node --experimental-strip-types scripts/importar-drive.ts
import { enlacesDeAjustes, planificarImportacion, resumenPlan, type Existente } from '../src/lib/importar.ts';
import { hoyISO } from '../src/lib/texto.ts';
import { faltanSecretos, iniciarSesion, leerTodo, rest } from './supabase-rest.ts';

const faltan = faltanSecretos(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'GLADYS_EMAIL', 'GLADYS_PASSWORD']);
if (faltan.length) {
  console.log(`Importación automática desactivada: faltan los secretos ${faltan.join(', ')}.`);
  process.exit(0);
}

const s = await iniciarSesion();
const [ajustes] = (await (await rest(s, 'settings?select=drive_url&deleted_at=is.null')).json()) as Array<{ drive_url: string }>;
const enlaces = enlacesDeAjustes(ajustes?.drive_url ?? '');
if (!enlaces.length) {
  console.log('No hay enlace de Google Sheets en Ajustes. Nada que importar.');
  process.exit(0);
}

let fallos = 0;
for (const [i, url] of enlaces.entries()) {
  try {
    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const csv = await r.text();
    if (/^\s*<!doctype html|<html/i.test(csv)) throw new Error('la hoja no está publicada como CSV');

    const plan = await planificarImportacion(csv, {
      userId: s.userId,
      hoy: hoyISO('America/Guayaquil'),
      clientesExistentes: await leerTodo<Existente>(s, 'clients'),
      propiedadesExistentes: await leerTodo<Existente>(s, 'properties'),
    });

    const upsert = (tabla: string, filas: object[], ignorar = false) =>
      filas.length
        ? rest(s, `${tabla}?on_conflict=id`, {
            method: 'POST',
            headers: { Prefer: `resolution=${ignorar ? 'ignore' : 'merge'}-duplicates,return=minimal` },
            body: JSON.stringify(filas),
          })
        : null;

    await upsert('clients', plan.clientes.nuevos.map((n) => ({ id: n.id, etapa: 'Nuevo', ...n.campos })));
    await upsert('properties', plan.propiedades.nuevas.map((n) => ({ id: n.id, ...n.campos })));
    // Las tareas "Llamar a …" nunca pisan una existente (quizá ya se marcó como hecha).
    await upsert('tasks', plan.tareas, true);
    for (const c of plan.clientes.cambios) {
      await rest(s, `clients?id=eq.${c.id}`, { method: 'PATCH', body: JSON.stringify(c.cambios), headers: { Prefer: 'return=minimal' } });
    }
    for (const c of plan.propiedades.cambios) {
      await rest(s, `properties?id=eq.${c.id}`, { method: 'PATCH', body: JSON.stringify(c.cambios), headers: { Prefer: 'return=minimal' } });
    }
    console.log(`Hoja ${i + 1}: ${resumenPlan(plan)}`); // solo cantidades, nunca nombres ni teléfonos
  } catch (e) {
    fallos++;
    console.log(`Hoja ${i + 1}: no se pudo importar (${(e as Error).message}).`);
  }
}

if (fallos < enlaces.length) {
  await rest(s, `settings?user_id=eq.${s.userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ ultima_importacion: new Date().toISOString() }),
    headers: { Prefer: 'return=minimal' },
  });
}
process.exit(fallos ? 1 : 0);
