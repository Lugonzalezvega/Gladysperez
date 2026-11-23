// Teléfonos de Ecuador en formato internacional sin "+": 593XXXXXXXXX.

/**
 * "0999 123 456"  -> "593999123456"
 * "+593 99 912 3456" -> "593999123456"
 * "999123456" -> "593999123456"
 * "02 234 5678" (fijo Quito) -> "59322345678"
 * Números de otros países que ya vienen con código se dejan como están.
 */
export function normalizarTelefono(entrada: string | null | undefined): string {
  let d = String(entrada ?? '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('593')) {
    const resto = d.slice(3).replace(/^0+/, '');
    return `593${resto}`;
  }
  if (d.startsWith('0') && (d.length === 10 || d.length === 9)) return `593${d.slice(1)}`;
  if (d.length === 9 && d.startsWith('9')) return `593${d}`;
  if (d.length === 8 && /^[2-7]/.test(d)) return `593${d}`; // fijo sin 0 ni provincia completa
  return d.slice(0, 15);
}

/** "593999123456" -> "+593 99 912 3456" para mostrar. */
export function telefonoBonito(t: string): string {
  if (/^5939\d{8}$/.test(t)) return `+593 ${t.slice(3, 5)} ${t.slice(5, 8)} ${t.slice(8)}`;
  return t ? `+${t}` : '';
}
