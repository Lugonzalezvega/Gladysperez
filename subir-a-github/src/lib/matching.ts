import type { Cliente, Interes, Operacion, Propiedad, TipoPropiedad } from './tipos.ts';
import { aNumero, palabrasUbicacion, sinTildes } from './texto.ts';

export interface Filtro {
  tipo: TipoPropiedad | null;
  /** Operación buscada: "Venta" o "Renta" (las de "Venta y Renta" sirven para ambas). */
  operacion: Exclude<Operacion, 'Venta y Renta'> | null;
  precioMax: number | null;
  ubicacion: string;
}

export const FILTRO_VACIO: Filtro = { tipo: null, operacion: null, precioMax: null, ubicacion: '' };

const POR_INTERES: Record<Interes, Pick<Filtro, 'tipo' | 'operacion'> | null> = {
  'Busca Comprar Casa': { tipo: 'Casa', operacion: 'Venta' },
  'Busca Rentar Casa': { tipo: 'Casa', operacion: 'Renta' },
  'Busca Comprar Terreno': { tipo: 'Terreno', operacion: 'Venta' },
  'Propietario/Consignador': null,
};

/** Llena el filtro con el interés, presupuesto y ubicación del cliente. */
export function filtroDeCliente(c: Pick<Cliente, 'interes' | 'presupuesto_max' | 'ubicacion_deseada'>): Filtro {
  const base = POR_INTERES[c.interes];
  return {
    tipo: base?.tipo ?? null,
    operacion: base?.operacion ?? null,
    precioMax: c.presupuesto_max ?? null,
    ubicacion: c.ubicacion_deseada ?? '',
  };
}

/** Precio que se compara con el presupuesto según la operación buscada. */
export function precioPara(p: Propiedad, operacion: Filtro['operacion']): number {
  if (operacion === 'Renta' && p.operacion === 'Venta y Renta' && p.precio_renta != null) {
    return Number(p.precio_renta);
  }
  return Number(p.precio) || 0;
}

export function ubicacionCoincide(direccion: string, ubicacion: string): boolean {
  const buscadas = palabrasUbicacion(ubicacion);
  if (buscadas.length === 0) return true;
  const dir = sinTildes(direccion);
  return buscadas.some((w) => dir.includes(w));
}

export function haceJuego(p: Propiedad, f: Filtro): boolean {
  if (p.deleted_at || p.estado !== 'Disponible') return false;
  if (f.tipo && p.tipo !== f.tipo) return false;
  if (f.operacion && p.operacion !== f.operacion && p.operacion !== 'Venta y Renta') return false;
  if (f.precioMax != null && f.precioMax > 0 && precioPara(p, f.operacion) > f.precioMax) return false;
  if (!ubicacionCoincide(p.direccion, f.ubicacion)) return false;
  return true;
}

/** Propiedades disponibles que hacen juego, de la más cara (más cercana al tope) a la más barata. */
export function buscarCoincidencias(propiedades: Propiedad[], f: Filtro): Propiedad[] {
  return propiedades
    .filter((p) => haceJuego(p, f))
    .sort((a, b) => precioPara(b, f.operacion) - precioPara(a, f.operacion));
}

const IGNORAR = new Set(['en', 'de', 'para', 'con', 'que', 'una', 'un', 'menos', 'hasta', 'maximo', 'max', 'precio', 'busco', 'busca']);

/**
 * Interpreta un filtro escrito a mano:
 * "Casa en Venta < $250k", "terreno tumbaco hasta 80 mil", "renta casa cumbaya menos de 900".
 */
export function filtroDesdeTexto(texto: string): Filtro {
  let t = sinTildes(texto);
  const f: Filtro = { ...FILTRO_VACIO };

  const precio = t.match(/(?:<=?|hasta|menos de|maximo|max\.?|tope)\s*\$?\s*([\d.,]+\s*(?:millones|millon|mil|k|m\b)?)/);
  if (precio) {
    f.precioMax = aNumero(precio[1]);
    t = t.replace(precio[0], ' ');
  }
  if (/\b(terreno|terrenos|lote|lotes)\b/.test(t)) f.tipo = 'Terreno';
  else if (/\b(casa|casas|vivienda|departamento|depa)\b/.test(t)) f.tipo = 'Casa';
  if (/\b(renta|rentar|arriendo|arrendar|alquiler|alquilar)\b/.test(t)) f.operacion = 'Renta';
  else if (/\b(venta|vender|comprar|compra)\b/.test(t)) f.operacion = 'Venta';

  const resto = t
    .replace(/\b(terrenos?|lotes?|casas?|vivienda|departamento|depa|renta|rentar|arriendo|arrendar|alquiler|alquilar|venta|vender|comprar|compra)\b/g, ' ')
    .replace(/[<>=$]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !IGNORAR.has(w) && !/^\d/.test(w));
  f.ubicacion = resto.join(' ');
  return f;
}
