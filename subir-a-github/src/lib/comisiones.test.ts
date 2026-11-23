import { describe, expect, it } from 'vitest';
import { baseComision, comision, resumirComisiones } from './comisiones.ts';
import type { Propiedad } from './tipos.ts';

let n = 0;
function prop(p: Partial<Propiedad>): Propiedad {
  n++;
  return {
    id: `p${n}`,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    deleted_at: null,
    tipo: 'Casa',
    operacion: 'Venta',
    estado: 'Disponible',
    precio: 100000,
    precio_renta: null,
    comision_pct: 3,
    direccion: 'Tumbaco',
    m2_terreno: null,
    m2_construccion: null,
    recamaras: null,
    amenidades: '',
    link_fotos: null,
    cerrado_en: null,
    external_key: null,
    ...p,
  };
}

describe('comisión de una propiedad', () => {
  it('venta: precio × % / 100', () => {
    expect(comision(prop({ precio: 250000, comision_pct: 3 }))).toBe(7500);
  });

  it('renta: 100 % equivale a un mes de canon', () => {
    expect(comision(prop({ operacion: 'Renta', precio: 900, comision_pct: 100 }))).toBe(900);
    expect(comision(prop({ operacion: 'Renta', precio: 900, comision_pct: 50 }))).toBe(450);
  });

  it('venta y renta cerrada como Rentado usa el canon', () => {
    const p = prop({ operacion: 'Venta y Renta', estado: 'Rentado', precio: 200000, precio_renta: 1000, comision_pct: 100 });
    expect(baseComision(p)).toBe(1000);
    expect(comision(p)).toBe(1000);
  });

  it('venta y renta vendida usa el precio de venta', () => {
    const p = prop({ operacion: 'Venta y Renta', estado: 'Vendido', precio: 200000, precio_renta: 1000, comision_pct: 4 });
    expect(comision(p)).toBe(8000);
  });

  it('redondea a centavos y tolera valores vacíos', () => {
    expect(comision(prop({ precio: 123456.78, comision_pct: 2.5 }))).toBe(3086.42);
    expect(comision(prop({ precio: 0, comision_pct: 3 }))).toBe(0);
    expect(comision(prop({ comision_pct: Number.NaN }))).toBe(0);
  });
});

describe('resumen del tablero', () => {
  const ahora = new Date('2026-11-15T15:00:00Z');
  const props = [
    prop({ estado: 'Vendido', precio: 200000, comision_pct: 3, cerrado_en: '2026-11-03T15:00:00Z' }), // 6000 este mes
    prop({ estado: 'Rentado', operacion: 'Renta', precio: 800, comision_pct: 100, cerrado_en: '2026-09-10T15:00:00Z' }), // 800 sept
    prop({ estado: 'Vendido', precio: 100000, comision_pct: 5, cerrado_en: '2025-12-20T15:00:00Z' }), // año pasado
    prop({ estado: 'En Negociación', precio: 300000, comision_pct: 3 }), // 9000
    prop({ estado: 'En Negociación', operacion: 'Renta', precio: 1000, comision_pct: 100 }), // 1000
    prop({ estado: 'Disponible', tipo: 'Terreno' }),
    prop({ estado: 'Disponible' }),
    prop({ estado: 'Disponible' }),
    prop({ estado: 'Vendido', precio: 999999, comision_pct: 10, cerrado_en: '2026-11-01T15:00:00Z', deleted_at: '2026-11-02T00:00:00Z' }), // borrada
  ];
  const r = resumirComisiones(props, 60, ahora, 'America/Guayaquil');

  it('suma lo ganado en el mes y en el año', () => {
    expect(r.ganadoMes).toBe(6000);
    expect(r.ganadoAnio).toBe(6800);
  });

  it('calcula negociación total y ponderada por la probabilidad', () => {
    expect(r.negociacionTotal).toBe(10000);
    expect(r.negociacionPonderada).toBe(6000);
  });

  it('agrupa los últimos 6 meses', () => {
    expect(r.ultimos6.map((m) => m.mes)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
    expect(r.ultimos6.find((m) => m.mes === '2026-09')?.total).toBe(800);
    expect(r.ultimos6.at(-1)?.total).toBe(6000);
  });

  it('cuenta inventario por estado y disponibles por tipo y operación, sin borradas', () => {
    expect(r.porEstado).toEqual({ Disponible: 3, 'En Negociación': 2, Vendido: 2, Rentado: 1 });
    expect(r.disponibles).toEqual({ 'Terreno · Venta': 1, 'Casa · Venta': 2 });
  });

  it('respeta la zona horaria de Ecuador al cambiar de mes', () => {
    // 1 de diciembre 02:00 UTC = 30 de noviembre 21:00 en Quito
    const p = prop({ estado: 'Vendido', precio: 100000, comision_pct: 1, cerrado_en: '2026-12-01T02:00:00Z' });
    const r2 = resumirComisiones([p], 60, new Date('2026-11-30T20:00:00Z'), 'America/Guayaquil');
    expect(r2.ganadoMes).toBe(1000);
  });

  it('limita la probabilidad entre 0 y 100', () => {
    expect(resumirComisiones(props, 150, ahora, 'America/Guayaquil').negociacionPonderada).toBe(10000);
    expect(resumirComisiones(props, -5, ahora, 'America/Guayaquil').negociacionPonderada).toBe(0);
  });
});
