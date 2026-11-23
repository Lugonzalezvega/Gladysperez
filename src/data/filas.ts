import type { FilasPorTabla, Tabla } from '../lib/tipos.ts';
import { hoyISO } from '../lib/texto.ts';

/** Valores por defecto de cada columna (todas las filas se envían completas). */
export function valoresPorDefecto(tabla: Tabla): Record<string, unknown> {
  switch (tabla) {
    case 'properties':
      return {
        tipo: 'Casa', operacion: 'Venta', estado: 'Disponible', precio: 0, precio_renta: null,
        comision_pct: 3, direccion: '', m2_terreno: null, m2_construccion: null, recamaras: null,
        amenidades: '', link_fotos: null, cerrado_en: null, external_key: null,
      };
    case 'clients':
      return {
        nombre: '', telefono: '', interes: 'Busca Comprar Casa', presupuesto_max: null,
        ubicacion_deseada: '', etapa: 'Nuevo', llamo: null, llamo_en: null, notas: '', external_key: null,
      };
    case 'tasks':
      return { tipo: 'Llamada', texto: '', fecha: hoyISO(), hora: null, hecha: false, llamo: null, client_id: null };
    case 'settings':
      return { drive_url: '', ultima_importacion: null, probabilidad_cierre: 60 };
  }
}

const COLUMNAS_BASE = ['id', 'user_id', 'created_at', 'updated_at', 'deleted_at'];

/** Deja solo las columnas que existen en la tabla (evita enviar basura al servidor). */
export function soloColumnas<T extends Tabla>(tabla: T, fila: Record<string, unknown>): FilasPorTabla[T] {
  const permitidas = new Set([...COLUMNAS_BASE, ...Object.keys(valoresPorDefecto(tabla))]);
  const limpia: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fila)) if (permitidas.has(k)) limpia[k] = v;
  return limpia as unknown as FilasPorTabla[T];
}
