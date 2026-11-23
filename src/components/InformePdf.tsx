// Informe imprimible (Descargar PDF). No se ve en pantalla: solo al imprimir
// o guardar como PDF. Usa colores fijos (no depende del modo oscuro).
import type { DatosIndicadores } from '../pages/Indicadores.tsx';
import { textoPeriodo, type FiltroEmbudo, type FilaGrupo } from '../lib/embudo.ts';

const pctN = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const pct = (a: number, b: number) => (b ? `${pctN(a, b)} %` : '—');

function puntosClave(d: DatosIndicadores): string[] {
  const p: string[] = [];
  const e = d.embudo;
  const top = d.porPropiedad[0];
  if (top && d.porPropiedad.length > 1) {
    p.push(`«${top.nombre}» es la propiedad con más interés: ${top.leads} de ${e.leads} leads (${pct(top.leads, e.leads)}).`);
  }
  const canales = d.porCanal.filter((c) => c.leads >= 3 && c.nombre !== 'Sin fuente');
  if (canales.length) {
    const mas = canales[0];
    p.push(`${mas.nombre} es la red que más leads trae (${mas.leads}).`);
    const mejor = [...canales].sort((a, b) => b.agendo / b.leads - a.agendo / a.leads)[0];
    if (mejor.agendo > 0) {
      p.push(`${mejor.nombre} convierte mejor en citas: ${pct(mejor.agendo, mejor.leads)} de sus leads agenda una visita.`);
    }
  }
  const conBase = e.pasos.filter((x) => x.base_total > 0 && x.pendiente < x.base_total);
  if (conBase.length) {
    const reto = [...conBase].sort((a, b) => a.pct - b.pct)[0];
    p.push(`El paso con menor conversión es «${reto.titulo.toLowerCase()}»: ${reto.pct} % ${reto.baseTexto}.`);
  }
  const sinRegistrar = e.pasos[0].pendiente;
  if (sinRegistrar > 0) {
    p.push(`${sinRegistrar} ${sinRegistrar === 1 ? 'lead aún no tiene' : 'leads aún no tienen'} registrada su respuesta: son la oportunidad inmediata de seguimiento.`);
  }
  return p.slice(0, 5);
}

function Tabla({ titulo, columna, filas }: { titulo: string; columna: string; filas: FilaGrupo[] }) {
  if (!filas.length) return null;
  return (
    <section className="informe-bloque mt-6">
      <h2 className="mb-2 text-[13pt] font-bold text-[#1f4fa3]">{titulo}</h2>
      <table className="w-full border-collapse text-[9.5pt]">
        <thead>
          <tr className="bg-[#1f4fa3] text-left text-white">
            <th className="px-2 py-1.5 font-semibold">{columna}</th>
            <th className="px-2 py-1.5 text-right font-semibold">Leads</th>
            <th className="px-2 py-1.5 text-right font-semibold">Responden</th>
            <th className="px-2 py-1.5 text-right font-semibold">Agendan</th>
            <th className="px-2 py-1.5 text-right font-semibold">Asisten</th>
            <th className="px-2 py-1.5 text-right font-semibold">Ofertas</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={f.nombre} className={i % 2 ? 'bg-[#eef3fb]' : 'bg-white'}>
              <td className="px-2 py-1.5">{f.nombre}</td>
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{f.leads}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{f.respondio} <span className="text-[#6b7280]">· {pct(f.respondio, f.leads)}</span></td>
              <td className="px-2 py-1.5 text-right tabular-nums">{f.agendo} <span className="text-[#6b7280]">· {pct(f.agendo, f.leads)}</span></td>
              <td className="px-2 py-1.5 text-right tabular-nums">{f.asistio}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{f.oferta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

export function InformePdf({ datos: d, filtro }: { datos: DatosIndicadores; filtro: FiltroEmbudo }) {
  const e = d.embudo;
  const periodo = textoPeriodo(filtro);
  const alcance = [filtro.propiedad && `Propiedad: ${filtro.propiedad}`, filtro.canal && `Red: ${filtro.canal}`].filter(Boolean).join(' · ');
  const hoy = new Date().toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
  const [r, a, s, seg, o] = e.pasos;
  const kpis = [
    ['Leads recibidos', String(e.leads), ''],
    ['Responden', pct(r.si, r.base_total), `${r.si} de ${r.base_total}`],
    ['Agendan cita', pct(a.si, a.base_total), `${a.si} de ${a.base_total}`],
    ['Asisten', pct(s.si, s.base_total), `${s.si} de ${s.base_total}`],
    ['Hacen oferta', pct(o.si, o.base_total), `${o.si} de ${o.base_total}`],
  ];
  const max = Math.max(1, e.leads);
  const filas = [
    { t: 'Leads recibidos', v: e.leads, base: e.leads },
    ...e.pasos.map((p) => ({ t: p.titulo, v: p.si, base: p.base_total })),
  ];
  const claves = puntosClave(d);

  return (
    <div className="informe hidden bg-white text-[10.5pt] leading-snug text-[#1c1917] print:block">
      <header className="flex items-stretch overflow-hidden rounded-lg">
        <img src="./logo-gladys-perez.png" alt="Gladys Pérez, asesora inmobiliaria" className="h-[30mm] w-auto" />
        <div className="flex flex-1 flex-col justify-center bg-[#1f4fa3] px-6 text-white">
          <p className="text-[9pt] uppercase tracking-[0.2em] opacity-80">Informe comercial</p>
          <h1 className="text-[20pt] font-bold leading-tight">Embudo de leads</h1>
          <p className="text-[10pt] opacity-90">{periodo}{alcance && ` · ${alcance}`}</p>
        </div>
      </header>

      <section className="informe-bloque mt-6 grid grid-cols-5 gap-2">
        {kpis.map(([t, v, det]) => (
          <div key={t} className="rounded-lg border border-[#d6e2f5] bg-[#eef3fb] px-3 py-2.5">
            <p className="text-[8.5pt] font-semibold uppercase tracking-wide text-[#1f4fa3]">{t}</p>
            <p className="mt-0.5 text-[18pt] font-bold tabular-nums">{v}</p>
            {det && <p className="text-[8.5pt] text-[#6b7280]">{det}</p>}
          </div>
        ))}
      </section>

      {claves.length > 0 && (
        <section className="informe-bloque mt-6">
          <h2 className="mb-2 text-[13pt] font-bold text-[#1f4fa3]">Puntos clave</h2>
          <ul className="list-disc space-y-1 pl-5">
            {claves.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </section>
      )}

      <section className="informe-bloque mt-6">
        <h2 className="mb-3 text-[13pt] font-bold text-[#1f4fa3]">Embudo comercial</h2>
        <div className="space-y-2">
          {filas.map((f, i) => (
            <div key={f.t} className="grid grid-cols-[46mm_1fr_24mm] items-center gap-3">
              <span className="font-semibold">{f.t}</span>
              <div className="h-[6mm] rounded bg-[#eef3fb]">
                <div className="h-full rounded bg-[#1f4fa3]" style={{ width: `${Math.max(1, (f.v / max) * 100)}%` }} />
              </div>
              <span className="text-right tabular-nums">
                <b>{f.v}</b>
                {i > 0 && <span className="text-[#6b7280]"> · {pct(f.v, f.base)}</span>}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[9pt] text-[#6b7280]">
          Cada porcentaje es sobre el paso anterior: responden sobre los leads, agendan sobre quienes responden,
          asisten sobre quienes agendan; seguimiento y ofertas sobre quienes visitaron.
        </p>
        {seg.base_total > 0 && (
          <p className="mt-2 text-[9pt] text-[#6b7280]">
            De quienes visitaron, {seg.si} {seg.si === 1 ? 'sigue' : 'siguen'} en seguimiento y {seg.no} {seg.no === 1 ? 'descartó' : 'descartaron'}.
          </p>
        )}
      </section>

      <Tabla titulo="Leads por propiedad" columna="Propiedad" filas={d.porPropiedad} />
      <Tabla titulo="Leads por red social" columna="Red" filas={d.porCanal} />
      <Tabla titulo="Leads por ángulo del anuncio" columna="Red · ángulo" filas={d.porAngulo} />

      <footer className="informe-bloque mt-8 border-t border-[#d6e2f5] pt-3 text-[8pt] text-[#6b7280]">
        <p>
          <b className="text-[#1c1917]">Cómo se mide:</b> cada porcentaje se calcula sobre quienes llegaron al paso anterior
          (responden sobre los leads, agendan sobre quienes responden, asisten sobre quienes agendan, ofertas sobre quienes visitan).
          Las ofertas incluyen las verbales. No se cuentan propietarios ni consignadores.
        </p>
        <p className="mt-1">Gladys Pérez · Asesora inmobiliaria · Informe generado el {hoy}.</p>
      </footer>
    </div>
  );
}
