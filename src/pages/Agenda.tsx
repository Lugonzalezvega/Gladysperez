import { useMemo, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { useTabla } from '../data/hooks.ts';
import { almacen } from '../data/store.ts';
import { TIPOS_TAREA } from '../lib/constantes.ts';
import { formatoFecha, hoyISO } from '../lib/texto.ts';
import { enlaceWhatsApp, textoRecordatorioCita, textoSeguimiento } from '../lib/whatsapp.ts';
import type { Cliente, Tarea, TipoTarea } from '../lib/tipos.ts';
import { BotonesLlamada, Campo, Modal, Titulo, Vacio } from '../components/ui.tsx';
import { marcarLlamada } from './Clientes.tsx';

function sumarDias(fecha: string, n: number): string {
  const d = new Date(`${fecha}T12:00:00`);
  d.setDate(d.getDate() + n);
  return hoyISO(undefined, d);
}

const COLOR_TIPO: Record<TipoTarea, string> = {
  Llamada: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  'Muestra de propiedad': 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  Firma: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  Seguimiento: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
};

/**
 * En tareas de tipo Llamada: "Llamó" la marca hecha; "No llamó" la deja pendiente.
 * Si la tarea tiene cliente, también se registra en el cliente.
 */
function marcarTareaLlamada(t: Tarea, v: 'si' | 'no', cliente?: Cliente) {
  void almacen.guardar('tasks', { id: t.id, llamo: v, hecha: v === 'si' });
  if (cliente) void marcarLlamada(cliente, v);
}

function FilaTarea({ t, cliente, conFecha }: { t: Tarea; cliente?: Cliente; conFecha?: boolean }) {
  const wa =
    cliente?.telefono &&
    (t.tipo === 'Muestra de propiedad' || t.tipo === 'Firma'
      ? enlaceWhatsApp(cliente.telefono, textoRecordatorioCita(cliente, t))
      : enlaceWhatsApp(cliente.telefono, textoSeguimiento(cliente)));
  return (
    <li className={`tarjeta space-y-2 !p-3 ${t.hecha ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1 h-6 w-6 shrink-0 accent-valle-700"
          checked={t.hecha}
          onChange={(e) => void almacen.guardar('tasks', { id: t.id, hecha: e.target.checked })}
          aria-label="Hecha"
        />
        <div className="min-w-0 flex-1">
          <p className={`font-medium ${t.hecha ? 'line-through' : ''}`}>{t.texto || t.tipo}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
            <span className={`pill ${COLOR_TIPO[t.tipo]}`}>{t.tipo}</span>
            {conFecha && <span>{formatoFecha(t.fecha)}</span>}
            {t.hora && <span>{t.hora.slice(0, 5)}</span>}
            {cliente && <span>· {cliente.nombre}</span>}
          </div>
        </div>
        {wa && (
          <a className="btn-whatsapp !min-h-[40px] !px-2" href={wa} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
            <MessageCircle className="h-5 w-5" />
          </a>
        )}
        <button
          className="btn-secundario !min-h-[40px] !px-2"
          aria-label="Borrar tarea"
          onClick={() => window.confirm('¿Borrar esta tarea?') && void almacen.borrar('tasks', t.id)}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {t.tipo === 'Llamada' && <BotonesLlamada llamo={t.llamo} llamoEn={t.updated_at} alMarcar={(v) => marcarTareaLlamada(t, v, cliente)} />}
    </li>
  );
}

function FormularioTarea({ fecha, clientes, alTerminar }: { fecha: string; clientes: Cliente[]; alTerminar: () => void }) {
  const [tipo, setTipo] = useState<TipoTarea>('Llamada');
  const [texto, setTexto] = useState('');
  const [f, setF] = useState(fecha);
  const [hora, setHora] = useState('');
  const [clienteId, setClienteId] = useState('');

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const c = clientes.find((x) => x.id === clienteId);
    await almacen.guardar('tasks', {
      tipo,
      texto: texto.trim() || (c ? `${tipo === 'Llamada' ? 'Llamar a' : tipo + ' con'} ${c.nombre}` : tipo),
      fecha: f,
      hora: hora || null,
      client_id: clienteId || null,
    });
    alTerminar();
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <Campo etiqueta="Tipo">
        <select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoTarea)}>
          {TIPOS_TAREA.map((t) => <option key={t}>{t}</option>)}
        </select>
      </Campo>
      <Campo etiqueta="Cliente (opcional)">
        <select className="campo" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
          <option value="">— Sin cliente —</option>
          {[...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </Campo>
      <Campo etiqueta="Detalle">
        <input className="campo" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Opcional" />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Fecha">
          <input className="campo" type="date" required value={f} onChange={(e) => setF(e.target.value)} />
        </Campo>
        <Campo etiqueta="Hora">
          <input className="campo" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </Campo>
      </div>
      <button className="btn-primario w-full">Guardar</button>
    </form>
  );
}

export function Agenda() {
  const tareas = useTabla('tasks');
  const clientes = useTabla('clients');
  const [fecha, setFecha] = useState(hoyISO());
  const [tipo, setTipo] = useState<TipoTarea | ''>('');
  const [nueva, setNueva] = useState(false);
  const hoy = hoyISO();
  const porId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);

  const orden = (a: Tarea, b: Tarea) => Number(a.hecha) - Number(b.hecha) || (a.hora ?? '99').localeCompare(b.hora ?? '99');
  const delDia = tareas.filter((t) => t.fecha === fecha && (!tipo || t.tipo === tipo)).sort(orden);
  const atrasadas = fecha === hoy ? tareas.filter((t) => t.fecha < hoy && !t.hecha && (!tipo || t.tipo === tipo)).sort((a, b) => a.fecha.localeCompare(b.fecha)) : [];

  return (
    <div className="space-y-3">
      <Titulo accion={<button className="btn-primario" onClick={() => setNueva(true)}><Plus className="h-5 w-5" /> Tarea</button>}>Agenda</Titulo>
      <div className="tarjeta flex items-center gap-2 !p-2">
        <button className="btn-secundario !px-3" onClick={() => setFecha(sumarDias(fecha, -1))} aria-label="Día anterior"><ChevronLeft className="h-5 w-5" /></button>
        <input type="date" className="campo text-center" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} aria-label="Fecha" />
        <button className="btn-secundario !px-3" onClick={() => setFecha(sumarDias(fecha, 1))} aria-label="Día siguiente"><ChevronRight className="h-5 w-5" /></button>
        {fecha !== hoy && <button className="btn-secundario" onClick={() => setFecha(hoy)}>Hoy</button>}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Tipo de tarea">
        <button className={tipo === '' ? 'chip-on' : 'chip-off'} onClick={() => setTipo('')}>Todas</button>
        {TIPOS_TAREA.map((t) => (
          <button key={t} className={`whitespace-nowrap ${tipo === t ? 'chip-on' : 'chip-off'}`} onClick={() => setTipo(tipo === t ? '' : t)}>{t}</button>
        ))}
      </div>

      {atrasadas.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-rose-700 dark:text-rose-300">Pendientes de días anteriores ({atrasadas.length})</h2>
          <ul className="space-y-2">
            {atrasadas.map((t) => (
              <FilaTarea key={t.id} t={t} conFecha cliente={t.client_id ? porId.get(t.client_id) : undefined} />
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">{fecha === hoy ? 'Hoy' : formatoFecha(fecha)}</h2>
        {delDia.length === 0 ? (
          <Vacio>No hay tareas para este día.</Vacio>
        ) : (
          <ul className="space-y-2">
            {delDia.map((t) => <FilaTarea key={t.id} t={t} cliente={t.client_id ? porId.get(t.client_id) : undefined} />)}
          </ul>
        )}
      </section>

      <Modal titulo="Nueva tarea" abierto={nueva} alCerrar={() => setNueva(false)}>
        <FormularioTarea fecha={fecha} clientes={clientes} alTerminar={() => setNueva(false)} />
      </Modal>
    </div>
  );
}
