import type { Etapa, EstadoPropiedad, Interes, Operacion, TipoPropiedad, TipoTarea } from './tipos.ts';

export const TIPOS: TipoPropiedad[] = ['Casa', 'Terreno'];
export const OPERACIONES: Operacion[] = ['Venta', 'Renta', 'Venta y Renta'];
export const ESTADOS: EstadoPropiedad[] = ['Disponible', 'En Negociación', 'Vendido', 'Rentado'];
export const INTERESES: Interes[] = [
  'Busca Comprar Casa',
  'Busca Rentar Casa',
  'Busca Comprar Terreno',
  'Propietario/Consignador',
];
export const ETAPAS: Etapa[] = [
  'Nuevo',
  'Contactado',
  'Solo quiere información',
  'Cita más adelante',
  'Cita Agendada',
  'Oferta Enviada',
  'Cerrado',
  'No le interesa',
];
export const TIPOS_TAREA: TipoTarea[] = ['Llamada', 'Muestra de propiedad', 'Firma', 'Seguimiento'];
