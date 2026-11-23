import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Handshake, TrendingUp, Wallet } from 'lucide-react';
import { useAjustes, useTabla } from '../data/hooks.ts';
import { almacen } from '../data/store.ts';
import { comision, resumirComisiones } from '../lib/comisiones.ts';
import { ESTADOS } from '../lib/constantes.ts';
import { formatoDinero, hoyISO } from '../lib/texto.ts';
import { Etiquetas, Titulo, Vacio } from '../components/ui.tsx';

function Kpi({ titulo, valor, detalle, icono: Icono }: { titulo: string; valor: string; detalle?: string; icono: typeof Wallet }) {
  return (
    <div className="tarjeta">
      <div className="flex items-center gap-2 text-sm text-stone-500">
        <Icono className="h-4 w-4" aria-hidden /> {titulo}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{valor}</p>
      {detalle && <p className="text-xs text-stone-500">{detalle}</p>}
    </div>
  );
}

export function Resumen() {
  const propiedades = useTabla('properties');
  const tareas = useTabla('tasks');
  const clientes = useTabla('clients');
  const ajustes = useAjustes();
  const prob = ajustes?.probabilidad_cierre ?? 60;
  const r = useMemo(() => resumirComisiones(propiedades, prob), [propiedades, prob]);
  const hoy = hoyISO();
  const deHoy = tareas.filter((t) => t.fecha === hoy).sort((a, b) => (a.hora ?? '99').localeCompare(b.hora ?? '99'));
  const negociando = propiedades.filter((p) => p.estado === 'En Negociación');
  const max = Math.max(1, ...r.ultimos6.map((m) => m.total));
  const nombreCliente = (id: string | null) => (id ? clientes.find((c) => c.id === id)?.nombre : undefined);

  return (
    <div className="space-y-4">
      <Titulo>Resumen</Titulo>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icono={Wallet} titulo="Ganado este mes" valor={formatoDinero(r.ganadoMes)} />
        <Kpi icono={TrendingUp} titulo="Ganado este año" valor={formatoDinero(r.ganadoAnio)} />
        <Kpi icono={Handshake} titulo="En negociación" valor={formatoDinero(r.negociacionTotal)} detalle={`${negociando.length} propiedades`} />
        <div className="tarjeta">
          <div className="flex items-center gap-2 text-sm text-stone-500">
            <Handshake className="h-4 w-4" aria-hidden /> Ponderado
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatoDinero(r.negociacionPonderada)}</p>
          <label className="mt-1 flex items-center gap-2 text-xs text-stone-500">
            Probabilidad
            <input
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              className="campo !w-20 !py-1 !text-sm"
              value={prob}
              onChange={(e) => {
                const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                void almacen.guardarAjustes({ probabilidad_cierre: v });
              }}
            />
            %
          </label>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="tarjeta">
          <h2 className="mb-3 font-semibold">Comisiones de los últimos 6 meses</h2>
          <div className="flex h-44 items-end gap-2" role="img" aria-label="Gráfica de comisiones por mes">
            {r.ultimos6.map((m) => (
              <div key={m.mes} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] tabular-nums text-stone-500">{m.total ? formatoDinero(m.total) : ''}</span>
                <div
                  className="w-full rounded-t-lg bg-valle-500"
                  style={{ height: `${Math.max(2, (m.total / max) * 120)}px` }}
                  title={`${m.etiqueta}: ${formatoDinero(m.total)}`}
                />
                <span className="text-xs capitalize text-stone-500">{m.etiqueta}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="tarjeta">
          <h2 className="mb-3 font-semibold">Inventario</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ESTADOS.map((e) => (
              <Link key={e} to={`/inventario?estado=${encodeURIComponent(e)}`} className="rounded-xl bg-stone-100 p-3 text-center dark:bg-stone-800">
                <p className="text-2xl font-bold">{r.porEstado[e]}</p>
                <p className="text-xs text-stone-500">{e}</p>
              </Link>
            ))}
          </div>
          <h3 className="mb-2 mt-4 text-sm font-semibold text-stone-500">Disponibles por tipo y operación</h3>
          {Object.keys(r.disponibles).length === 0 ? (
            <p className="text-sm text-stone-500">No hay propiedades disponibles.</p>
          ) : (
            <ul className="space-y-1">
              {Object.entries(r.disponibles).map(([k, n]) => (
                <li key={k} className="flex justify-between text-sm">
                  <span>{k}</span>
                  <span className="font-semibold tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <CalendarCheck className="h-5 w-5" aria-hidden /> Tareas de hoy
          </h2>
          {deHoy.length === 0 ? (
            <Vacio>Nada agendado para hoy.</Vacio>
          ) : (
            <ul className="space-y-2">
              {deHoy.map((t) => (
                <li key={t.id} className={`tarjeta flex items-center gap-3 !py-3 ${t.hecha ? 'opacity-60' : ''}`}>
                  <input
                    type="checkbox"
                    className="h-6 w-6 accent-valle-700"
                    checked={t.hecha}
                    onChange={(e) => void almacen.guardar('tasks', { id: t.id, hecha: e.target.checked })}
                    aria-label="Hecha"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-medium ${t.hecha ? 'line-through' : ''}`}>{t.texto || t.tipo}</p>
                    <p className="text-xs text-stone-500">
                      {t.tipo}
                      {t.hora ? ` · ${t.hora.slice(0, 5)}` : ''}
                      {nombreCliente(t.client_id) ? ` · ${nombreCliente(t.client_id)}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link to="/agenda" className="mt-2 inline-block text-sm font-medium text-valle-700 dark:text-sky-300">
            Ver agenda completa →
          </Link>
        </section>

        <section>
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <Handshake className="h-5 w-5" aria-hidden /> Negociaciones activas
          </h2>
          {negociando.length === 0 ? (
            <Vacio>No hay negociaciones activas.</Vacio>
          ) : (
            <ul className="space-y-2">
              {negociando.map((p) => (
                <li key={p.id} className="tarjeta !py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.direccion || 'Sin dirección'}</p>
                      <Etiquetas tipo={p.tipo} operacion={p.operacion} />
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">{formatoDinero(p.precio)}</p>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">Comisión {formatoDinero(comision(p))}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
