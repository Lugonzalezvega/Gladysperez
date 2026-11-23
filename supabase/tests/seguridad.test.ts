// Ejecuta las migraciones reales en un Postgres embebido (PGlite) con un
// simulacro del esquema "auth" de Supabase y comprueba la seguridad (RLS).
import { beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const U1 = '11111111-1111-1111-1111-111111111111';
const U2 = '22222222-2222-2222-2222-222222222222';
const DIR = join(__dirname, '..', 'migrations');
let db: PGlite;

async function como(uid: string | null) {
  await db.exec(`reset role; set role ${uid ? 'authenticated' : 'anon'};
    select set_config('request.jwt.claim.sub', '${uid ?? ''}', false)`);
}
async function falla(sql: string, params: unknown[] = []) {
  try {
    await db.query(sql, params);
    return false;
  } catch {
    return true;
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create publication supabase_realtime;
    insert into auth.users values ('${U1}'), ('${U2}');`);
  const archivos = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
  for (let i = 0; i < 2; i++) for (const f of archivos) await db.exec(readFileSync(join(DIR, f), 'utf8')); // 2 veces: idempotentes
}, 60_000);

describe('migraciones y seguridad (RLS)', () => {
  let propId = '';

  it('la dueña crea filas con user_id = auth.uid() y updated_at del servidor', async () => {
    await como(U1);
    const p = (await db.query<{ id: string; user_id: string; updated_at: Date }>(
      `insert into properties (precio, direccion) values (200000, 'Tumbaco') returning *`,
    )).rows[0];
    propId = p.id;
    expect(p.user_id).toBe(U1);
    const p2 = (await db.query<{ updated_at: Date; cerrado_en: Date | null }>(
      `update properties set estado = 'Vendido', updated_at = '2000-01-01' where id = $1 returning *`, [propId],
    )).rows[0];
    expect(p2.updated_at.getFullYear()).toBeGreaterThan(2000);
    expect(p2.cerrado_en).not.toBeNull();
    const p3 = (await db.query<{ cerrado_en: Date | null }>(`update properties set estado = 'Disponible' where id = $1 returning *`, [propId])).rows[0];
    expect(p3.cerrado_en).toBeNull();
  });

  it('valida datos: https, external_key único, una fila de ajustes', async () => {
    await como(U1);
    expect(await falla(`insert into properties (link_fotos) values ('http://x.com')`)).toBe(true);
    await db.query(`insert into clients (nombre, external_key) values ('Ana', 'tel:593999123456')`);
    expect(await falla(`insert into clients (external_key) values ('tel:593999123456')`)).toBe(true);
    await db.query(`insert into settings default values`);
    expect(await falla(`insert into settings default values`)).toBe(true);
  });

  it('guarda historial (una versión por hora) que el navegador no puede escribir', async () => {
    await como(U1);
    const n = (await db.query<{ n: number }>(`select count(*)::int n from historial where fila_id = $1`, [propId])).rows[0].n;
    expect(n).toBe(1);
    expect(await falla(`insert into historial (user_id, tabla, fila_id, hora, datos) values ($1, 'x', gen_random_uuid(), now(), '{}')`, [U1])).toBe(true);
  });

  it('otra cuenta no ve ni toca nada de la dueña', async () => {
    await como(U2);
    for (const t of ['properties', 'clients', 'settings', 'historial']) {
      expect((await db.query(`select * from ${t}`)).rows).toHaveLength(0);
    }
    expect((await db.query(`update properties set precio = 1 where id = $1`, [propId])).affectedRows).toBe(0);
    expect((await db.query(`delete from properties where id = $1`, [propId])).affectedRows).toBe(0);
    expect(await falla(`insert into properties (user_id) values ($1)`, [U1])).toBe(true);
    await db.query(`insert into properties default values`);
    await db.query(`update properties set user_id = $1`, [U1]).catch(() => null);
    expect((await db.query<{ user_id: string }>(`select user_id from properties`)).rows[0].user_id).toBe(U2);
  });

  it('sin sesión (anon) no hay acceso a ninguna tabla; solo ping()', async () => {
    await como(null);
    for (const t of ['properties', 'clients', 'tasks', 'settings', 'historial']) {
      expect(await falla(`select * from ${t}`)).toBe(true);
    }
    expect((await db.query<{ v: number }>(`select public.ping() v`)).rows[0].v).toBe(1);
  });
});
