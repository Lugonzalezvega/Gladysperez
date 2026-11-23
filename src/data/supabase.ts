import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Solo la URL y la anon key (públicas). La service_role key NUNCA va aquí.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configuracionLista = Boolean(url && anonKey && /^https:\/\//.test(url));

export const supabase: SupabaseClient | null = configuracionLista
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;

/** Traduce errores comunes a mensajes claros en español. */
export function mensajeError(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e ?? '');
  const s = m.toLowerCase();
  if (s.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (s.includes('email not confirmed')) return 'Falta confirmar el correo de esta cuenta en Supabase.';
  if (s.includes('signups not allowed') || s.includes('signup is disabled')) return 'El registro está desactivado.';
  if (s.includes('rate limit') || s.includes('too many')) return 'Demasiados intentos. Espera un momento y vuelve a intentar.';
  if (s.includes('failed to fetch') || s.includes('networkerror') || s.includes('network request failed'))
    return 'Sin conexión a internet. Los cambios se guardan en el teléfono y se enviarán después.';
  if (s.includes('jwt') || s.includes('not authorized') || s.includes('permission denied') || s.includes('row-level security'))
    return 'Tu sesión expiró o no tienes permiso. Vuelve a iniciar sesión.';
  if (s.includes('violates check constraint')) return 'Algún dato no es válido (revisa números, teléfono o enlace https).';
  if (s.includes('duplicate key')) return 'Ese registro ya existe.';
  return 'Ocurrió un error inesperado. Intenta de nuevo.';
}
