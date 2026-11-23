import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase.ts';

/** undefined = cargando · null = sin sesión · Session = con sesión */
export function useSesion(): Session | null | undefined {
  const [sesion, setSesion] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    if (!supabase) {
      setSesion(null);
      return;
    }
    // getSession lee la sesión guardada: funciona sin conexión.
    void supabase.auth.getSession().then(({ data }) => setSesion(data.session));
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSesion(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return sesion;
}
