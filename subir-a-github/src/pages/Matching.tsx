import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Camera, MessageCircle, Wand2 } from 'lucide-react';
import { useTabla } from '../data/hooks.ts';
import { buscarCoincidencias, FILTRO_VACIO, filtroDeCliente, filtroDesdeTexto, precioPara, type Filtro } from '../lib/matching.ts';
import { formatoDinero } from '../lib/texto.ts';
import { enlaceWhatsApp, textoFicha } from '../lib/whatsapp.ts';
import { abrirExterno, urlHttpsSegura } from '../lib/seguridad.ts';
import { Campo, Etiquetas, numeroDe, Titulo, Vacio } from '../components/ui.tsx';

export function Matching() {
  const clientes = useTabla('clients');
  const propiedades = useTabla('properties');
  const [params, setParams] = useSearchParams();
  const clienteId = params.get('cliente') ?? '';
  const cliente = clientes.find((c) => c.id === clienteId) ?? null;
  const [filtro, setFiltro] = useState<Filtro>(FILTRO_VACIO);
  const [texto, setTexto] = useState('');

  // Al elegir un cliente, el filtro se llena con su interés, presupuesto y ubicación.
  useEffect(() => {
    if (cliente) setFiltro(filtroDeCliente(cliente));
  }, [clienteId]);

  const resultados = useMemo(() => buscarCoincidencias(propiedades, filtro), [propiedades, filtro]);
  const ordenados = useMemo(() => [...clientes].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')), [clientes]);

  return (
    <div className="space-y-3">
      <Titulo>Matching rápido</Titulo>
      <section className="tarjeta space-y-3">
        <Campo etiqueta="Cliente">
          <select className="campo" value={clienteId} onChange={(e) => setParams(e.target.value ? { cliente: e.target.value } : {}, { replace: true })}>
            <option value="">— Elegir cliente —</option>
            {ordenados.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre} · {c.interes.replace('Busca ', '')}
              </option>
            ))}
          </select>
        </Campo>
        {cliente?.interes === 'Propietario/Consignador' && (
          <p className="text-sm text-amber-700 dark:text-amber-300">Este cliente es propietario: ajusta el filtro a mano si quieres compararlo.</p>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (texto.trim()) setFiltro(filtroDesdeTexto(texto));
          }}
        >
          <input className="campo" placeholder='Ej. "Casa en Venta < $250k"' value={texto} onChange={(e) => setTexto(e.target.value)} />
          <button className="btn-secundario" aria-label="Aplicar filtro escrito"><Wand2 className="h-5 w-5" /></button>
        </form>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Campo etiqueta="Tipo">
            <select className="campo" value={filtro.tipo ?? ''} onChange={(e) => setFiltro({ ...filtro, tipo: (e.target.value || null) as Filtro['tipo'] })}>
              <option value="">Cualquiera</option>
              <option>Casa</option>
              <option>Terreno</option>
            </select>
          </Campo>
          <Campo etiqueta="Operación">
            <select className="campo" value={filtro.operacion ?? ''} onChange={(e) => setFiltro({ ...filtro, operacion: (e.target.value || null) as Filtro['operacion'] })}>
              <option value="">Cualquiera</option>
              <option>Venta</option>
              <option>Renta</option>
            </select>
          </Campo>
          <Campo etiqueta="Precio máximo">
            <input className="campo" inputMode="decimal" value={filtro.precioMax ?? ''} onChange={(e) => setFiltro({ ...filtro, precioMax: numeroDe(e.target.value) })} />
          </Campo>
          <Campo etiqueta="Ubicación">
            <input className="campo" value={filtro.ubicacion} onChange={(e) => setFiltro({ ...filtro, ubicacion: e.target.value })} />
          </Campo>
        </div>
        <button className="text-sm font-medium text-valle-700 dark:text-sky-300" onClick={() => { setFiltro(FILTRO_VACIO); setTexto(''); }}>
          Limpiar filtro
        </button>
      </section>

      <h2 className="font-semibold">
        {resultados.length} {resultados.length === 1 ? 'propiedad disponible hace' : 'propiedades disponibles hacen'} juego
      </h2>
      {resultados.length === 0 ? (
        <Vacio>No hay propiedades disponibles con ese filtro. Prueba subir el presupuesto o quitar la ubicación.</Vacio>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resultados.map((p) => {
            const fotos = urlHttpsSegura(p.link_fotos);
            return (
              <article key={p.id} className="tarjeta space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <Etiquetas tipo={p.tipo} operacion={p.operacion} />
                  <p className="font-bold tabular-nums">{formatoDinero(precioPara(p, filtro.operacion))}</p>
                </div>
                <p className="font-medium">{p.direccion || 'Sin dirección'}</p>
                <p className="text-sm text-stone-500">
                  {[p.m2_terreno && `${p.m2_terreno} m² terreno`, p.recamaras && `${p.recamaras} hab.`].filter(Boolean).join(' · ')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    className="btn-whatsapp"
                    href={enlaceWhatsApp(cliente?.telefono, textoFicha(p, cliente))}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MessageCircle className="h-5 w-5" /> {cliente ? 'Enviar' : 'Compartir'}
                  </a>
                  <button className="btn-secundario" disabled={!fotos} onClick={() => fotos && abrirExterno(fotos)}>
                    <Camera className="h-5 w-5" /> Fotos
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
