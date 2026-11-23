// Importación desde Google Sheets / CSV.
// Código compartido por la app (botón "Importar") y por el script del
// workflow de GitHub Actions (scripts/importar-drive.ts). No usa React ni Supabase.

import type { Cliente, EstadoPropiedad, Interes, Operacion, Propiedad, TipoPropiedad } from './tipos.ts';
import { filasAObjetos, leerCsv } from './csv.ts';
import { aNumero, claveEncabezado, sinTildes } from './texto.ts';
import { normalizarTelefono } from './telefono.ts';

// ---------------------------------------------------------------------
// Enlaces de Google Sheets
// ---------------------------------------------------------------------

/**
 * Convierte un enlace de Google Sheets en el enlace de descarga CSV.
 * Acepta el enlace "Publicar en la web" (…/pub?output=csv) o el enlace normal
 * de edición (…/d/<ID>/edit#gid=<GID>). Devuelve null si no es de Google Sheets.
 */
export function enlaceCsvDeSheets(entrada: string): string | null {
  let u: URL;
  try {
    u = new URL(entrada.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' || u.hostname !== 'docs.google.com') return null;
  if (!u.pathname.startsWith('/spreadsheets/')) return null;

  // Enlace publicado: /spreadsheets/d/e/<ID>/pub?...
  if (/\/spreadsheets\/d\/e\/[^/]+\/pub(html)?$/.test(u.pathname)) {
    const out = new URL(u.toString());
    out.pathname = out.pathname.replace(/pubhtml$/, 'pub');
    out.searchParams.set('output', 'csv');
    out.hash = '';
    return out.toString();
  }
  // Enlace de edición: /spreadsheets/d/<ID>/edit#gid=<GID>
  const m = u.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (m) {
    const gid = (u.hash.match(/gid=(\d+)/) ?? u.search.match(/gid=(\d+)/))?.[1] ?? '0';
    return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`;
  }
  return null;
}

/** Varios enlaces separados por salto de línea, coma o espacio. */
export function enlacesDeAjustes(driveUrl: string): string[] {
  return driveUrl
    .split(/[\s,]+/)
    .map((s) => enlaceCsvDeSheets(s))
    .filter((s): s is string => !!s);
}

// ---------------------------------------------------------------------
// Encabezados: se reconocen sin importar tildes ni mayúsculas
// ---------------------------------------------------------------------

const SINONIMOS: Record<string, string[]> = {
  external_key: ['external_key', 'id', 'codigo', 'cod', 'clave', 'referencia', 'ref', 'id_externo'],
  // clientes
  nombre: ['nombre', 'nombres', 'cliente', 'nombre_completo', 'nombre_y_apellido', 'nombres_y_apellidos', 'contacto'],
  telefono: ['telefono', 'celular', 'whatsapp', 'movil', 'numero', 'telefono_celular', 'cel', 'telf', 'tel'],
  interes: ['interes', 'busca', 'tipo_de_interes', 'que_busca', 'necesidad', 'tipo_cliente'],
  presupuesto_max: ['presupuesto_max', 'presupuesto', 'presupuesto_maximo', 'budget', 'monto'],
  ubicacion_deseada: ['ubicacion_deseada', 'ubicacion', 'zona', 'sector', 'zona_deseada', 'donde'],
  notas: ['notas', 'nota', 'comentarios', 'comentario', 'observaciones', 'observacion'],
  etapa: ['etapa', 'estado_cliente', 'fase'],
  // propiedades
  tipo: ['tipo', 'tipo_propiedad', 'tipo_de_propiedad', 'inmueble'],
  operacion: ['operacion', 'tipo_operacion', 'negocio', 'venta_renta', 'venta_o_renta'],
  estado: ['estado', 'estatus', 'status', 'disponibilidad'],
  precio: ['precio', 'precio_venta', 'valor', 'precio_usd'],
  precio_renta: ['precio_renta', 'canon', 'canon_mensual', 'renta_mensual', 'arriendo'],
  comision_pct: ['comision_pct', 'comision', 'porcentaje_comision', 'comision_porcentaje', 'pct_comision'],
  direccion: ['direccion', 'ubicacion_propiedad', 'domicilio', 'dir'],
  m2_terreno: ['m2_terreno', 'terreno', 'terreno_m2', 'metros_terreno', 'area_terreno', 'superficie', 'm2'],
  m2_construccion: ['m2_construccion', 'construccion', 'construccion_m2', 'metros_construccion', 'area_construccion'],
  recamaras: ['recamaras', 'habitaciones', 'dormitorios', 'cuartos', 'recamara', 'hab'],
  amenidades: ['amenidades', 'caracteristicas', 'extras', 'descripcion'],
  link_fotos: ['link_fotos', 'fotos', 'link', 'enlace', 'enlace_fotos', 'url_fotos', 'url'],
  // datos extra de los formularios de leads (van a las notas del cliente)
  propiedad_interes: ['propiedad', 'propiedad_de_interes', 'inmueble_de_interes', 'anuncio'],
  fuente: ['fuente', 'de_donde_vino', 'origen', 'canal', 'como_nos_conocio', 'medio'],
  correo: ['correo', 'email', 'e_mail', 'correo_electronico', 'mail'],
  fecha_lead: ['fecha', 'fecha_de_registro', 'fecha_lead', 'marca_temporal', 'timestamp'],
};

/** Títulos largos de formularios que no son sinónimos exactos. */
const PATRONES_ENCABEZADO: Array<[RegExp, string]> = [
  [/conviene/, 'precio_conviene'],
  [/como_piensa|forma_de_pago|forma_de_compra|para_que_lo_busca|financiamiento/, 'forma_compra'],
  [/agendar|quiere_visit/, 'quiere_visita'],
  [/de_donde|como_se_entero|como_nos_/, 'fuente'],
  [/^aviso/, 'aviso'],
];

const MAPA_ENCABEZADOS: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [campo, lista] of Object.entries(SINONIMOS)) for (const s of lista) m[s] ??= campo;
  return m;
})();

export function campoDeEncabezado(h: string): string {
  const k = claveEncabezado(h);
  if (MAPA_ENCABEZADOS[k]) return MAPA_ENCABEZADOS[k];
  for (const [re, campo] of PATRONES_ENCABEZADO) if (re.test(k)) return campo;
  return k;
}

const CAMPOS_CONOCIDOS = new Set([...Object.keys(SINONIMOS), ...PATRONES_ENCABEZADO.map(([, c]) => c)]);

/**
 * Busca la fila de encabezados: muchas hojas tienen un título o un resumen
 * arriba (ej. encabezados en la fila 4). Se elige, entre las 15 primeras,
 * la fila con más títulos reconocidos.
 */
export function filaDeEncabezados(filas: string[][]): number {
  let mejor = 0;
  let puntos = 0;
  for (let i = 0; i < Math.min(15, filas.length); i++) {
    const p = new Set(filas[i].map(campoDeEncabezado).filter((c) => CAMPOS_CONOCIDOS.has(c))).size;
    if (p > puntos) {
      puntos = p;
      mejor = i;
    }
  }
  return mejor;
}

/** "ANA PÉREZ" o "ana pérez" -> "Ana Pérez"; si ya viene mezclado se respeta. */
function nombrePropio(n: string): string {
  const t = n.replace(/\s+/g, ' ').trim();
  if (t !== t.toLowerCase() && t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase());
}

/** Resumen legible de las columnas extra de un formulario de leads. */
function notasDeFormulario(o: Record<string, string>): string {
  // Propiedad, fuente y fecha tienen columnas propias (indicadores del embudo).
  const partes: Array<[string, string | undefined]> = [
    ['Compra', o.forma_compra],
    ['Visita', o.quiere_visita],
    ['Precio/zona le convienen', o.precio_conviene],
    ['Correo', o.correo],
  ];
  return partes
    .filter(([, v]) => v && v.trim())
    .map(([k, v]) => `${k}: ${v!.replace(/\s+-\s*\.?\s*/g, ' - ').trim()}`)
    .join('\n');
}

/** "Facebook - .Ángulo: Ubicación" -> "Facebook - Ángulo: Ubicación" */
export function limpiarFuente(v: string | undefined): string {
  return (v ?? '').replace(/\s+-\s*\.?\s*/g, ' - ').replace(/\s+/g, ' ').trim().slice(0, 300);
}

/**
 * Fecha de la hoja a "YYYY-MM-DD": acepta 21/11/2026, 21/11/26, 21-11-2026,
 * 2026-11-21 y con hora (21/11/2026 10:30:00). Si no se entiende, null.
 */
export function aFecha(v: string | undefined): string | null {
  const t = (v ?? '').trim();
  let a: number, m: number, d: number;
  let r = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (r) [a, m, d] = [Number(r[1]), Number(r[2]), Number(r[3])];
  else if ((r = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) {
    [d, m, a] = [Number(r[1]), Number(r[2]), Number(r[3])];
    if (a < 100) a += 2000;
  } else return null;
  const f = new Date(Date.UTC(a, m - 1, d));
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) return null;
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export type TipoHoja = 'clients' | 'properties' | 'desconocida';

/** Decide si la hoja es de clientes o de propiedades mirando sus encabezados. */
export function detectarTipoHoja(campos: string[]): TipoHoja {
  const set = new Set(campos);
  const pareceCliente = set.has('nombre') || set.has('telefono') || set.has('interes');
  const pareceInmueble =
    set.has('precio') && (set.has('operacion') || set.has('tipo') || set.has('direccion') || set.has('m2_terreno'));
  if (pareceCliente && !pareceInmueble) return 'clients';
  if (pareceInmueble || set.has('precio') || set.has('direccion') || set.has('operacion')) return 'properties';
  return 'desconocida';
}

// ---------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------

export function aInteres(v: string): Interes {
  const s = sinTildes(v);
  if (/propiet|consign|dueno|vende su|vender su/.test(s)) return 'Propietario/Consignador';
  if (/terreno|lote/.test(s)) return 'Busca Comprar Terreno';
  if (/rent|arriend|arrend|alquil/.test(s)) return 'Busca Rentar Casa';
  return 'Busca Comprar Casa';
}
export function aTipo(v: string): TipoPropiedad {
  return /terreno|lote/.test(sinTildes(v)) ? 'Terreno' : 'Casa';
}
export function aOperacion(v: string): Operacion {
  const s = sinTildes(v);
  const venta = /venta|vende|compra/.test(s);
  const renta = /rent|arriend|arrend|alquil/.test(s);
  if (venta && renta) return 'Venta y Renta';
  if (renta) return 'Renta';
  return 'Venta';
}
export function aEstado(v: string): EstadoPropiedad {
  const s = sinTildes(v);
  if (/negoci|reserv|separad/.test(s)) return 'En Negociación';
  if (/vendid/.test(s)) return 'Vendido';
  if (/rentad|arrendad|alquilad/.test(s)) return 'Rentado';
  return 'Disponible';
}
function aEtapa(v: string): Cliente['etapa'] | null {
  const s = sinTildes(v);
  if (!s) return null;
  if (/cerrad|ganad/.test(s)) return 'Cerrado';
  if (/oferta/.test(s)) return 'Oferta Enviada';
  if (/cita|agend|visita/.test(s)) return 'Cita Agendada';
  if (/contact/.test(s)) return 'Contactado';
  return 'Nuevo';
}
function texto(v: string | undefined, max: number): string {
  return (v ?? '').trim().slice(0, max);
}
function enlaceHttps(v: string | undefined): string | null {
  const t = (v ?? '').trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------
// Ids deterministas: el mismo cliente de la hoja produce siempre el mismo id,
// así la app y el workflow nunca crean duplicados aunque importen a la vez.
// ---------------------------------------------------------------------

export async function idDeterminista(semilla: string): Promise<string> {
  const datos = new TextEncoder().encode(semilla);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', datos)).slice(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x80; // versión 8 (UUID definido por la aplicación)
  hash[8] = (hash[8] & 0x3f) | 0x80; // variante RFC 4122
  const h = Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// ---------------------------------------------------------------------
// Plan de importación
// ---------------------------------------------------------------------

type CamposCliente = Pick<
  Cliente,
  | 'nombre' | 'telefono' | 'interes' | 'presupuesto_max' | 'ubicacion_deseada' | 'notas' | 'external_key'
  | 'propiedad_interes' | 'fuente' | 'fecha_lead'
> & { etapa?: Cliente['etapa'] };
type CamposPropiedad = Pick<
  Propiedad,
  | 'tipo' | 'operacion' | 'precio' | 'precio_renta' | 'comision_pct' | 'direccion' | 'm2_terreno'
  | 'm2_construccion' | 'recamaras' | 'amenidades' | 'link_fotos' | 'external_key'
> & { estado?: EstadoPropiedad };

export interface Insercion<T> {
  id: string;
  campos: T;
}
export interface Actualizacion<T> {
  id: string;
  cambios: Partial<T>;
}
export interface TareaNueva {
  id: string;
  tipo: 'Llamada';
  texto: string;
  fecha: string;
  client_id: string;
}

export interface PlanImportacion {
  tipoHoja: TipoHoja;
  clientes: { nuevos: Insercion<CamposCliente>[]; cambios: Actualizacion<CamposCliente>[] };
  propiedades: { nuevas: Insercion<CamposPropiedad>[]; cambios: Actualizacion<CamposPropiedad>[] };
  tareas: TareaNueva[];
  omitidas: number;
}

export interface Existente {
  id: string;
  external_key: string | null;
  deleted_at: string | null;
  [campo: string]: unknown;
}

function cambiosEntre<T extends object>(nuevo: T, actual: Existente, ignorar: string[] = []): Partial<T> {
  const cambios: Partial<T> = {};
  for (const [k, v] of Object.entries(nuevo) as Array<[keyof T & string, unknown]>) {
    if (ignorar.includes(k)) continue;
    if (v === null || v === '' || v === undefined) continue; // celda vacía: no borra lo que hay
    const a = actual[k];
    const iguales = typeof v === 'number' ? Number(a) === v : a === v;
    if (!iguales) (cambios as Record<string, unknown>)[k] = v;
  }
  return cambios;
}

function claveCliente(telefono: string, nombre: string): string {
  return telefono ? `tel:${telefono}` : nombre.trim() ? `nom:${sinTildes(nombre)}` : '';
}
function claveDireccion(tipo: TipoPropiedad, operacion: Operacion, direccion: string): string {
  return direccion.trim() ? `dir:${sinTildes(`${tipo}|${operacion}|${direccion}`).replace(/\s+/g, ' ')}` : '';
}

export interface OpcionesPlan {
  /** id de la usuaria (forma parte de la semilla del id determinista). */
  userId: string;
  /** Fecha de hoy YYYY-MM-DD para las tareas "Llamar a …". */
  hoy: string;
  clientesExistentes: Existente[];
  propiedadesExistentes: Existente[];
}

/**
 * Lee el CSV y decide qué crear y qué actualizar.
 * - Upsert por external_key (columna id/código si existe; si no, el teléfono
 *   del cliente o tipo+operación+dirección de la propiedad).
 * - Celdas vacías no borran datos.
 * - Lo que se maneja en la app (etapa del cliente, estado de la propiedad)
 *   solo se toma de la hoja al crear.
 * - Lo borrado en la app no se vuelve a crear.
 * - Cada cliente nuevo genera una tarea "Llamar a …" para hoy.
 */
export async function planificarImportacion(csv: string, op: OpcionesPlan): Promise<PlanImportacion> {
  const crudas = leerCsv(csv);
  const objetos = filasAObjetos(crudas.slice(filaDeEncabezados(crudas)), campoDeEncabezado);
  const campos = objetos.length ? Object.keys(objetos[0]) : [];
  const tipoHoja = detectarTipoHoja(campos);
  const plan: PlanImportacion = {
    tipoHoja,
    clientes: { nuevos: [], cambios: [] },
    propiedades: { nuevas: [], cambios: [] },
    tareas: [],
    omitidas: 0,
  };
  if (tipoHoja === 'desconocida') {
    plan.omitidas = objetos.length;
    return plan;
  }

  const existentes = tipoHoja === 'clients' ? op.clientesExistentes : op.propiedadesExistentes;
  const porClave = new Map(existentes.filter((e) => e.external_key).map((e) => [e.external_key as string, e]));
  // Registros creados a mano (sin external_key): se reconocen por teléfono o dirección
  // para no duplicarlos; al importarlos quedan enlazados con la hoja.
  const porDerivada = new Map<string, Existente>();
  for (const e of existentes) {
    if (e.external_key || e.deleted_at) continue;
    const k =
      tipoHoja === 'clients'
        ? claveCliente(String(e.telefono ?? ''), String(e.nombre ?? ''))
        : claveDireccion(e.tipo as TipoPropiedad, e.operacion as Operacion, String(e.direccion ?? ''));
    if (k && !porDerivada.has(k)) porDerivada.set(k, e);
  }
  const vistas = new Set<string>();

  for (const o of objetos) {
    if (tipoHoja === 'clients') {
      const telefono = normalizarTelefono(o.telefono);
      const nombre = nombrePropio(texto(o.nombre, 200));
      const derivada = claveCliente(telefono, nombre);
      const clave = o.external_key ? `id:${sinTildes(o.external_key)}` : derivada;
      if (!clave || (!nombre && !telefono) || vistas.has(clave)) {
        plan.omitidas++;
        continue;
      }
      vistas.add(clave);
      const extra = notasDeFormulario(o);
      const c: CamposCliente = {
        nombre: nombre || telefono,
        telefono,
        // Sin columna "Interés", se deduce de la propiedad por la que preguntó.
        interes: aInteres(o.interes || o.propiedad_interes || ''),
        presupuesto_max: aNumero(o.presupuesto_max),
        ubicacion_deseada: texto(o.ubicacion_deseada, 300),
        notas: [texto(o.notas, 3000), extra].filter(Boolean).join('\n').slice(0, 5000),
        external_key: clave,
        propiedad_interes: texto(o.propiedad_interes, 300),
        fuente: limpiarFuente(o.fuente),
        fecha_lead: aFecha(o.fecha_lead),
      };
      const actual = porClave.get(clave) ?? porDerivada.get(derivada);
      if (actual) {
        if (actual.deleted_at) continue;
        porDerivada.delete(derivada);
        // El interés solo se actualiza si la hoja trae esa columna con valor.
        // Las notas solo se llenan al crear: así nunca se pisan las que Gladys escribe en la app.
        const ignorar = ['notas', ...(o.interes ? [] : ['interes'])];
        const cambios = cambiosEntre(c, actual, ignorar);
        if (Object.keys(cambios).length) plan.clientes.cambios.push({ id: actual.id, cambios });
      } else {
        const id = await idDeterminista(`${op.userId}:clients:${clave}`);
        const etapa = aEtapa(o.etapa ?? o.estado ?? '');
        plan.clientes.nuevos.push({ id, campos: etapa ? { ...c, etapa } : c });
        plan.tareas.push({
          id: await idDeterminista(`${op.userId}:tasks:llamar:${clave}`),
          tipo: 'Llamada',
          texto: /esta semana|hoy|urgente/i.test(o.quiere_visita ?? '')
            ? `Llamar a ${c.nombre} — quiere visitar esta semana`
            : `Llamar a ${c.nombre}`,
          fecha: op.hoy,
          client_id: id,
        });
      }
    } else {
      const tipo = aTipo(o.tipo ?? '');
      const operacion = aOperacion(o.operacion ?? '');
      // En hojas de inmuebles, "Ubicación" es la dirección.
      const direccion = texto(o.direccion || o.ubicacion_deseada, 500);
      const derivada = claveDireccion(tipo, operacion, direccion);
      const clave = o.external_key ? `id:${sinTildes(o.external_key)}` : derivada;
      if (!clave || vistas.has(clave)) {
        plan.omitidas++;
        continue;
      }
      vistas.add(clave);
      const recamaras = aNumero(o.recamaras);
      const p: CamposPropiedad = {
        tipo,
        operacion,
        precio: aNumero(o.precio) ?? 0,
        precio_renta: aNumero(o.precio_renta),
        comision_pct: aNumero(o.comision_pct) ?? 3,
        direccion,
        m2_terreno: aNumero(o.m2_terreno),
        m2_construccion: aNumero(o.m2_construccion),
        recamaras: recamaras == null ? null : Math.round(recamaras),
        amenidades: texto(o.amenidades, 2000),
        link_fotos: enlaceHttps(o.link_fotos),
        external_key: clave,
      };
      const actual = porClave.get(clave) ?? porDerivada.get(derivada);
      if (actual) {
        if (actual.deleted_at) continue;
        porDerivada.delete(derivada);
        const ignorar = [
          ...(o.tipo ? [] : ['tipo']),
          ...(o.operacion ? [] : ['operacion']),
          ...(o.comision_pct ? [] : ['comision_pct']),
          ...(o.precio ? [] : ['precio']),
        ];
        const cambios = cambiosEntre(p, actual, ignorar);
        if (Object.keys(cambios).length) plan.propiedades.cambios.push({ id: actual.id, cambios });
      } else {
        const id = await idDeterminista(`${op.userId}:properties:${clave}`);
        plan.propiedades.nuevas.push({ id, campos: { ...p, estado: aEstado(o.estado ?? '') } });
      }
    }
  }
  return plan;
}

export function resumenPlan(p: PlanImportacion): string {
  if (p.tipoHoja === 'desconocida') return 'No reconocí la hoja: revisa que la primera fila tenga encabezados como Nombre/Teléfono o Precio/Dirección.';
  if (p.tipoHoja === 'clients') {
    return `Clientes: ${p.clientes.nuevos.length} nuevos, ${p.clientes.cambios.length} actualizados${p.omitidas ? `, ${p.omitidas} filas omitidas` : ''}.`;
  }
  return `Propiedades: ${p.propiedades.nuevas.length} nuevas, ${p.propiedades.cambios.length} actualizadas${p.omitidas ? `, ${p.omitidas} filas omitidas` : ''}.`;
}
