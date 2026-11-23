// Lector de CSV (RFC 4180): comillas, comas dentro de comillas, saltos de
// línea dentro de comillas, BOM y separador ";" (Excel en español).

export function detectarSeparador(texto: string): ',' | ';' | '\t' {
  const primera = texto.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? '';
  const cuenta = (c: string) => primera.split(c).length - 1;
  const opciones: Array<[',' | ';' | '\t', number]> = [
    [',', cuenta(',')],
    [';', cuenta(';')],
    ['\t', cuenta('\t')],
  ];
  opciones.sort((a, b) => b[1] - a[1]);
  return opciones[0][1] > 0 ? opciones[0][0] : ',';
}

export function leerCsv(texto: string): string[][] {
  const s = texto.replace(/^﻿/, '');
  const sep = detectarSeparador(s);
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let enComillas = false;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (enComillas) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          campo += '"';
          i++;
        } else enComillas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') enComillas = true;
    else if (c === sep) {
      fila.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else campo += c;
  }
  if (campo !== '' || fila.length) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas.filter((f) => f.some((v) => v.trim() !== ''));
}

/** Convierte filas en objetos usando la primera fila como encabezados. */
export function filasAObjetos(filas: string[][], clave: (h: string) => string): Record<string, string>[] {
  if (filas.length === 0) return [];
  const enc = filas[0].map(clave);
  return filas.slice(1).map((f) => {
    const o: Record<string, string> = {};
    enc.forEach((h, i) => {
      if (h && o[h] === undefined) o[h] = (f[i] ?? '').trim();
    });
    return o;
  });
}

/** Escribe CSV (para exportar respaldos desde la app). */
export function aCsv(filas: Record<string, unknown>[]): string {
  if (filas.length === 0) return '';
  const cols = Object.keys(filas[0]);
  const esc = (v: unknown) => {
    const t = v === null || v === undefined ? '' : String(v);
    return /[",\n\r;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return [cols.join(','), ...filas.map((f) => cols.map((c) => esc(f[c])).join(','))].join('\r\n');
}
