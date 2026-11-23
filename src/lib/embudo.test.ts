import { describe, expect, it } from 'vitest';
import { agrupar, anguloDe, calcularEmbudo, cambiosPaso, canalDe, fechaDelLead, leadsDe, mesDelLead, rangoRapido, textoPeriodo } from './embudo.ts';
import type { Cliente } from './tipos.ts';

let n = 0;
function lead(c: Partial<Cliente>): Cliente {
  n++;
  return {
    id: `c${n}`, created_at: '2026-11-10T15:00:00Z', updated_at: '', deleted_at: null,
    nombre: `Lead ${n}`, telefono: '', interes: 'Busca Comprar Casa', presupuesto_max: null,
    ubicacion_deseada: '', etapa: 'Nuevo', llamo: null, llamo_en: null, notas: '', external_key: null,
    propiedad_interes: 'Casa Tumbaco', fuente: 'Facebook - Ángulo: Ubicación', fecha_lead: '2026-11-10',
    respondio: null, respondio_en: null, agendo: null, agendo_en: null, asistio: null, asistio_en: null,
    seguimiento: null, seguimiento_en: null, oferta: null, oferta_en: null, oferta_monto: null,
    ...c,
  };
}

describe('embudo', () => {
  const leads = [
    lead({ respondio: 'si', agendo: 'si', asistio: 'si', seguimiento: 'si', oferta: 'verbal' }),
    lead({ respondio: 'si', agendo: 'si', asistio: 'si', seguimiento: 'no', oferta: 'no' }),
    lead({ respondio: 'si', agendo: 'si', asistio: 'no' }),
    lead({ respondio: 'si', agendo: 'no' }),
    lead({ respondio: 'si' }),
    lead({ respondio: 'no' }),
    lead({}),
    lead({}),
  ];

  it('mide cada paso sobre quienes pasaron el anterior', () => {
    const e = calcularEmbudo(leads);
    expect(e.leads).toBe(8);
    const [r, a, s, seg, of] = e.pasos;
    expect(r).toMatchObject({ base_total: 8, si: 5, no: 1, pendiente: 2, pct: 63 });
    expect(a).toMatchObject({ base_total: 5, si: 3, no: 1, pendiente: 1, pct: 60 });
    expect(s).toMatchObject({ base_total: 3, si: 2, no: 1, pendiente: 0, pct: 67 });
    expect(seg).toMatchObject({ base_total: 2, si: 1, no: 1, pendiente: 0, pct: 50 });
    expect(of).toMatchObject({ base_total: 2, si: 1, no: 1, pendiente: 0, pct: 50 });
  });

  it('sin leads no divide entre cero', () => {
    expect(calcularEmbudo([]).pasos.every((p) => p.pct === 0 && p.base_total === 0)).toBe(true);
  });

  it('no cuenta propietarios ni borrados, y filtra por propiedad, canal y mes', () => {
    const lista = [
      lead({}),
      lead({ interes: 'Propietario/Consignador' }),
      lead({ deleted_at: '2026-11-11' }),
      lead({ propiedad_interes: 'Terreno Santa Rosa', fuente: 'Instagram - Ángulo: Precio' }),
      lead({ fecha_lead: '2026-10-30' }),
    ];
    expect(leadsDe(lista)).toHaveLength(3);
    expect(leadsDe(lista, { propiedad: 'Terreno Santa Rosa' })).toHaveLength(1);
    expect(leadsDe(lista, { canal: 'Instagram' })).toHaveLength(1);
    expect(leadsDe(lista, { mes: '2026-10' })).toHaveLength(1);
  });

  it('filtra por rango de fechas, con ambos extremos incluidos', () => {
    const lista = [
      lead({ fecha_lead: '2026-11-14' }),
      lead({ fecha_lead: '2026-11-15' }),
      lead({ fecha_lead: '2026-11-18' }),
      lead({ fecha_lead: '2026-11-22' }),
      lead({ fecha_lead: '2026-11-23' }),
      lead({ fecha_lead: null, created_at: '2026-11-19T15:00:00Z' }),
    ];
    expect(leadsDe(lista, { desde: '2026-11-15', hasta: '2026-11-22' })).toHaveLength(4);
    expect(leadsDe(lista, { desde: '2026-11-20' })).toHaveLength(2);
    expect(leadsDe(lista, { hasta: '2026-11-14' })).toHaveLength(1);
    expect(fechaDelLead({ fecha_lead: null, created_at: '2026-11-20T03:00:00Z' }, 'America/Guayaquil')).toBe('2026-11-19');
  });

  it('agrupa por propiedad', () => {
    const lista = [lead({ respondio: 'si' }), lead({}), lead({ propiedad_interes: 'Terreno Santa Rosa', respondio: 'si', agendo: 'si' })];
    expect(agrupar(lista, (c) => c.propiedad_interes)).toEqual([
      { nombre: 'Casa Tumbaco', leads: 2, respondio: 1, agendo: 0, asistio: 0, oferta: 0 },
      { nombre: 'Terreno Santa Rosa', leads: 1, respondio: 1, agendo: 1, asistio: 0, oferta: 0 },
    ]);
  });
});

describe('marcar pasos', () => {
  const ahora = '2026-11-22T20:00:00Z';

  it('al marcar que asistió, completa los pasos anteriores y mueve la etapa', () => {
    expect(cambiosPaso(lead({}), 'asistio', 'si', ahora)).toEqual({
      asistio: 'si', asistio_en: ahora, respondio: 'si', respondio_en: ahora, agendo: 'si', agendo_en: ahora, etapa: 'Cita Agendada',
    });
  });
  it('una oferta verbal lleva a "Oferta Enviada" sin retroceder etapas', () => {
    expect(cambiosPaso(lead({ respondio: 'si', agendo: 'si', asistio: 'si', etapa: 'Cita Agendada' }), 'oferta', 'verbal', ahora)).toEqual({
      oferta: 'verbal', oferta_en: ahora, etapa: 'Oferta Enviada',
    });
    expect(cambiosPaso(lead({ etapa: 'Cerrado', respondio: 'si' }), 'respondio', 'si', ahora)).toEqual({ respondio: 'si', respondio_en: ahora });
  });
  it('las etapas "Solo quiere información", "Cita más adelante" y "No le interesa" avanzan al agendar', () => {
    for (const etapa of ['Solo quiere información', 'Cita más adelante', 'No le interesa'] as const) {
      expect(cambiosPaso(lead({ etapa, respondio: 'si' }), 'agendo', 'si', ahora).etapa).toBe('Cita Agendada');
    }
    expect(cambiosPaso(lead({ etapa: 'No le interesa' }), 'respondio', 'si', ahora).etapa).toBe('Contactado');
    expect(cambiosPaso(lead({ etapa: 'Solo quiere información' }), 'respondio', 'si', ahora).etapa).toBeUndefined();
  });
  it('un "no" o borrar no toca otros pasos', () => {
    expect(cambiosPaso(lead({}), 'agendo', 'no', ahora)).toEqual({ agendo: 'no', agendo_en: ahora });
    expect(cambiosPaso(lead({ agendo: 'si' }), 'agendo', null, ahora)).toEqual({ agendo: null, agendo_en: null });
  });
});

describe('fuente', () => {
  it.each([
    ['Facebook - Ángulo: Ubicación', 'Facebook', 'Ubicación'],
    ['Instagram - Ángulo: Jardín 75 m²', 'Instagram', 'Jardín 75 m²'],
    ['Facebook Marketplace', 'Marketplace', ''],
    ['Referido por Ana', 'Referido', ''],
    ['', 'Sin fuente', ''],
    ['Feria de vivienda', 'Feria de vivienda', ''],
  ])('%s', (f, canal, angulo) => {
    expect(canalDe(f)).toBe(canal);
    expect(anguloDe(f)).toBe(angulo);
  });
  it('tolera datos viejos sin fuente', () => {
    expect(canalDe(undefined)).toBe('Sin fuente');
    expect(anguloDe(null)).toBe('');
  });
  it('usa la fecha del formulario o la de alta', () => {
    expect(mesDelLead({ fecha_lead: '2026-10-31', created_at: '2026-11-22T00:00:00Z' })).toBe('2026-10');
    expect(mesDelLead({ fecha_lead: null, created_at: '2026-11-22T00:00:00Z' })).toBe('2026-11');
  });
});

describe('periodo del informe', () => {
  it.each([
    [{ desde: '2026-11-15', hasta: '2026-11-22' }, 'Del 15 al 22 de noviembre de 2026'],
    [{ desde: '2026-10-28', hasta: '2026-11-05' }, 'Del 28 de octubre al 5 de noviembre de 2026'],
    [{ desde: '2025-12-20', hasta: '2026-01-10' }, 'Del 20 de diciembre de 2025 al 10 de enero de 2026'],
    [{ desde: '2026-11-22', hasta: '2026-11-22' }, '22 de noviembre de 2026'],
    [{ desde: '2026-11-15' }, 'Desde el 15 de noviembre de 2026'],
    [{ hasta: '2026-11-22' }, 'Hasta el 22 de noviembre de 2026'],
    [{}, 'Todo el periodo registrado'],
  ])('%o', (f, t) => {
    expect(textoPeriodo(f)).toBe(t);
  });
  it('atajos de fechas', () => {
    expect(rangoRapido('7dias', '2026-11-22')).toEqual({ desde: '2026-11-16', hasta: '2026-11-22' });
    expect(rangoRapido('mes', '2026-11-22')).toEqual({ desde: '2026-11-01', hasta: '2026-11-22' });
    expect(rangoRapido('mesAnterior', '2026-11-22')).toEqual({ desde: '2026-10-01', hasta: '2026-10-31' });
    expect(rangoRapido('mesAnterior', '2026-01-10')).toEqual({ desde: '2025-12-01', hasta: '2025-12-31' });
  });
});
