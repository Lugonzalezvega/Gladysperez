import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { configuracionLista } from './data/supabase.ts';
import { useSesion } from './data/sesion.ts';
import { almacen } from './data/store.ts';
import { useSync } from './data/hooks.ts';
import { importarSiToca } from './data/importador.ts';
import { Layout } from './components/Layout.tsx';
import { ActualizarApp } from './components/ActualizarApp.tsx';
import { Login } from './pages/Login.tsx';
import { SinConfiguracion } from './pages/SinConfiguracion.tsx';
import { Resumen } from './pages/Resumen.tsx';
import { Inventario } from './pages/Inventario.tsx';
import { Clientes } from './pages/Clientes.tsx';
import { Matching } from './pages/Matching.tsx';
import { Agenda } from './pages/Agenda.tsx';
import { Ajustes } from './pages/Ajustes.tsx';
import { Indicadores } from './pages/Indicadores.tsx';

function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-stone-500" role="status">
      <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
      <p>{texto}</p>
    </div>
  );
}

export default function App() {
  const sesion = useSesion();
  const userId = sesion?.user.id ?? null;
  const [errorInicio, setErrorInicio] = useState<string | null>(null);
  const sync = useSync();

  useEffect(() => {
    if (!userId) return;
    almacen.iniciar(userId).catch(() =>
      setErrorInicio('No se pudo abrir la base de datos del teléfono. Revisa que el navegador no esté en modo privado.'),
    );
  }, [userId]);

  // Importación automática desde Drive mientras la app está abierta.
  useEffect(() => {
    if (!userId || !sync.primeraDescarga) return;
    void importarSiToca(userId);
    const t = setInterval(() => void importarSiToca(userId), 60_000);
    return () => clearInterval(t);
  }, [userId, sync.primeraDescarga]);

  if (!configuracionLista) return <SinConfiguracion />;
  if (sesion === undefined) return <Cargando />;

  return (
    <>
      <ActualizarApp />
      {!sesion ? (
        <Login />
      ) : errorInicio ? (
        <div className="p-6 text-center text-red-700">{errorInicio}</div>
      ) : !sync.listo ? (
        <Cargando texto="Abriendo tus datos…" />
      ) : (
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Resumen />} />
              <Route path="inventario" element={<Inventario />} />
              <Route path="clientes" element={<Clientes />} />
              <Route path="matching" element={<Matching />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="embudo" element={<Indicadores />} />
              <Route
                path="ajustes"
                element={sync.esAdmin ? <Ajustes userId={sesion.user.id} correo={sesion.user.email ?? ''} /> : <Navigate to="/" replace />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      )}
    </>
  );
}
