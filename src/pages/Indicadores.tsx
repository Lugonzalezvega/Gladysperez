import { useMemo, useState } from 'react';
import { FileDown } from 'lucide-react';
import { useTabla } from '../data/hooks.ts';
import { agrupar, anguloDe, calcularEmbudo, canalDe, leadsDe, rangoRapido, textoPeriodo, type Embudo, type FilaGrupo, type FiltroEmbudo } from '../lib/embudo.ts';
import { hoyISO } from '../lib/texto.ts';
import type { Cliente } from '../lib/tipos.ts';
import { Titulo, Vacio } from '../components/ui.tsx';
import { InformePdf } from '../components/InformePdf.tsx';

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—');

/** Barras del embudo: cada paso con sí / no / sin registrar. */
export function BarrasEmbudo({ e, compacto = false }: { e: Embudo; compacto?: boolean }) {
  const max = Math.max(1, e.leads);
  const filas = [
    { titulo: 'Leads recibidos', si: e.leads, no: 0, pendiente: 0, base: e.leads, texto: 'total del periodo' },
    ...e.pasos.map((p) => ({ titulo: p.titulo, si: p.si, no: p.no, pendiente: p.pendiente, base: p.base_total, texto: p.baseTexto })),
  ];
  return (
    <ol className={compacto ? 'space-y-2' : 'space-y-3'}>
      {filas.map((f, i) => (
        <li key={f.titulo}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold">{f.titulo}</span>
            <span className="tabular-nums text-stone-600 dark:text-stone-400 print:text-stone-700">
              {i === 0 ? <b>{f.si}</b> : <><b>{f.si}</b> de {f.base} {f.texto} · <b>{pct(f.si, f.base)}</b></>}
            </span>
          </div>
          <div className="mt-1 flex h-4 overflow-hidden rounded-md bg-stone-200 dark:bg-stone-800 print:bg-stone-200" aria-hidden>
            <div className="bg-valle-700" style={{ width: `${(f.si / max) * 100}%` }} />
            <div className="bg-rose-400/80" style={{ width: `${(f.no / max) * 100}%` }} />
            <div className="bg-stone-400/60" style={{ width: `${(f.pendiente / max) * 100}%` }} />
          </div>
          {i > 0 && (f.no > 0 || f.pendiente > 0) && (
            <p className="mt-0.5 text-xs text-stone-500">
              {f.no > 0 && <>No: {f.no}</>}
              {f.no > 0 && f.pendiente > 0 && ' · '}
              {f.pendiente > 0 && <>Sin registrar: {f.pendiente}</>}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

export function TablaGrupos({ filas, titulo }: { filas: FilaGrupo[]; titulo: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-300 text-left text-xs uppercase tracking-wide text-stone-500 dark:border-stone-700">
            <th className="py-2 pr-2 font-semibold">{titulo}</th>
            <th className="px-2 text-right font-semibold">Leads</th>
            <th className="px-2 text-right font-semibold">Responden</th>
            <th className="px-2 text-right font-semibold">Agendan</th>
            <th className="px-2 text-right font-semibold">Asisten</th>
            <th className="pl-2 text-right font-semibold">Ofertas</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.nombre} className="border-b border-stone-200 last:border-0 dark:border-stone-800">
              <td className="py-2 pr-2">{f.nombre}</td>
              <td className="px-2 text-right font-semibold tabular-nums">{f.leads}</td>
              <td className="px-2 text-right tabular-nums">{f.respondio} <span className="text-stone-500">({pct(f.respondio, f.leads)})</span></td>
              <td className="px-2 text-right tabular-nums">{f.agendo}</td>
              <td className="px-2 text-right tabular-nums">{f.asistio}</td>
              <td className="pl-2 text-right tabular-nums">{f.oferta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface DatosIndicadores {
  leads: Cliente[];
  embudo: Embudo;
  porPropiedad: FilaGrupo[];
  porCanal: FilaGrupo[];
  porAngulo: FilaGrupo[];
}

export function calcularIndicadores(clientes: Cliente[], filtro: FiltroEmbudo): DatosIndicadores {
  const leads = leadsDe(clientes, filtro);
  return {
    leads,
    embudo: calcularEmbudo(leads),
    porPropiedad: agrupar(leads, (c) => c.propiedad_interes || 'Sin propiedad'),
    porCanal: agrupar(leads, (c) => canalDe(c.fuente)),
    porAngulo: agrupar(
      leads.filter((c) => anguloDe(c.fuente)),
      (c) => `${canalDe(c.fuente)} · ${anguloDe(c.fuente)}`,
    ),
  };
}

export function Indicadores() {
  const clientes = useTabla('clients');
  const [filtro, setFiltro] = useState<FiltroEmbudo>({});

  const todos = useMemo(() => leadsDe(clientes), [clientes]);
  const propiedades = useMemo(() => [...new Set(todos.map((c) => c.propiedad_interes || 'Sin propiedad'))].sort(), [todos]);
  const canales = useMemo(() => [...new Set(todos.map((c) => canalDe(c.fuente)))].sort(), [todos]);
  const d = useMemo(() => calcularIndicadores(clientes, filtro), [clientes, filtro]);
  const [r, a, s, , o] = d.embudo.pasos;

  const kpis = [
    { titulo: 'Leads recibidos', valor: String(d.embudo.leads), detalle: textoPeriodo(filtro) },
    { titulo: 'Responden', valor: pct(r.si, r.base_total), detalle: `${r.si} de ${r.base_total} leads` },
    { titulo: 'Agendan cita', valor: pct(a.si, a.base_total), detalle: `${a.si} de ${a.base_total} que responden` },
    { titulo: 'Asisten a la cita', valor: pct(s.si, s.base_total), detalle: `${s.si} de ${s.base_total} que agendan` },
    { titulo: 'Hacen oferta', valor: pct(o.si, o.base_total), detalle: `${o.si} de ${o.base_total} que visitan` },
  ];

  const selector = (etiqueta: string, valor: string | undefined, opciones: string[], clave: keyof FiltroEmbudo, mostrar = (x: string) => x) => (
    <label className="block">
      <span className="etiqueta-campo">{etiqueta}</span>
      <select className="campo" value={valor ?? ''} onChange={(e) => setFiltro({ ...filtro, [clave]: e.target.value || undefined })}>
        <option value="">Todos</option>
        {opciones.map((x) => (
          <option key={x} value={x}>{mostrar(x)}</option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <div className="space-y-4 print:hidden">
        <Titulo
          accion={
            <button className="btn-primario" onClick={() => window.print()} disabled={!d.embudo.leads}>
              <FileDown className="h-5 w-5" /> Descargar PDF
            </button>
          }
        >
          Embudo de leads
        </Titulo>

        <section className="tarjeta space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="etiqueta-campo">Desde</span>
              <input
                type="date"
                className="campo"
                value={filtro.desde ?? ''}
                max={filtro.hasta}
                onChange={(e) => setFiltro({ ...filtro, desde: e.target.value || undefined })}
              />
            </label>
            <label className="block">
              <span className="etiqueta-campo">Hasta</span>
              <input
                type="date"
                className="campo"
                value={filtro.hasta ?? ''}
                min={filtro.desde}
                onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value || undefined })}
              />
            </label>
            {selector('Propiedad', filtro.propiedad, propiedades, 'propiedad')}
            {selector('Red / fuente', filtro.canal, canales, 'canal')}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Periodos rápidos">
            {([
              ['Últimos 7 días', '7dias'],
              ['Este mes', 'mes'],
              ['Mes anterior', 'mesAnterior'],
            ] as const).map(([t, tipo]) => {
              const r = rangoRapido(tipo, hoyISO());
              const activo = filtro.desde === r.desde && filtro.hasta === r.hasta;
              return (
                <button key={tipo} className={activo ? 'chip-on' : 'chip-off'} onClick={() => setFiltro({ ...filtro, ...r })}>
                  {t}
                </button>
              );
            })}
            <button
              className={!filtro.desde && !filtro.hasta ? 'chip-on' : 'chip-off'}
              onClick={() => setFiltro({ ...filtro, desde: undefined, hasta: undefined })}
            >
              Todo
            </button>
          </div>
          <p className="text-sm text-stone-500">Periodo: <b className="text-stone-700 dark:text-stone-300">{textoPeriodo(filtro)}</b> · según la fecha en que llegó cada lead.</p>
        </section>

        {!d.embudo.leads ? (
          <Vacio>No hay leads con ese filtro. Los leads llegan solos desde la hoja de Drive o se crean en Clientes.</Vacio>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {kpis.map((k) => (
                <div key={k.titulo} className="tarjeta">
                  <p className="text-sm text-stone-500">{k.titulo}</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{k.valor}</p>
                  <p className="text-xs text-stone-500">{k.detalle}</p>
                </div>
              ))}
            </div>

            <section className="tarjeta">
              <h2 className="mb-3 font-semibold">Embudo</h2>
              <BarrasEmbudo e={d.embudo} />
              <p className="mt-3 flex flex-wrap gap-4 text-xs text-stone-500">
                <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-valle-700" /> Sí</span>
                <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-rose-400/80" /> No</span>
                <span className="flex items-center gap-1.5"><i className="inline-block h-3 w-3 rounded-sm bg-stone-400/60" /> Sin registrar</span>
              </p>
              <p className="mt-2 text-xs text-stone-500">
                Para que el embudo avance, en <b>Clientes</b> abre “Embudo” en la tarjeta de cada lead y marca Sí o No en cada paso.
              </p>
            </section>

            <section className="tarjeta">
              <h2 className="mb-2 font-semibold">Leads por propiedad</h2>
              <TablaGrupos filas={d.porPropiedad} titulo="Propiedad" />
            </section>

            <section className="tarjeta">
              <h2 className="mb-2 font-semibold">Leads por red social</h2>
              <TablaGrupos filas={d.porCanal} titulo="Red" />
            </section>

            {d.porAngulo.length > 0 && (
              <section className="tarjeta">
                <h2 className="mb-2 font-semibold">Leads por ángulo del anuncio</h2>
                <TablaGrupos filas={d.porAngulo} titulo="Red · ángulo" />
              </section>
            )}
          </>
        )}
      </div>

      <InformePdf datos={d} filtro={filtro} />
    </>
  );
}
