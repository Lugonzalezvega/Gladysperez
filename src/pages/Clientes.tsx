import { useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Pencil, Phone, Plus, Search, Sparkles, Trash2 } from 'lucide-react';
import { useTabla } from '../data/hooks.ts';
import { almacen } from '../data/store.ts';
import { ETAPAS, INTERESES } from '../lib/constantes.ts';
import { formatoDinero, hoyISO, sinTildes } from '../lib/texto.ts';
import { normalizarTelefono, telefonoBonito } from '../lib/telefono.ts';
import { enlaceWhatsApp, textoSeguimiento } from '../lib/whatsapp.ts';
import type { Cliente, Etapa, Interes } from '../lib/tipos.ts';
import { Aviso, BotonesLlamada, Campo, Modal, numeroDe, Titulo, Vacio } from '../components/ui.tsx';

/** "Llamó" en un cliente Nuevo lo pasa a Contactado. */
export function marcarLlamada(c: Cliente, v: 'si' | 'no') {
  return almacen.guardar('clients', {
    id: c.id,
    llamo: v,
    llamo_en: new Date().toISOString(),
    ...(v === 'si' && c.etapa === 'Nuevo' ? { etapa: 'Contactado' as Etapa } : {}),
  });
}

type Borrador = { id?: string; nombre: string; telefono: string; interes: Interes; presupuesto_max: string; ubicacion_deseada: string; etapa: Etapa; notas: string };
const VACIO: Borrador = { nombre: '', telefono: '', interes: 'Busca Comprar Casa', presupuesto_max: '', ubicacion_deseada: '', etapa: 'Nuevo', notas: '' };

function FormularioCliente({ inicial, alTerminar }: { inicial: Borrador; alTerminar: () => void }) {
  const [b, setB] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Borrador) => (e: { target: { value: string } }) => setB({ ...b, [k]: e.target.value });

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!b.nombre.trim()) return setError('Escribe el nombre.');
    const tel = normalizarTelefono(b.telefono);
    if (b.telefono.trim() && tel.length < 11) return setError('Revisa el teléfono (ej. 0999 123 456).');
    const nuevo = !b.id;
    const c = await almacen.guardar('clients', {
      ...(b.id ? { id: b.id } : {}),
      nombre: b.nombre.trim(),
      telefono: tel,
      interes: b.interes,
      presupuesto_max: numeroDe(b.presupuesto_max),
      ubicacion_deseada: b.ubicacion_deseada.trim(),
      etapa: b.etapa,
      notas: b.notas.trim(),
    });
    if (nuevo) {
      await almacen.guardar('tasks', { tipo: 'Llamada', texto: `Llamar a ${c.nombre}`, fecha: hoyISO(), client_id: c.id });
    }
    alTerminar();
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <Campo etiqueta="Nombre">
        <input className="campo" required value={b.nombre} onChange={set('nombre')} autoComplete="off" />
      </Campo>
      <Campo etiqueta="Teléfono / WhatsApp">
        <input className="campo" type="tel" inputMode="tel" value={b.telefono} onChange={set('telefono')} placeholder="0999 123 456" />
      </Campo>
      <Campo etiqueta="Interés">
        <select className="campo" value={b.interes} onChange={set('interes')}>
          {INTERESES.map((i) => <option key={i}>{i}</option>)}
        </select>
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta={b.interes === 'Busca Rentar Casa' ? 'Presupuesto mensual' : 'Presupuesto máximo'}>
          <input className="campo" inputMode="decimal" value={b.presupuesto_max} onChange={set('presupuesto_max')} />
        </Campo>
        <Campo etiqueta="Etapa">
          <select className="campo" value={b.etapa} onChange={set('etapa')}>
            {ETAPAS.map((i) => <option key={i}>{i}</option>)}
          </select>
        </Campo>
      </div>
      <Campo etiqueta="Ubicación deseada">
        <input className="campo" value={b.ubicacion_deseada} onChange={set('ubicacion_deseada')} placeholder="Tumbaco, Cumbayá…" />
      </Campo>
      <Campo etiqueta="Notas">
        <textarea className="campo" rows={3} value={b.notas} onChange={set('notas')} />
      </Campo>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <button className="btn-primario w-full">Guardar</button>
    </form>
  );
}

function TarjetaCliente({ c, alEditar }: { c: Cliente; alEditar: () => void }) {
  return (
    <article
      className="tarjeta cursor-grab space-y-2 !p-3 active:cursor-grabbing"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', c.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{c.nombre}</p>
          <p className="text-xs text-stone-500">{c.interes}</p>
        </div>
        <button className="btn-secundario !min-h-[36px] !px-2" onClick={alEditar} aria-label={`Editar a ${c.nombre}`}>
          <Pencil className="h-4 w-4" />
        </button>
      </div>
      <p className="text-sm text-stone-600 dark:text-stone-400">
        {c.presupuesto_max ? `Hasta ${formatoDinero(c.presupuesto_max)}` : 'Sin presupuesto'}
        {c.ubicacion_deseada ? ` · ${c.ubicacion_deseada}` : ''}
      </p>
      {c.telefono && <p className="text-xs text-stone-500">{telefonoBonito(c.telefono)}</p>}
      <BotonesLlamada llamo={c.llamo} llamoEn={c.llamo_en} alMarcar={(v) => void marcarLlamada(c, v)} />
      <div className="grid grid-cols-3 gap-2">
        <a className="btn-secundario !min-h-[38px] !px-2" href={c.telefono ? `tel:+${c.telefono}` : undefined} aria-label="Llamar" aria-disabled={!c.telefono}>
          <Phone className="h-4 w-4" />
        </a>
        <a
          className="btn-whatsapp !min-h-[38px] !px-2"
          href={enlaceWhatsApp(c.telefono, textoSeguimiento(c))}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="WhatsApp de seguimiento"
        >
          <MessageCircle className="h-4 w-4" />
        </a>
        <Link className="btn-secundario !min-h-[38px] !px-2" to={`/matching?cliente=${c.id}`} aria-label="Ver propiedades que hacen juego">
          <Sparkles className="h-4 w-4" />
        </Link>
      </div>
      {/* Selector de etapa para celular (donde arrastrar es incómodo) */}
      <select
        className="campo !py-1.5 !text-sm"
        aria-label="Etapa"
        value={c.etapa}
        onChange={(e) => void almacen.guardar('clients', { id: c.id, etapa: e.target.value as Etapa })}
      >
        {ETAPAS.map((e) => <option key={e}>{e}</option>)}
      </select>
    </article>
  );
}

const COLOR_ETAPA: Record<Etapa, string> = {
  Nuevo: 'border-t-sky-500',
  Contactado: 'border-t-violet-500',
  'Cita Agendada': 'border-t-amber-500',
  'Oferta Enviada': 'border-t-orange-500',
  Cerrado: 'border-t-emerald-600',
};

export function Clientes() {
  const clientes = useTabla('clients');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Borrador | null>(null);
  const [sobre, setSobre] = useState<Etapa | null>(null);
  const [etapaMovil, setEtapaMovil] = useState<Etapa>('Nuevo');

  const filtrados = useMemo(() => {
    const q = sinTildes(busca);
    return clientes
      .filter((c) => !q || sinTildes(`${c.nombre} ${c.telefono} ${c.ubicacion_deseada} ${c.notas}`).includes(q))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [clientes, busca]);
  const porEtapa = (e: Etapa) => filtrados.filter((c) => c.etapa === e);

  function soltar(e: DragEvent, etapa: Etapa) {
    e.preventDefault();
    setSobre(null);
    const id = e.dataTransfer.getData('text/plain');
    const c = clientes.find((x) => x.id === id);
    if (c && c.etapa !== etapa) void almacen.guardar('clients', { id, etapa });
  }

  const editar = (c: Cliente) =>
    setEditando({
      id: c.id, nombre: c.nombre, telefono: c.telefono, interes: c.interes,
      presupuesto_max: c.presupuesto_max == null ? '' : String(c.presupuesto_max),
      ubicacion_deseada: c.ubicacion_deseada, etapa: c.etapa, notas: c.notas,
    });

  return (
    <div className="space-y-3">
      <Titulo accion={<button className="btn-primario" onClick={() => setEditando(VACIO)}><Plus className="h-5 w-5" /> Nuevo</button>}>
        Clientes
      </Titulo>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-stone-400" aria-hidden />
        <input className="campo pl-10" placeholder="Buscar cliente" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {/* Celular: pestañas por etapa */}
      <div className="md:hidden">
        <div className="flex gap-2 overflow-x-auto pb-2" role="tablist">
          {ETAPAS.map((e) => (
            <button key={e} role="tab" aria-selected={etapaMovil === e} className={`whitespace-nowrap ${etapaMovil === e ? 'chip-on' : 'chip-off'}`} onClick={() => setEtapaMovil(e)}>
              {e} ({porEtapa(e).length})
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {porEtapa(etapaMovil).length === 0 ? (
            <Vacio>No hay clientes en “{etapaMovil}”.</Vacio>
          ) : (
            porEtapa(etapaMovil).map((c) => <TarjetaCliente key={c.id} c={c} alEditar={() => editar(c)} />)
          )}
        </div>
      </div>

      {/* Escritorio: Kanban con arrastrar y soltar */}
      <div className="hidden gap-3 overflow-x-auto pb-4 md:grid md:grid-cols-5">
        {ETAPAS.map((e) => (
          <section
            key={e}
            aria-label={e}
            onDragOver={(ev) => {
              ev.preventDefault();
              setSobre(e);
            }}
            onDragLeave={() => setSobre((s) => (s === e ? null : s))}
            onDrop={(ev) => soltar(ev, e)}
            className={`min-h-[60vh] min-w-[220px] rounded-2xl border-t-4 bg-stone-200/60 p-2 dark:bg-stone-900/60 ${COLOR_ETAPA[e]} ${sobre === e ? 'ring-2 ring-valle-500' : ''}`}
          >
            <h2 className="mb-2 flex justify-between px-1 text-sm font-semibold">
              {e} <span className="text-stone-500">{porEtapa(e).length}</span>
            </h2>
            <div className="space-y-2">
              {porEtapa(e).map((c) => <TarjetaCliente key={c.id} c={c} alEditar={() => editar(c)} />)}
            </div>
          </section>
        ))}
      </div>

      <Modal titulo={editando?.id ? 'Editar cliente' : 'Nuevo cliente'} abierto={!!editando} alCerrar={() => setEditando(null)}>
        {editando && (
          <>
            <FormularioCliente key={editando.id ?? 'nuevo'} inicial={editando} alTerminar={() => setEditando(null)} />
            {editando.id && (
              <button
                className="btn-peligro mt-3 w-full"
                onClick={() => {
                  if (window.confirm('¿Borrar este cliente? (Queda en el historial de respaldo)')) {
                    void almacen.borrar('clients', editando.id!);
                    setEditando(null);
                  }
                }}
              >
                <Trash2 className="h-5 w-5" /> Borrar cliente
              </button>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
