// Cliente REST mínimo para los workflows de GitHub Actions.
// Entra con el correo y contraseña de la dueña (secretos de GitHub), así
// todo pasa por Row Level Security: no se usa la service_role key.
// Nunca imprime datos de clientes en los registros (que son públicos).

const URL_BASE = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const ANON = process.env.SUPABASE_ANON_KEY ?? '';

export function faltanSecretos(nombres: string[]): string[] {
  return nombres.filter((n) => !process.env[n]);
}

export interface Sesion {
  token: string;
  userId: string;
}

export async function iniciarSesion(): Promise<Sesion> {
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.GLADYS_EMAIL, password: process.env.GLADYS_PASSWORD }),
  });
  if (!r.ok) throw new Error(`No se pudo iniciar sesión (HTTP ${r.status}). Revisa GLADYS_EMAIL y GLADYS_PASSWORD.`);
  const j = (await r.json()) as { access_token: string; user: { id: string } };
  return { token: j.access_token, userId: j.user.id };
}

export async function rest(s: Sesion, ruta: string, init: RequestInit = {}): Promise<Response> {
  const r = await fetch(`${URL_BASE}/rest/v1/${ruta}`, {
    ...init,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${s.token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`Supabase respondió HTTP ${r.status} en ${ruta.split('?')[0]}`);
  return r;
}

/** Lee todas las filas de una tabla, de 1000 en 1000. */
export async function leerTodo<T = Record<string, unknown>>(s: Sesion, tabla: string): Promise<T[]> {
  const todas: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const r = await rest(s, `${tabla}?select=*&order=id.asc&offset=${desde}&limit=1000`);
    const filas = (await r.json()) as T[];
    todas.push(...filas);
    if (filas.length < 1000) return todas;
  }
}
