// Utilidades de texto: sin tildes, sin mayúsculas, números y fechas.

/** "Teléfono Celular" -> "telefono celular" */
export function sinTildes(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** "  Teléfono (Celular) " -> "telefono_celular" */
export function claveEncabezado(s: string): string {
  return sinTildes(s.replace(/^﻿/, ''))
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const PALABRAS_VACIAS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'o', 'u', 'a', 'al', 'por', 'cerca',
  'sector', 'barrio', 'zona', 'via', 'av', 'avenida', 'calle', 'urb', 'urbanizacion',
  'conjunto', 'quito', 'ecuador', 'cualquier', 'cualquiera', 'lugar', 'parte',
]);

/** Palabras significativas de una ubicación, sin tildes. */
export function palabrasUbicacion(s: string): string[] {
  return sinTildes(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !PALABRAS_VACIAS.has(w));
}

/**
 * Convierte textos de dinero o números a número.
 * "$250.000" -> 250000, "250,000.50" -> 250000.5, "1.250,75" -> 1250.75,
 * "250k" -> 250000, "80 mil" -> 80000, "1.2M" -> 1200000. Vacío -> null.
 */
export function aNumero(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  let s = sinTildes(String(valor))
    .replace(/m²|m2|mts|metros|cuadrados/g, '')
    .replace(/usd|\$|dolares|\s/g, '');
  if (!s) return null;
  let mult = 1;
  const suf = s.match(/(k|mil|m|millones|millon)$/);
  if (suf) {
    mult = suf[1] === 'k' || suf[1] === 'mil' ? 1_000 : 1_000_000;
    s = s.slice(0, -suf[1].length);
  }
  const ultimoPunto = s.lastIndexOf('.');
  const ultimaComa = s.lastIndexOf(',');
  if (ultimoPunto >= 0 && ultimaComa >= 0) {
    // El último separador es el decimal.
    if (ultimaComa > ultimoPunto) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else {
    const sep = ultimaComa >= 0 ? ',' : ultimoPunto >= 0 ? '.' : '';
    if (sep) {
      const partes = s.split(sep);
      const esMiles = partes.length > 2 || (partes.length === 2 && partes[1].length === 3 && mult === 1);
      s = esMiles ? partes.join('') : partes.join('.');
    }
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s) * mult;
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** Fecha de hoy "YYYY-MM-DD" en la zona horaria indicada (o la del dispositivo). */
export function hoyISO(timeZone?: string, ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

/** Mes "YYYY-MM" de una fecha ISO en la zona horaria local. */
export function mesDe(iso: string, timeZone?: string): string {
  return hoyISO(timeZone, new Date(iso)).slice(0, 7);
}

const dinero = new Intl.NumberFormat('es-EC', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

export function formatoDinero(n: number | null | undefined): string {
  return dinero.format(n ?? 0);
}

export function formatoFecha(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso);
  return d.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatoFechaHora(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('es-EC', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
