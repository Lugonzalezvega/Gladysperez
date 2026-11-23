// Indicadores del embudo de leads:
// Leads → responden → agendan → asisten a la cita → en seguimiento / hacen oferta.
import type { Cliente, Etapa, Oferta, SiNo } from './tipos.ts';
import { hoyISO, sinTildes } from './texto.ts';

export type Paso = 'respondio' | 'agendo' | 'asistio' | 'seguimiento' | 'oferta';

export interface DefinicionPaso {
  clave: Paso;
  titulo: string;
  pregunta: string;
  /** Sobre quiénes se mide este paso. */
  base: 'leads' | Paso;
  baseTexto: string;
}

export const PASOS: DefinicionPaso[] = [
  { clave: 'respondio', titulo: 'Responden', pregunta: '¿Respondió?', base: 'leads', baseTexto: 'de los leads' },
  { clave: 'agendo', titulo: 'Agendan cita', pregunta: '¿Agendó cita?', base: 'respondio', baseTexto: 'de los que responden' },
  { clave: 'asistio', titulo: 'Asisten a la cita', pregunta: '¿Asistió a la cita?', base: 'agendo', baseTexto: 'de los que agendan' },
  { clave: 'seguimiento', titulo: 'Quedan en seguimiento', pregunta: '¿Sigue interesado?', base: 'asistio', baseTexto: 'de los que visitan' },
  { clave: 'oferta', titulo: 'Hacen oferta', pregunta: '¿Hizo oferta?', base: 'asistio', baseTexto: 'de los que visitan' },
];

const ORDEN: Paso[] = ['respondio', 'agendo', 'asistio'];

/** ¿El cliente cumplió el paso? (en oferta cuenta verbal o escrita) */
export function cumplio(c: Pick<Cliente, Paso>, paso: Paso): boolean {
  const v = c[paso];
  return paso === 'oferta' ? v === 'verbal' || v === 'escrita' : v === 'si';
}
export function descarto(c: Pick<Cliente, Paso>, paso: Paso): boolean {
  return c[paso] === 'no';
}

/**
 * Cambios al marcar un paso. Al marcar "sí" (o una oferta), los pasos
 * anteriores que falten se marcan también como "sí" y la etapa del tablero
 * avanza si hace falta. Marcar null borra la respuesta.
 */
export function cambiosPaso(
  c: Pick<Cliente, Paso | 'etapa'>,
  paso: Paso,
  valor: SiNo | Oferta,
  ahora: string = new Date().toISOString(),
): Partial<Cliente> {
  const cambios: Record<string, unknown> = { [paso]: valor, [`${paso}_en`]: valor ? ahora : null };
  const positivo = paso === 'oferta' ? valor === 'verbal' || valor === 'escrita' : valor === 'si';
  if (!positivo) return cambios as Partial<Cliente>;

  const anteriores = paso === 'seguimiento' || paso === 'oferta' ? ORDEN : ORDEN.slice(0, ORDEN.indexOf(paso));
  for (const p of anteriores) {
    if (c[p] !== 'si') {
      cambios[p] = 'si';
      cambios[`${p}_en`] = ahora;
    }
  }
  const rango: Record<Etapa, number> = { Nuevo: 0, Contactado: 1, 'Cita Agendada': 2, 'Oferta Enviada': 3, Cerrado: 4 };
  const objetivo: Etapa = paso === 'oferta' ? 'Oferta Enviada' : paso === 'respondio' ? 'Contactado' : 'Cita Agendada';
  if (rango[c.etapa] < rango[objetivo]) cambios.etapa = objetivo;
  return cambios as Partial<Cliente>;
}

/** Red de donde vino el lead: "Facebook - Ángulo: X" -> "Facebook". */
export function canalDe(fuente: string | null | undefined): string {
  fuente = fuente ?? '';
  const s = sinTildes(fuente);
  if (!s) return 'Sin fuente';
  if (/marketplace/.test(s)) return 'Marketplace';
  if (/facebook|\bfb\b|meta/.test(s)) return 'Facebook';
  if (/instagram|\big\b/.test(s)) return 'Instagram';
  if (/tiktok/.test(s)) return 'TikTok';
  if (/whats/.test(s)) return 'WhatsApp';
  if (/referid|recomend/.test(s)) return 'Referido';
  if (/portal|plusvalia|properati|olx|patiotuerca/.test(s)) return 'Portal inmobiliario';
  const primero = fuente.split(/\s+-\s+|[,;]/)[0].trim();
  return primero.charAt(0).toUpperCase() + primero.slice(1);
}

/** Ángulo del anuncio: "Facebook - Ángulo: Ubicación" -> "Ubicación". */
export function anguloDe(fuente: string | null | undefined): string {
  const m = (fuente ?? '').match(/[áa]ngulo\s*:\s*(.+)$/i);
  return m ? m[1].trim() : '';
}

/** Fecha del lead "YYYY-MM-DD": la del formulario o, si no hay, la de alta (hora local). */
export function fechaDelLead(c: Pick<Cliente, 'fecha_lead' | 'created_at'>, timeZone?: string): string {
  if (c.fecha_lead) return c.fecha_lead.slice(0, 10);
  if (!c.created_at) return '';
  const d = new Date(c.created_at);
  return Number.isNaN(d.getTime()) ? '' : hoyISO(timeZone, d);
}

/** Mes del lead "YYYY-MM". */
export function mesDelLead(c: Pick<Cliente, 'fecha_lead' | 'created_at'>, timeZone?: string): string {
  return fechaDelLead(c, timeZone).slice(0, 7);
}

export interface FiltroEmbudo {
  propiedad?: string;
  canal?: string;
  mes?: string;
  /** Rango de fechas del lead, "YYYY-MM-DD", ambos incluidos. */
  desde?: string;
  hasta?: string;
}

/** Leads que cuentan: clientes vivos que buscan comprar o rentar (no propietarios). */
export function leadsDe(clientes: Cliente[], f: FiltroEmbudo = {}): Cliente[] {
  return clientes.filter(
    (c) =>
      !c.deleted_at &&
      c.interes !== 'Propietario/Consignador' &&
      (!f.propiedad || (c.propiedad_interes || 'Sin propiedad') === f.propiedad) &&
      (!f.canal || canalDe(c.fuente) === f.canal) &&
      (!f.mes || mesDelLead(c) === f.mes) &&
      (!f.desde || fechaDelLead(c) >= f.desde) &&
      (!f.hasta || (fechaDelLead(c) !== '' && fechaDelLead(c) <= f.hasta)),
  );
}

export interface ResultadoPaso extends DefinicionPaso {
  base_total: number;
  si: number;
  no: number;
  pendiente: number;
  /** % de "sí" sobre la base (0-100, entero). */
  pct: number;
}

export interface Embudo {
  leads: number;
  pasos: ResultadoPaso[];
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

export function calcularEmbudo(leads: Cliente[]): Embudo {
  const pasos = PASOS.map((def) => {
    const base = def.base === 'leads' ? leads : leads.filter((c) => cumplio(c, def.base as Paso));
    const si = base.filter((c) => cumplio(c, def.clave)).length;
    const no = base.filter((c) => descarto(c, def.clave)).length;
    return { ...def, base_total: base.length, si, no, pendiente: base.length - si - no, pct: pct(si, base.length) };
  });
  return { leads: leads.length, pasos };
}

export interface FilaGrupo {
  nombre: string;
  leads: number;
  respondio: number;
  agendo: number;
  asistio: number;
  oferta: number;
}

/** Tabla de leads y avances agrupados (por propiedad, por canal, por ángulo…). */
export function agrupar(leads: Cliente[], clave: (c: Cliente) => string): FilaGrupo[] {
  const mapa = new Map<string, FilaGrupo>();
  for (const c of leads) {
    const nombre = clave(c) || 'Sin dato';
    const f = mapa.get(nombre) ?? { nombre, leads: 0, respondio: 0, agendo: 0, asistio: 0, oferta: 0 };
    f.leads++;
    if (cumplio(c, 'respondio')) f.respondio++;
    if (cumplio(c, 'agendo')) f.agendo++;
    if (cumplio(c, 'asistio')) f.asistio++;
    if (cumplio(c, 'oferta')) f.oferta++;
    mapa.set(nombre, f);
  }
  return [...mapa.values()].sort((a, b) => b.leads - a.leads || a.nombre.localeCompare(b.nombre, 'es'));
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "2026-11-15" -> { d: 15, m: 'noviembre', a: 2026 } */
function partes(f: string) {
  const [a, m, d] = f.split('-').map(Number);
  return { d, m: MESES[m - 1], a };
}

/** Texto del periodo para el informe: "Del 15 al 22 de noviembre de 2026". */
export function textoPeriodo(f: Pick<FiltroEmbudo, 'desde' | 'hasta'>): string {
  const { desde, hasta } = f;
  if (desde && hasta) {
    if (desde === hasta) {
      const x = partes(desde);
      return `${x.d} de ${x.m} de ${x.a}`;
    }
    const x = partes(desde);
    const y = partes(hasta);
    if (x.a === y.a && x.m === y.m) return `Del ${x.d} al ${y.d} de ${y.m} de ${y.a}`;
    if (x.a === y.a) return `Del ${x.d} de ${x.m} al ${y.d} de ${y.m} de ${y.a}`;
    return `Del ${x.d} de ${x.m} de ${x.a} al ${y.d} de ${y.m} de ${y.a}`;
  }
  if (desde) {
    const x = partes(desde);
    return `Desde el ${x.d} de ${x.m} de ${x.a}`;
  }
  if (hasta) {
    const y = partes(hasta);
    return `Hasta el ${y.d} de ${y.m} de ${y.a}`;
  }
  return 'Todo el periodo registrado';
}

/** Atajos de fechas: últimos 7 días, este mes, mes anterior. */
export function rangoRapido(tipo: '7dias' | 'mes' | 'mesAnterior', hoy: string): { desde: string; hasta: string } {
  const [a, m, d] = hoy.split('-').map(Number);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  if (tipo === '7dias') return { desde: iso(new Date(Date.UTC(a, m - 1, d - 6))), hasta: hoy };
  if (tipo === 'mes') return { desde: iso(new Date(Date.UTC(a, m - 1, 1))), hasta: hoy };
  return { desde: iso(new Date(Date.UTC(a, m - 2, 1))), hasta: iso(new Date(Date.UTC(a, m - 1, 0))) };
}
