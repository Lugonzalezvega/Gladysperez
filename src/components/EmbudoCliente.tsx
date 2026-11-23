import { almacen } from '../data/store.ts';
import { cambiosPaso, cumplio, PASOS, type Paso } from '../lib/embudo.ts';
import type { Cliente, Oferta, SiNo } from '../lib/tipos.ts';
import { formatoFecha } from '../lib/texto.ts';

function marcar(c: Cliente, paso: Paso, valor: SiNo | Oferta) {
  // Tocar de nuevo la opción elegida la borra.
  const nuevo = c[paso] === valor ? null : valor;
  void almacen.guardar('clients', { id: c.id, ...cambiosPaso(c, paso, nuevo) });
}

/** Cuántos pasos del embudo ya cumplió el lead (para mostrar en la tarjeta). */
export function avanceEmbudo(c: Cliente): number {
  return PASOS.filter((p) => cumplio(c, p.clave)).length;
}

export function EmbudoCliente({ c }: { c: Cliente }) {
  return (
    <div className="space-y-2">
      {PASOS.map((p) => {
        const opciones: Array<[string, SiNo | Oferta]> =
          p.clave === 'oferta'
            ? [['Verbal', 'verbal'], ['Escrita', 'escrita'], ['No', 'no']]
            : [['Sí', 'si'], ['No', 'no']];
        const fecha = c[`${p.clave}_en` as const];
        return (
          <div key={p.clave}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium text-stone-700 dark:text-stone-300">{p.pregunta}</span>
              {fecha && <span className="text-stone-500">{formatoFecha(fecha)}</span>}
            </div>
            <div className="flex gap-1.5" role="group" aria-label={p.pregunta}>
              {opciones.map(([texto, valor]) => {
                const activo = c[p.clave] === valor;
                const color =
                  valor === 'no'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-emerald-600 text-white border-emerald-600';
                return (
                  <button
                    key={texto}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => marcar(c, p.clave, valor)}
                    className={`min-h-[34px] flex-1 rounded-lg border text-sm font-medium transition ${
                      activo ? color : 'border-stone-300 bg-white text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300'
                    }`}
                  >
                    {texto}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
