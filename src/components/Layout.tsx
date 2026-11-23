import { NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, Cloud, CloudOff, Home, LayoutDashboard, Loader2, Settings, Sparkles, Users } from 'lucide-react';
import { useSync } from '../data/hooks.ts';

const SECCIONES = [
  { a: '/', texto: 'Resumen', icono: LayoutDashboard },
  { a: '/inventario', texto: 'Inventario', icono: Home },
  { a: '/clientes', texto: 'Clientes', icono: Users },
  { a: '/matching', texto: 'Matching', icono: Sparkles },
  { a: '/agenda', texto: 'Agenda', icono: CalendarDays },
  { a: '/ajustes', texto: 'Ajustes', icono: Settings },
];

export function IndicadorSync() {
  const s = useSync();
  const config = {
    sincronizado: { icono: Cloud, texto: 'Sincronizado', clase: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' },
    sincronizando: { icono: Loader2, texto: s.pendientes ? `Sincronizando (${s.pendientes})` : 'Sincronizando', clase: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200' },
    'sin-conexion': { icono: CloudOff, texto: s.pendientes ? `Sin conexión · ${s.pendientes} por enviar` : 'Sin conexión', clase: 'bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300' },
  }[s.estado];
  const Icono = config.icono;
  return (
    <span className={`pill gap-1.5 py-1 ${config.clase}`} role="status" aria-live="polite" title={s.error ?? undefined}>
      <Icono className={`h-3.5 w-3.5 ${s.estado === 'sincronizando' ? 'animate-spin' : ''}`} aria-hidden />
      {config.texto}
    </span>
  );
}

export function Layout() {
  const s = useSync();
  return (
    <div className="min-h-screen">
      {/* Barra superior (en escritorio incluye el menú) */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur dark:border-stone-800 dark:bg-stone-950/90">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <img src="./favicon.png" alt="" className="h-8 w-8 rounded-lg" />
          <span className="text-lg font-bold text-valle-700 dark:text-valle-100">Gladys en el Valle</span>
          <nav className="ml-6 hidden gap-1 md:flex" aria-label="Secciones">
            {SECCIONES.map(({ a, texto, icono: Icono }) => (
              <NavLink
                key={a}
                to={a}
                end={a === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium ${
                    isActive ? 'bg-valle-700 text-white' : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800'
                  }`
                }
              >
                <Icono className="h-4 w-4" aria-hidden />
                {texto}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto">
            <IndicadorSync />
          </div>
        </div>
        {s.error && s.estado !== 'sincronizado' && (
          <p className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
            {s.error} Reintentando automáticamente.
          </p>
        )}
      </header>

      <main className="pb-seguro mx-auto max-w-6xl px-3 pt-4 md:px-4 md:pb-10">
        <Outlet />
      </main>

      {/* Barra inferior en celular */}
      <nav
        className="barra-inferior fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 bg-white/95 backdrop-blur dark:border-stone-800 dark:bg-stone-950/95 md:hidden"
        aria-label="Secciones"
      >
        <div className="grid grid-cols-6">
          {SECCIONES.map(({ a, texto, icono: Icono }) => (
            <NavLink
              key={a}
              to={a}
              end={a === '/'}
              className={({ isActive }) =>
                `flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                  isActive ? 'text-valle-700 dark:text-sky-300' : 'text-stone-500'
                }`
              }
            >
              <Icono className="h-6 w-6" aria-hidden />
              {texto}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
