import type { Cliente, Propiedad, Tarea } from './tipos.ts';
import { formatoDinero, formatoFecha } from './texto.ts';
import { normalizarTelefono } from './telefono.ts';
import { urlHttpsSegura } from './seguridad.ts';

/** https://wa.me/<telefono>?text=<mensaje codificado>. Sin teléfono, WhatsApp deja elegir contacto. */
export function enlaceWhatsApp(telefono: string | null | undefined, mensaje: string): string {
  const tel = normalizarTelefono(telefono);
  return `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`;
}

function primerNombre(c?: Pick<Cliente, 'nombre'> | null): string {
  return (c?.nombre ?? '').trim().split(/\s+/)[0] ?? '';
}

export function textoFicha(p: Propiedad, cliente?: Pick<Cliente, 'nombre'> | null): string {
  const saludo = cliente ? `Hola ${primerNombre(cliente)}, ` : 'Hola, ';
  const precio =
    p.operacion === 'Renta'
      ? `${formatoDinero(p.precio)} al mes`
      : p.operacion === 'Venta y Renta'
        ? `Venta ${formatoDinero(p.precio)}${p.precio_renta != null ? ` · Renta ${formatoDinero(p.precio_renta)} al mes` : ''}`
        : formatoDinero(p.precio);
  const lineas = [
    `${saludo}te comparto esta opción:`,
    '',
    `🏡 *${p.tipo} en ${p.operacion}*`,
    `📍 ${p.direccion || 'Ubicación a confirmar'}`,
    `💲 ${precio}`,
  ];
  if (p.m2_terreno) lineas.push(`📐 Terreno: ${p.m2_terreno} m²`);
  if (p.m2_construccion) lineas.push(`🏗️ Construcción: ${p.m2_construccion} m²`);
  if (p.recamaras) lineas.push(`🛏️ ${p.recamaras} habitaciones`);
  if (p.amenidades) lineas.push(`✨ ${p.amenidades}`);
  const fotos = urlHttpsSegura(p.link_fotos);
  if (fotos) lineas.push('', `📸 Fotos: ${fotos}`);
  lineas.push('', '¿Te gustaría agendar una visita? — Gladys');
  return lineas.join('\n');
}

export function textoRecordatorioCita(c: Pick<Cliente, 'nombre'> | null, t: Pick<Tarea, 'tipo' | 'fecha' | 'hora' | 'texto'>): string {
  const que = t.tipo === 'Firma' ? 'la firma' : t.tipo === 'Muestra de propiedad' ? 'la visita a la propiedad' : 'nuestra cita';
  const hora = t.hora ? ` a las ${t.hora.slice(0, 5)}` : '';
  return [
    `Hola ${primerNombre(c)}, te recuerdo ${que} el ${formatoFecha(t.fecha)}${hora}.`,
    t.texto ? `Detalle: ${t.texto}` : '',
    '¿Me confirmas por favor? Gracias. — Gladys',
  ]
    .filter(Boolean)
    .join('\n');
}

export function textoSeguimiento(c: Pick<Cliente, 'nombre' | 'interes' | 'ubicacion_deseada'>): string {
  const busca =
    c.interes === 'Propietario/Consignador'
      ? 'la venta o renta de tu propiedad'
      : c.interes.replace('Busca ', '').toLowerCase();
  const donde = c.ubicacion_deseada ? ` en ${c.ubicacion_deseada}` : '';
  return `Hola ${primerNombre(c)}, ¿cómo estás? Te escribo para dar seguimiento a ${
    c.interes === 'Propietario/Consignador' ? busca : `tu búsqueda para ${busca}${donde}`
  }. Tengo opciones que te pueden interesar. ¿Cuándo podemos conversar? — Gladys`;
}
