import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BedDouble, Camera, MessageCircle, Pencil, Plus, Ruler, Search, Trash2 } from 'lucide-react';
import { useTabla } from '../data/hooks.ts';
import { almacen } from '../data/store.ts';
import { ESTADOS, OPERACIONES, TIPOS } from '../lib/constantes.ts';
import { comision } from '../lib/comisiones.ts';
import { formatoDinero, sinTildes } from '../lib/texto.ts';
import { abrirExterno, urlHttpsSegura } from '../lib/seguridad.ts';
import { enlaceWhatsApp, textoFicha } from '../lib/whatsapp.ts';
import type { EstadoPropiedad, Operacion, Propiedad, TipoPropiedad } from '../lib/tipos.ts';
import { Aviso, Campo, Etiquetas, Modal, numeroDe, Titulo, Vacio } from '../components/ui.tsx';

type Borrador = {
  id?: string;
  tipo: TipoPropiedad;
  operacion: Operacion;
  estado: EstadoPropiedad;
  precio: string;
  precio_renta: string;
  comision_pct: string;
  direccion: string;
  m2_terreno: string;
  m2_construccion: string;
  recamaras: string;
  amenidades: string;
  link_fotos: string;
};

const VACIO: Borrador = {
  tipo: 'Casa', operacion: 'Venta', estado: 'Disponible', precio: '', precio_renta: '', comision_pct: '3',
  direccion: '', m2_terreno: '', m2_construccion: '', recamaras: '', amenidades: '', link_fotos: '',
};

function aBorrador(p: Propiedad): Borrador {
  const s = (n: number | null) => (n == null ? '' : String(n));
  return {
    id: p.id, tipo: p.tipo, operacion: p.operacion, estado: p.estado, precio: s(p.precio),
    precio_renta: s(p.precio_renta), comision_pct: s(p.comision_pct), direccion: p.direccion,
    m2_terreno: s(p.m2_terreno), m2_construccion: s(p.m2_construccion), recamaras: s(p.recamaras),
    amenidades: p.amenidades, link_fotos: p.link_fotos ?? '',
  };
}

export function FormularioPropiedad({ inicial, alTerminar }: { inicial: Borrador; alTerminar: () => void }) {
  const [b, setB] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Borrador) => (e: { target: { value: string } }) => setB({ ...b, [k]: e.target.value });

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const fotos = b.link_fotos.trim();
    if (fotos && !urlHttpsSegura(fotos)) return setError('El enlace de fotos debe empezar con https://');
    const precio = numeroDe(b.precio);
    if (precio == null || precio < 0) return setError('Escribe un precio válido.');
    const pct = numeroDe(b.comision_pct) ?? 0;
    if (pct < 0 || pct > 100) return setError('La comisión debe estar entre 0 y 100 %.');
    await almacen.guardar('properties', {
      ...(b.id ? { id: b.id } : {}),
      tipo: b.tipo,
      operacion: b.operacion,
      estado: b.estado,
      precio,
      precio_renta: b.operacion === 'Venta y Renta' ? numeroDe(b.precio_renta) : null,
      comision_pct: pct,
      direccion: b.direccion.trim(),
      m2_terreno: numeroDe(b.m2_terreno),
      m2_construccion: b.tipo === 'Casa' ? numeroDe(b.m2_construccion) : null,
      recamaras: b.tipo === 'Casa' ? (numeroDe(b.recamaras) == null ? null : Math.round(numeroDe(b.recamaras)!)) : null,
      amenidades: b.amenidades.trim(),
      link_fotos: fotos ? urlHttpsSegura(fotos) : null,
    });
    alTerminar();
  }

  const precioEtiqueta = b.operacion === 'Renta' ? 'Canon mensual (USD)' : 'Precio de venta (USD)';
  return (
    <form onSubmit={guardar} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Tipo">
          <select className="campo" value={b.tipo} onChange={set('tipo')}>
            {TIPOS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Operación">
          <select className="campo" value={b.operacion} onChange={set('operacion')}>
            {OPERACIONES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </Campo>
        <Campo etiqueta={precioEtiqueta}>
          <input className="campo" inputMode="decimal" required value={b.precio} onChange={set('precio')} />
        </Campo>
        {b.operacion === 'Venta y Renta' ? (
          <Campo etiqueta="Canon mensual (USD)">
            <input className="campo" inputMode="decimal" value={b.precio_renta} onChange={set('precio_renta')} />
          </Campo>
        ) : (
          <Campo etiqueta="Estado">
            <select className="campo" value={b.estado} onChange={set('estado')}>
              {ESTADOS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Campo>
        )}
        {b.operacion === 'Venta y Renta' && (
          <Campo etiqueta="Estado">
            <select className="campo" value={b.estado} onChange={set('estado')}>
              {ESTADOS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Campo>
        )}
        <Campo etiqueta={b.operacion === 'Renta' ? 'Comisión (% de un mes)' : 'Comisión (%)'}>
          <input className="campo" inputMode="decimal" value={b.comision_pct} onChange={set('comision_pct')} />
        </Campo>
      </div>
      <Campo etiqueta="Dirección / sector">
        <input className="campo" value={b.direccion} onChange={set('direccion')} placeholder="Ej. Tumbaco, La Morita" />
      </Campo>
      <div className="grid grid-cols-3 gap-3">
        <Campo etiqueta="m² terreno">
          <input className="campo" inputMode="decimal" value={b.m2_terreno} onChange={set('m2_terreno')} />
        </Campo>
        {b.tipo === 'Casa' && (
          <>
            <Campo etiqueta="m² constr.">
              <input className="campo" inputMode="decimal" value={b.m2_construccion} onChange={set('m2_construccion')} />
            </Campo>
            <Campo etiqueta="Habitaciones">
              <input className="campo" inputMode="numeric" value={b.recamaras} onChange={set('recamaras')} />
            </Campo>
          </>
        )}
      </div>
      <Campo etiqueta="Amenidades">
        <textarea className="campo" rows={2} value={b.amenidades} onChange={set('amenidades')} placeholder="Jardín, piscina, guardianía…" />
      </Campo>
      <Campo etiqueta="Enlace a fotos (https)">
        <input className="campo" type="url" inputMode="url" value={b.link_fotos} onChange={set('link_fotos')} placeholder="https://drive.google.com/…" />
      </Campo>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <button className="btn-primario w-full">Guardar</button>
    </form>
  );
}

function TarjetaPropiedad({ p, alEditar }: { p: Propiedad; alEditar: () => void }) {
  const fotos = urlHttpsSegura(p.link_fotos);
  return (
    <article className="tarjeta flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <Etiquetas tipo={p.tipo} operacion={p.operacion} />
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums">{formatoDinero(p.precio)}{p.operacion === 'Renta' && <span className="text-sm font-normal">/mes</span>}</p>
          {p.operacion === 'Venta y Renta' && p.precio_renta != null && (
            <p className="text-xs text-stone-500">Renta {formatoDinero(p.precio_renta)}/mes</p>
          )}
        </div>
      </div>
      <div>
        <p className="font-semibold">{p.direccion || 'Sin dirección'}</p>
        <div className="mt-1 flex flex-wrap gap-3 text-sm text-stone-500">
          {p.m2_terreno != null && <span className="flex items-center gap-1"><Ruler className="h-4 w-4" aria-hidden />{p.m2_terreno} m² terreno</span>}
          {p.m2_construccion != null && <span>{p.m2_construccion} m² constr.</span>}
          {p.recamaras != null && <span className="flex items-center gap-1"><BedDouble className="h-4 w-4" aria-hidden />{p.recamaras}</span>}
        </div>
        {p.amenidades && <p className="mt-1 line-clamp-2 text-sm text-stone-600 dark:text-stone-400">{p.amenidades}</p>}
        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Comisión: {formatoDinero(comision(p))} ({p.comision_pct} %)</p>
      </div>
      <select
        className="campo !py-2"
        aria-label="Estado"
        value={p.estado}
        onChange={(e) => void almacen.guardar('properties', { id: p.id, estado: e.target.value as EstadoPropiedad })}
      >
        {ESTADOS.map((e) => <option key={e}>{e}</option>)}
      </select>
      <div className="mt-auto grid grid-cols-4 gap-2">
        <button className="btn-secundario !px-2" disabled={!fotos} onClick={() => fotos && abrirExterno(fotos)} aria-label="Ver fotos" title="Ver fotos">
          <Camera className="h-5 w-5" />
        </button>
        <a className="btn-whatsapp !px-2" href={enlaceWhatsApp('', textoFicha(p))} target="_blank" rel="noopener noreferrer" aria-label="Compartir ficha por WhatsApp" title="Compartir ficha">
          <MessageCircle className="h-5 w-5" />
        </a>
        <button className="btn-secundario !px-2" onClick={alEditar} aria-label="Editar" title="Editar">
          <Pencil className="h-5 w-5" />
        </button>
        <button
          className="btn-peligro !px-2"
          aria-label="Borrar"
          title="Borrar"
          onClick={() => {
            if (window.confirm('¿Borrar esta propiedad? (Queda en el historial de respaldo)')) void almacen.borrar('properties', p.id);
          }}
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>
    </article>
  );
}

function Chips<T extends string>({ opciones, valor, alCambiar, etiqueta }: { opciones: T[]; valor: T | ''; alCambiar: (v: T | '') => void; etiqueta: string }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={etiqueta}>
      <button className={valor === '' ? 'chip-on' : 'chip-off'} onClick={() => alCambiar('')}>Todos</button>
      {opciones.map((o) => (
        <button key={o} className={`whitespace-nowrap ${valor === o ? 'chip-on' : 'chip-off'}`} onClick={() => alCambiar(valor === o ? '' : o)}>
          {o}
        </button>
      ))}
    </div>
  );
}

export function Inventario() {
  const propiedades = useTabla('properties');
  const [params, setParams] = useSearchParams();
  const [tipo, setTipo] = useState<TipoPropiedad | ''>('');
  const [operacion, setOperacion] = useState<Operacion | ''>('');
  const estado = (params.get('estado') ?? '') as EstadoPropiedad | '';
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<Borrador | null>(null);

  const lista = useMemo(() => {
    const q = sinTildes(busca);
    return propiedades
      .filter((p) => !tipo || p.tipo === tipo)
      .filter((p) => !operacion || p.operacion === operacion || (operacion !== 'Venta y Renta' && p.operacion === 'Venta y Renta'))
      .filter((p) => !estado || p.estado === estado)
      .filter((p) => !q || sinTildes(`${p.direccion} ${p.amenidades}`).includes(q))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }, [propiedades, tipo, operacion, estado, busca]);

  return (
    <div className="space-y-3">
      <Titulo accion={<button className="btn-primario" onClick={() => setEditando(VACIO)}><Plus className="h-5 w-5" /> Nueva</button>}>
        Inventario
      </Titulo>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-stone-400" aria-hidden />
        <input className="campo pl-10" placeholder="Buscar por sector o amenidad" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>
      <Chips etiqueta="Tipo" opciones={TIPOS} valor={tipo} alCambiar={setTipo} />
      <Chips etiqueta="Operación" opciones={['Venta', 'Renta'] as Operacion[]} valor={operacion} alCambiar={setOperacion} />
      <Chips
        etiqueta="Estado"
        opciones={ESTADOS}
        valor={estado}
        alCambiar={(v) => setParams(v ? { estado: v } : {}, { replace: true })}
      />
      {lista.length === 0 ? (
        <Vacio>{propiedades.length ? 'Ninguna propiedad coincide con los filtros.' : 'Aún no hay propiedades. Toca “Nueva” para agregar la primera.'}</Vacio>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((p) => <TarjetaPropiedad key={p.id} p={p} alEditar={() => setEditando(aBorrador(p))} />)}
        </div>
      )}
      <Modal titulo={editando?.id ? 'Editar propiedad' : 'Nueva propiedad'} abierto={!!editando} alCerrar={() => setEditando(null)}>
        {editando && <FormularioPropiedad key={editando.id ?? 'nueva'} inicial={editando} alTerminar={() => setEditando(null)} />}
      </Modal>
    </div>
  );
}
