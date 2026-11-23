import { useState, type FormEvent } from 'react';
import { Loader2, LogIn } from 'lucide-react';
import { mensajeError, supabase } from '../data/supabase.ts';
import { Aviso } from '../components/ui.tsx';

export function Login() {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setEnviando(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: correo.trim(), password: clave });
    setEnviando(false);
    if (error) setError(mensajeError(error));
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-valle-700 to-valle-900 p-4">
      <form onSubmit={entrar} className="tarjeta w-full max-w-sm space-y-4 p-6">
        <div className="text-center">
          <img src="./logo-gladys-perez.png" alt="Gladys Pérez, asesora inmobiliaria" className="mx-auto w-full rounded-2xl" />
          <h1 className="mt-4 text-xl font-bold">Gladys en el Valle</h1>
          <p className="text-stone-500">Casas y terrenos · Venta y renta</p>
        </div>
        <label className="block">
          <span className="etiqueta-campo">Correo</span>
          <input className="campo" type="email" autoComplete="username" required value={correo} onChange={(e) => setCorreo(e.target.value)} />
        </label>
        <label className="block">
          <span className="etiqueta-campo">Contraseña</span>
          <input className="campo" type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} />
        </label>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <button className="btn-primario w-full" disabled={enviando}>
          {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
          Entrar
        </button>
        <p className="text-center text-xs text-stone-500">Acceso privado. No hay registro público.</p>
      </form>
    </div>
  );
}
