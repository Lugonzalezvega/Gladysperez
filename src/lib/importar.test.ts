import { describe, expect, it } from 'vitest';
import { leerCsv } from './csv.ts';
import { aNumero } from './texto.ts';
import { normalizarTelefono } from './telefono.ts';
import { aFecha, enlaceCsvDeSheets, idDeterminista, planificarImportacion } from './importar.ts';
import { enlaceWhatsApp } from './whatsapp.ts';
import { urlHttpsSegura } from './seguridad.ts';

describe('teléfonos de Ecuador', () => {
  it.each([
    ['0999123456', '593999123456'],
    ['099 912 3456', '593999123456'],
    ['+593 99 912 3456', '593999123456'],
    ['00593999123456', '593999123456'],
    ['5930999123456', '593999123456'],
    ['999123456', '593999123456'],
    ['02 234 5678', '59322345678'],
    ['', ''],
  ])('%s -> %s', (entrada, salida) => {
    expect(normalizarTelefono(entrada)).toBe(salida);
  });
});

describe('números', () => {
  it.each([
    ['$250.000', 250000],
    ['250,000.50', 250000.5],
    ['1.250,75', 1250.75],
    ['250k', 250000],
    ['80 mil', 80000],
    ['3,5', 3.5],
    ['3', 3],
    ['500 m2', 500],
    ['', null],
    ['consultar', null],
  ])('%s -> %s', (entrada, salida) => {
    expect(aNumero(entrada)).toBe(salida);
  });
});

describe('CSV', () => {
  it('maneja comillas, comas, saltos de línea, BOM y punto y coma', () => {
    expect(leerCsv('﻿a,b\r\n"x, y","línea 1\nlínea 2"\r\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'línea 1\nlínea 2'],
    ]);
    expect(leerCsv('a;b\n1;"2;3"\n')).toEqual([
      ['a', 'b'],
      ['1', '2;3'],
    ]);
    expect(leerCsv('a\n"di ""hola"""\n')).toEqual([['a'], ['di "hola"']]);
  });
});

describe('enlaces de Google Sheets', () => {
  it('acepta el enlace publicado y el de edición', () => {
    expect(enlaceCsvDeSheets('https://docs.google.com/spreadsheets/d/e/2PACX-abc/pubhtml')).toBe(
      'https://docs.google.com/spreadsheets/d/e/2PACX-abc/pub?output=csv',
    );
    expect(enlaceCsvDeSheets('https://docs.google.com/spreadsheets/d/e/2PACX-abc/pub?gid=5&single=true&output=csv')).toBe(
      'https://docs.google.com/spreadsheets/d/e/2PACX-abc/pub?gid=5&single=true&output=csv',
    );
    expect(enlaceCsvDeSheets('https://docs.google.com/spreadsheets/d/1AbC_d-9/edit#gid=123')).toBe(
      'https://docs.google.com/spreadsheets/d/1AbC_d-9/export?format=csv&gid=123',
    );
  });
  it('rechaza otros sitios y http', () => {
    expect(enlaceCsvDeSheets('http://docs.google.com/spreadsheets/d/1/edit')).toBeNull();
    expect(enlaceCsvDeSheets('https://evil.com/spreadsheets/d/1/edit')).toBeNull();
    expect(enlaceCsvDeSheets('javascript:alert(1)')).toBeNull();
  });
});

describe('plan de importación', () => {
  const base = { userId: 'u1', hoy: '2026-11-21', clientesExistentes: [], propiedadesExistentes: [] };

  it('reconoce encabezados sin tildes ni mayúsculas y crea tarea "Llamar a …"', async () => {
    const csv = 'NOMBRE,Teléfono,Interés,Presupuesto,Ubicación\nAna Pérez,0999123456,Quiere arrendar casa,"$900",Cumbayá\n';
    const plan = await planificarImportacion(csv, base);
    expect(plan.tipoHoja).toBe('clients');
    expect(plan.clientes.nuevos).toHaveLength(1);
    const c = plan.clientes.nuevos[0];
    expect(c.campos).toMatchObject({
      nombre: 'Ana Pérez',
      telefono: '593999123456',
      interes: 'Busca Rentar Casa',
      presupuesto_max: 900,
      ubicacion_deseada: 'Cumbayá',
      external_key: 'tel:593999123456',
    });
    expect(plan.tareas).toEqual([
      { id: expect.any(String), tipo: 'Llamada', texto: 'Llamar a Ana Pérez', fecha: '2026-11-21', client_id: c.id },
    ]);
  });

  it('es idempotente: el mismo cliente produce el mismo id y no se duplica', async () => {
    const csv = 'Nombre,Celular\nAna,0999123456\nAna repetida,+593 99 912 3456\n';
    const a = await planificarImportacion(csv, base);
    const b = await planificarImportacion(csv, base);
    expect(a.clientes.nuevos).toHaveLength(1);
    expect(a.omitidas).toBe(1);
    expect(a.clientes.nuevos[0].id).toBe(b.clientes.nuevos[0].id);
    expect(a.tareas[0].id).toBe(b.tareas[0].id);
  });

  it('actualiza solo lo que cambió, sin tocar la etapa ni borrar con celdas vacías', async () => {
    const existente = {
      id: 'c-1',
      external_key: 'tel:593999123456',
      deleted_at: null,
      nombre: 'Ana',
      telefono: '593999123456',
      interes: 'Busca Comprar Casa',
      presupuesto_max: 200000,
      ubicacion_deseada: 'Tumbaco',
      notas: 'importante',
      etapa: 'Cita Agendada',
    };
    const csv = 'Nombre,Teléfono,Presupuesto,Notas,Etapa\nAna,0999123456,250000,,Nuevo\n';
    const plan = await planificarImportacion(csv, { ...base, clientesExistentes: [existente] });
    expect(plan.clientes.nuevos).toHaveLength(0);
    expect(plan.tareas).toHaveLength(0);
    expect(plan.clientes.cambios).toEqual([{ id: 'c-1', cambios: { presupuesto_max: 250000 } }]);
  });

  it('reconoce clientes y propiedades creados a mano y los enlaza con la hoja', async () => {
    const manual = { id: 'c-9', external_key: null, deleted_at: null, nombre: 'Ana', telefono: '593999123456', etapa: 'Contactado' };
    const plan = await planificarImportacion('Nombre,Teléfono\nAna Pérez,0999123456\n', { ...base, clientesExistentes: [manual] });
    expect(plan.clientes.nuevos).toHaveLength(0);
    expect(plan.tareas).toHaveLength(0);
    expect(plan.clientes.cambios).toEqual([{ id: 'c-9', cambios: { nombre: 'Ana Pérez', external_key: 'tel:593999123456' } }]);

    const casa = { id: 'p-9', external_key: null, deleted_at: null, tipo: 'Casa', operacion: 'Venta', direccion: 'Tumbaco ', precio: 1 };
    const p2 = await planificarImportacion('Código,Tipo,Operación,Precio,Dirección\nX-1,Casa,Venta,2,tumbaco\n', { ...base, propiedadesExistentes: [casa] });
    expect(p2.propiedades.nuevas).toHaveLength(0);
    expect(p2.propiedades.cambios[0]).toMatchObject({ id: 'p-9', cambios: { precio: 2, external_key: 'id:x-1' } });
  });

  it('no revive clientes borrados en la app', async () => {
    const existente = { id: 'c-1', external_key: 'tel:593999123456', deleted_at: '2026-11-01', nombre: 'Ana' };
    const plan = await planificarImportacion('Nombre,Teléfono\nAna,0999123456\n', { ...base, clientesExistentes: [existente] });
    expect(plan.clientes.nuevos).toHaveLength(0);
    expect(plan.clientes.cambios).toHaveLength(0);
  });

  it('importa propiedades y descarta enlaces que no son https', async () => {
    const csv =
      'Código;Tipo;Operación;Precio;Ubicación;Terreno m2;Habitaciones;Fotos;Estado\n' +
      'A-1;Lote;Venta;"85.000";Puembo;1.200;;http://inseguro.com;\n' +
      'A-2;Casa;Venta y arriendo;250000;Tumbaco;500;3;https://drive.google.com/x;Reservada\n';
    const plan = await planificarImportacion(csv, base);
    expect(plan.tipoHoja).toBe('properties');
    expect(plan.propiedades.nuevas).toHaveLength(2);
    expect(plan.propiedades.nuevas[0].campos).toMatchObject({
      tipo: 'Terreno', operacion: 'Venta', precio: 85000, direccion: 'Puembo', m2_terreno: 1200,
      link_fotos: null, external_key: 'id:a-1', estado: 'Disponible',
    });
    expect(plan.propiedades.nuevas[1].campos).toMatchObject({
      tipo: 'Casa', operacion: 'Venta y Renta', recamaras: 3, link_fotos: 'https://drive.google.com/x', estado: 'En Negociación',
    });
    expect(plan.tareas).toHaveLength(0);
  });

  it('lee el formulario de leads de Gladys (encabezados en la fila 4, datos de prueba)', async () => {
    const csv = [
      'Prospectos Gladys,,,,,,,,,',
      'Total de personas interesadas: 2,,,,,,,,,',
      ',,,,,,,,,',
      'Fecha,Nombre,Teléfono,Correo,Propiedad,De donde vino,Propiedad y precio le convienen,Cómo piensa comprar / Para qué lo busca,Quiere agendar visita,Aviso al cliente',
      '21/11/2026,MARÍA LÓPEZ,+593991234567,maria@ejemplo.com,Terreno Santa Rosa,Facebook - .Ángulo: Ubicación,Sí,Contado,"Sí, esta semana",Avisado',
      '20/11/2026,juan pérez,+593987654321,juan@ejemplo.com,Casa Tumbaco,Instagram - Ángulo: Jardín 75 m²,Sí,Crédito hipotecario,Solo quiero información,Avisado',
    ].join('\n');
    const plan = await planificarImportacion(csv, base);
    expect(plan.tipoHoja).toBe('clients');
    expect(plan.omitidas).toBe(0);
    const [maria, juan] = plan.clientes.nuevos.map((n) => n.campos);
    expect(maria).toMatchObject({ nombre: 'María López', telefono: '593991234567', interes: 'Busca Comprar Terreno' });
    expect(juan).toMatchObject({ nombre: 'Juan Pérez', telefono: '593987654321', interes: 'Busca Comprar Casa' });
    expect(maria).toMatchObject({
      propiedad_interes: 'Terreno Santa Rosa',
      fuente: 'Facebook - Ángulo: Ubicación',
      fecha_lead: '2026-11-21',
    });
    expect(juan).toMatchObject({ propiedad_interes: 'Casa Tumbaco', fuente: 'Instagram - Ángulo: Jardín 75 m²', fecha_lead: '2026-11-20' });
    expect(maria.notas).not.toContain('Propiedad:');
    expect(maria.notas).toContain('Compra: Contado');
    expect(maria.notas).toContain('Visita: Sí, esta semana');
    expect(maria.notas).toContain('Correo: maria@ejemplo.com');
    expect(maria.notas).not.toContain('Avisado');
    expect(plan.tareas.map((t) => t.texto)).toEqual([
      'Llamar a María López — quiere visitar esta semana',
      'Llamar a Juan Pérez',
    ]);

    // Segunda pasada con la app ya al día: no crea nada ni pisa las notas editadas.
    const existentes = plan.clientes.nuevos.map((n) => ({ id: n.id, deleted_at: null, ...n.campos, notas: 'editado en la app' }));
    const otra = await planificarImportacion(csv, { ...base, clientesExistentes: existentes });
    expect(otra.clientes.nuevos).toHaveLength(0);
    expect(otra.clientes.cambios).toHaveLength(0);
    expect(otra.tareas).toHaveLength(0);
  });

  it('avisa si no reconoce la hoja', async () => {
    const plan = await planificarImportacion('foo,bar\n1,2\n', base);
    expect(plan.tipoHoja).toBe('desconocida');
  });

  it('genera UUID válidos', async () => {
    expect(await idDeterminista('x')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('fechas de la hoja', () => {
  it.each([
    ['21/11/2026', '2026-11-21'],
    ['1/2/2026 10:30:00', '2026-02-01'],
    ['21-11-26', '2026-11-21'],
    ['2026-11-21T10:00', '2026-11-21'],
    ['31/02/2026', null],
    ['ayer', null],
    ['', null],
  ])('%s -> %s', (e, s) => {
    expect(aFecha(e)).toBe(s);
  });
});

describe('WhatsApp y enlaces', () => {
  it('arma el enlace wa.me con el mensaje codificado', () => {
    expect(enlaceWhatsApp('0999123456', 'Hola & ¿qué tal?')).toBe(
      'https://wa.me/593999123456?text=Hola%20%26%20%C2%BFqu%C3%A9%20tal%3F',
    );
  });
  it('solo permite enlaces https', () => {
    expect(urlHttpsSegura('https://drive.google.com/a')).toBe('https://drive.google.com/a');
    expect(urlHttpsSegura('http://drive.google.com/a')).toBeNull();
    expect(urlHttpsSegura('javascript:alert(1)')).toBeNull();
    expect(urlHttpsSegura('https://user:pass@evil.com')).toBeNull();
  });
});
