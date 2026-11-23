import { describe, expect, it } from 'vitest';
import { buscarCoincidencias, filtroDeCliente, filtroDesdeTexto, haceJuego, ubicacionCoincide } from './matching.ts';
import type { Cliente, Propiedad } from './tipos.ts';

let n = 0;
function prop(p: Partial<Propiedad>): Propiedad {
  n++;
  return {
    id: `p${n}`,
    created_at: '',
    updated_at: '',
    deleted_at: null,
    tipo: 'Casa',
    operacion: 'Venta',
    estado: 'Disponible',
    precio: 200000,
    precio_renta: null,
    comision_pct: 3,
    direccion: 'Tumbaco, La Morita',
    m2_terreno: null,
    m2_construccion: null,
    recamaras: 3,
    amenidades: '',
    link_fotos: null,
    cerrado_en: null,
    external_key: null,
    ...p,
  };
}

const cliente = (c: Partial<Cliente>): Cliente => ({
  id: 'c1',
  created_at: '',
  updated_at: '',
  deleted_at: null,
  nombre: 'Ana',
  telefono: '593999123456',
  interes: 'Busca Comprar Casa',
  presupuesto_max: 250000,
  ubicacion_deseada: 'Tumbaco',
  etapa: 'Nuevo',
  llamo: null,
  llamo_en: null,
  notas: '',
  external_key: null,
  ...c,
});

describe('filtro desde el cliente', () => {
  it('traduce el interés a tipo y operación', () => {
    expect(filtroDeCliente(cliente({ interes: 'Busca Comprar Casa' }))).toMatchObject({ tipo: 'Casa', operacion: 'Venta' });
    expect(filtroDeCliente(cliente({ interes: 'Busca Rentar Casa' }))).toMatchObject({ tipo: 'Casa', operacion: 'Renta' });
    expect(filtroDeCliente(cliente({ interes: 'Busca Comprar Terreno' }))).toMatchObject({ tipo: 'Terreno', operacion: 'Venta' });
    expect(filtroDeCliente(cliente({ interes: 'Propietario/Consignador' }))).toMatchObject({ tipo: null, operacion: null });
  });
  it('copia presupuesto y ubicación', () => {
    expect(filtroDeCliente(cliente({}))).toMatchObject({ precioMax: 250000, ubicacion: 'Tumbaco' });
  });
});

describe('coincidencias', () => {
  const f = filtroDeCliente(cliente({}));

  it('acepta misma operación y precio menor o igual al presupuesto', () => {
    expect(haceJuego(prop({ precio: 250000 }), f)).toBe(true);
    expect(haceJuego(prop({ precio: 250001 }), f)).toBe(false);
  });
  it('"Venta y Renta" sirve para quien compra y para quien renta', () => {
    expect(haceJuego(prop({ operacion: 'Venta y Renta' }), f)).toBe(true);
    const renta = filtroDeCliente(cliente({ interes: 'Busca Rentar Casa', presupuesto_max: 1000 }));
    expect(haceJuego(prop({ operacion: 'Venta y Renta', precio: 200000, precio_renta: 900 }), renta)).toBe(true);
    expect(haceJuego(prop({ operacion: 'Venta y Renta', precio: 200000, precio_renta: 1200 }), renta)).toBe(false);
  });
  it('rechaza otra operación, otro tipo, no disponibles y borradas', () => {
    expect(haceJuego(prop({ operacion: 'Renta', precio: 900 }), f)).toBe(false);
    expect(haceJuego(prop({ tipo: 'Terreno' }), f)).toBe(false);
    expect(haceJuego(prop({ estado: 'En Negociación' }), f)).toBe(false);
    expect(haceJuego(prop({ estado: 'Vendido' }), f)).toBe(false);
    expect(haceJuego(prop({ deleted_at: '2026-01-01' }), f)).toBe(false);
  });
  it('compara la ubicación sin tildes ni mayúsculas', () => {
    expect(ubicacionCoincide('Av. Interoceánica, CUMBAYÁ', 'cumbaya')).toBe(true);
    expect(ubicacionCoincide('Puembo centro', 'Tumbaco o Puembo')).toBe(true);
    expect(ubicacionCoincide('Conocoto', 'Tumbaco')).toBe(false);
    expect(ubicacionCoincide('Cualquier lugar', '')).toBe(true);
    expect(haceJuego(prop({ direccion: 'Conocoto' }), f)).toBe(false);
  });
  it('sin presupuesto no filtra por precio', () => {
    expect(haceJuego(prop({ precio: 9_000_000 }), { ...f, precioMax: null })).toBe(true);
  });
  it('ordena de la más cara a la más barata', () => {
    const lista = [prop({ precio: 100000 }), prop({ precio: 240000 }), prop({ precio: 300000 }), prop({ precio: 180000 })];
    expect(buscarCoincidencias(lista, f).map((p) => p.precio)).toEqual([240000, 180000, 100000]);
  });
});

describe('filtro escrito a mano', () => {
  it('"Casa en Venta < $250k"', () => {
    expect(filtroDesdeTexto('Casa en Venta < $250k')).toEqual({ tipo: 'Casa', operacion: 'Venta', precioMax: 250000, ubicacion: '' });
  });
  it('"terreno tumbaco hasta 80 mil"', () => {
    expect(filtroDesdeTexto('terreno tumbaco hasta 80 mil')).toEqual({ tipo: 'Terreno', operacion: null, precioMax: 80000, ubicacion: 'tumbaco' });
  });
  it('"arriendo casa Cumbayá menos de 900"', () => {
    expect(filtroDesdeTexto('arriendo casa Cumbayá menos de 900')).toEqual({ tipo: 'Casa', operacion: 'Renta', precioMax: 900, ubicacion: 'cumbaya' });
  });
  it('"casa venta <= 1.2 millones"', () => {
    expect(filtroDesdeTexto('casa venta <= 1.2 millones').precioMax).toBe(1_200_000);
  });
  it('"Casa en Venta < $250.000"', () => {
    expect(filtroDesdeTexto('Casa en Venta < $250.000').precioMax).toBe(250000);
  });
});
