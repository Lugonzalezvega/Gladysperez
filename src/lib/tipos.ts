// Tipos compartidos por la app y por el script de importación.
// Este archivo solo contiene tipos (se borra al compilar).

export type TipoPropiedad = 'Casa' | 'Terreno';
export type Operacion = 'Venta' | 'Renta' | 'Venta y Renta';
export type EstadoPropiedad = 'Disponible' | 'En Negociación' | 'Vendido' | 'Rentado';
export type Interes =
  | 'Busca Comprar Casa'
  | 'Busca Rentar Casa'
  | 'Busca Comprar Terreno'
  | 'Propietario/Consignador';
export type Etapa =
  | 'Nuevo'
  | 'Contactado'
  | 'Solo quiere información'
  | 'Cita más adelante'
  | 'Cita Agendada'
  | 'Oferta Enviada'
  | 'Cerrado'
  | 'No le interesa';
export type Llamo = 'si' | 'no' | null;
export type SiNo = 'si' | 'no' | null;
export type Oferta = 'verbal' | 'escrita' | 'no' | null;
export type TipoTarea = 'Llamada' | 'Muestra de propiedad' | 'Firma' | 'Seguimiento';

export interface Base {
  id: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Propiedad extends Base {
  tipo: TipoPropiedad;
  operacion: Operacion;
  estado: EstadoPropiedad;
  precio: number;
  /** Solo para "Venta y Renta": canon mensual. */
  precio_renta: number | null;
  comision_pct: number;
  direccion: string;
  m2_terreno: number | null;
  m2_construccion: number | null;
  recamaras: number | null;
  amenidades: string;
  link_fotos: string | null;
  cerrado_en: string | null;
  external_key: string | null;
}

export interface Cliente extends Base {
  nombre: string;
  telefono: string;
  interes: Interes;
  presupuesto_max: number | null;
  ubicacion_deseada: string;
  etapa: Etapa;
  llamo: Llamo;
  llamo_en: string | null;
  notas: string;
  external_key: string | null;
  // Embudo de leads
  propiedad_interes: string;
  fuente: string;
  fecha_lead: string | null; // YYYY-MM-DD
  respondio: SiNo;
  respondio_en: string | null;
  agendo: SiNo;
  agendo_en: string | null;
  asistio: SiNo;
  asistio_en: string | null;
  seguimiento: SiNo;
  seguimiento_en: string | null;
  oferta: Oferta;
  oferta_en: string | null;
  oferta_monto: number | null;
}

export interface Tarea extends Base {
  tipo: TipoTarea;
  texto: string;
  fecha: string; // YYYY-MM-DD
  hora: string | null; // HH:MM
  hecha: boolean;
  llamo: Llamo;
  client_id: string | null;
}

export interface Ajustes extends Base {
  drive_url: string;
  ultima_importacion: string | null;
  probabilidad_cierre: number;
}

export type Tabla = 'properties' | 'clients' | 'tasks' | 'settings';

export interface FilasPorTabla {
  properties: Propiedad;
  clients: Cliente;
  tasks: Tarea;
  settings: Ajustes;
}
