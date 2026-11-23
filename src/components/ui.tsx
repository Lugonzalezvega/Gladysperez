import { useEffect, useRef, type ReactNode } from 'react';
import { PhoneMissed, PhoneOutgoing, X } from 'lucide-react';
import type { EstadoPropiedad, Llamo, Operacion, TipoPropiedad } from '../lib/tipos.ts';
import { formatoFechaHora } from '../lib/texto.ts';

/** Ventana emergente (hoja inferior en celular, centrada en escritorio). */
export function Modal({ titulo, abierto, alCerrar, children }: { titulo: string; abierto: boolean; alCerrar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    <dialog
      ref={ref}
      onClose={alCerrar}
      className="m-0 mt-auto w-full max-w-none rounded-t-3xl bg-white p-0 text-stone-900 backdrop:bg-black/50 dark:bg-stone-900 dark:text-stone-100 md:m-auto md:max-w-lg md:rounded-3xl"
    >
      {abierto && (
        <div className="max-h-[88vh] overflow-y-auto p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">{titulo}</h2>
            <button className="btn-secundario !min-h-[40px] !px-2" onClick={alCerrar} aria-label="Cerrar">
              <X className="h-5 w-5" />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

const COLOR_OPERACION: Record<string, string> = {
  Venta: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200',
  Renta: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
};
const COLOR_TIPO: Record<TipoPropiedad, string> = {
  Casa: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  Terreno: 'bg-lime-100 text-lime-800 dark:bg-lime-950 dark:text-lime-200',
};
const COLOR_ESTADO: Record<EstadoPropiedad, string> = {
  Disponible: 'bg-emerald-600 text-white',
  'En Negociación': 'bg-orange-500 text-white',
  Vendido: 'bg-stone-600 text-white',
  Rentado: 'bg-stone-600 text-white',
};

/** Etiquetas de color: Venta verde, Renta azul, Casa ámbar, Terreno lima. */
export function Etiquetas({ tipo, operacion, estado }: { tipo: TipoPropiedad; operacion: Operacion; estado?: EstadoPropiedad }) {
  const ops = operacion === 'Venta y Renta' ? ['Venta', 'Renta'] : [operacion];
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={`pill ${COLOR_TIPO[tipo]}`}>{tipo}</span>
      {ops.map((o) => (
        <span key={o} className={`pill ${COLOR_OPERACION[o]}`}>
          {o}
        </span>
      ))}
      {estado && <span className={`pill ${COLOR_ESTADO[estado]}`}>{estado}</span>}
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="tarjeta text-center text-stone-500">{children}</p>;
}

export function Titulo({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{children}</h1>
      {accion}
    </div>
  );
}

/** Botones de un clic "Llamó" / "No llamó". */
export function BotonesLlamada({ llamo, llamoEn, alMarcar }: { llamo: Llamo; llamoEn?: string | null; alMarcar: (v: 'si' | 'no') => void }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <button
          className={`btn !min-h-[40px] !gap-1 !px-2 text-sm leading-tight ${llamo === 'si' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'}`}
          onClick={() => alMarcar('si')}
        >
          <PhoneOutgoing className="h-4 w-4 shrink-0" aria-hidden /> Llamó
        </button>
        <button
          className={`btn !min-h-[40px] !gap-1 !px-2 text-sm leading-tight ${llamo === 'no' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200'}`}
          onClick={() => alMarcar('no')}
        >
          <PhoneMissed className="h-4 w-4 shrink-0" aria-hidden /> No llamó
        </button>
      </div>
      {llamo && llamoEn && (
        <p className="mt-1 text-xs text-stone-500">
          {llamo === 'si' ? 'Llamó' : 'No llamó'} · {formatoFechaHora(llamoEn)}
        </p>
      )}
    </div>
  );
}

export function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="etiqueta-campo">{etiqueta}</span>
      {children}
    </label>
  );
}

export function Aviso({ tipo, children }: { tipo: 'ok' | 'error'; children: ReactNode }) {
  return (
    <p
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`rounded-xl px-3 py-2 text-sm ${
        tipo === 'ok' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200'
      }`}
    >
      {children}
    </p>
  );
}

/** Convierte el texto de un input numérico a número (vacío -> null). */
export function numeroDe(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
