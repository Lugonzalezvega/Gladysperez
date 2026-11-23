import type { EstadoPropiedad, Propiedad } from './tipos.ts';
import { mesDe } from './texto.ts';

/**
 * Comisión de una propiedad = base × comision_pct / 100.
 * - En Venta: base = precio de venta.
 * - En Renta: base = canon mensual (100 % = un mes de canon).
 * - En "Venta y Renta": si se cerró como Rentado, base = precio_renta (si existe);
 *   en cualquier otro caso, base = precio (venta).
 */
export function baseComision(p: Pick<Propiedad, 'precio' | 'precio_renta' | 'operacion' | 'estado'>): number {
  if (p.operacion === 'Venta y Renta' && p.estado === 'Rentado' && p.precio_renta != null) {
    return Number(p.precio_renta) || 0;
  }
  return Number(p.precio) || 0;
}

export function comision(
  p: Pick<Propiedad, 'precio' | 'precio_renta' | 'operacion' | 'estado' | 'comision_pct'>,
): number {
  const pct = Number(p.comision_pct) || 0;
  return Math.round(((baseComision(p) * pct) / 100) * 100) / 100;
}

const CERRADOS: EstadoPropiedad[] = ['Vendido', 'Rentado'];

export interface ResumenComisiones {
  ganadoMes: number;
  ganadoAnio: number;
  negociacionTotal: number;
  negociacionPonderada: number;
  /** Últimos 6 meses, del más antiguo al actual. */
  ultimos6: Array<{ mes: string; etiqueta: string; total: number }>;
  porEstado: Record<EstadoPropiedad, number>;
  disponibles: Record<string, number>; // "Casa · Venta" -> n
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function mesesAtras(mesActual: string, n: number): string {
  const [a, m] = mesActual.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 - n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function resumirComisiones(
  propiedades: Propiedad[],
  probabilidadCierre: number,
  ahora: Date = new Date(),
  timeZone?: string,
): ResumenComisiones {
  const vivas = propiedades.filter((p) => !p.deleted_at);
  const mesActual = mesDe(ahora.toISOString(), timeZone);
  const anioActual = mesActual.slice(0, 4);
  const prob = Math.min(100, Math.max(0, Number(probabilidadCierre) || 0));

  const ultimos6 = Array.from({ length: 6 }, (_, i) => {
    const mes = mesesAtras(mesActual, 5 - i);
    return { mes, etiqueta: MESES[Number(mes.slice(5)) - 1], total: 0 };
  });

  const porEstado: Record<EstadoPropiedad, number> = {
    Disponible: 0,
    'En Negociación': 0,
    Vendido: 0,
    Rentado: 0,
  };
  const disponibles: Record<string, number> = {};

  let ganadoMes = 0;
  let ganadoAnio = 0;
  let negociacionTotal = 0;

  for (const p of vivas) {
    porEstado[p.estado] = (porEstado[p.estado] ?? 0) + 1;
    if (p.estado === 'Disponible') {
      const k = `${p.tipo} · ${p.operacion}`;
      disponibles[k] = (disponibles[k] ?? 0) + 1;
    }
    if (p.estado === 'En Negociación') negociacionTotal += comision(p);
    if (CERRADOS.includes(p.estado) && p.cerrado_en) {
      const c = comision(p);
      const mes = mesDe(p.cerrado_en, timeZone);
      if (mes === mesActual) ganadoMes += c;
      if (mes.slice(0, 4) === anioActual) ganadoAnio += c;
      const fila = ultimos6.find((u) => u.mes === mes);
      if (fila) fila.total += c;
    }
  }

  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    ganadoMes: r2(ganadoMes),
    ganadoAnio: r2(ganadoAnio),
    negociacionTotal: r2(negociacionTotal),
    negociacionPonderada: r2((negociacionTotal * prob) / 100),
    ultimos6: ultimos6.map((u) => ({ ...u, total: r2(u.total) })),
    porEstado,
    disponibles,
  };
}
