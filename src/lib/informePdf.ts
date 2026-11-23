// Informe PDF del Dashboard, armado directamente en el teléfono o la
// computadora (no usa la función de imprimir, que el iPhone bloquea en las
// apps instaladas en la pantalla de inicio).
import { jsPDF } from 'jspdf';
import type { Embudo, FilaGrupo } from './embudo.ts';

export interface DatosInforme {
  periodo: string;
  alcance: string;
  embudo: Embudo;
  porEtapa: Array<{ etapa: string; total: number }>;
  porPropiedad: FilaGrupo[];
  porCanal: FilaGrupo[];
  porAngulo: FilaGrupo[];
  logo?: string; // data URL del logo (PNG)
  generado?: Date;
}

type RGB = [number, number, number];
const AZUL: RGB = [31, 79, 163];
const AZUL_CLARO: RGB = [238, 243, 251];
const BORDE: RGB = [214, 226, 245];
const TEXTO: RGB = [28, 25, 23];
const GRIS: RGB = [107, 114, 128];

const X0 = 14;
const ANCHO = 182; // 210 - 2 × 14
const ALTO_PAGINA = 297;
const LIMITE = ALTO_PAGINA - 18;

const pctN = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const pct = (a: number, b: number) => (b ? `${pctN(a, b)} %` : '—');

export function puntosClave(d: Pick<DatosInforme, 'embudo' | 'porPropiedad' | 'porCanal' | 'porEtapa'>): string[] {
  const p: string[] = [];
  const e = d.embudo;
  const top = d.porPropiedad[0];
  if (top && d.porPropiedad.length > 1) {
    p.push(`«${top.nombre}» es la propiedad con más interés: ${top.leads} de ${e.leads} leads (${pct(top.leads, e.leads)}).`);
  }
  const canales = d.porCanal.filter((c) => c.leads >= 3 && c.nombre !== 'Sin fuente');
  if (canales.length) {
    p.push(`${canales[0].nombre} es la red que más leads trae (${canales[0].leads}).`);
    const mejor = [...canales].sort((a, b) => b.agendo / b.leads - a.agendo / a.leads)[0];
    if (mejor.agendo > 0) p.push(`${mejor.nombre} convierte mejor en citas: ${pct(mejor.agendo, mejor.leads)} de sus leads agenda una visita.`);
  }
  const [r, a] = e.pasos;
  if (a && a.base_total > 0 && a.si > 0) p.push(`${a.si} de ${a.base_total} leads que respondieron ya agendaron una cita (${pct(a.si, a.base_total)}).`);
  const mas = d.porEtapa.find((x) => x.etapa === 'Cita más adelante');
  if (mas) p.push(`${mas.total} ${mas.total === 1 ? 'lead quiere' : 'leads quieren'} la cita más adelante: son la oportunidad de seguimiento inmediata.`);
  if (r && r.pendiente > 0) p.push(`${r.pendiente} ${r.pendiente === 1 ? 'lead aún no tiene' : 'leads aún no tienen'} registrada su respuesta.`);
  return p.slice(0, 5);
}

export function crearInformePdf(d: DatosInforme): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = 12;
  const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const relleno = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const linea = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
  const fuente = (tam: number, negrita = false) => {
    doc.setFont('helvetica', negrita ? 'bold' : 'normal');
    doc.setFontSize(tam);
  };
  const asegurar = (alto: number) => {
    if (y + alto > LIMITE) {
      doc.addPage();
      y = 16;
    }
  };
  const titulo = (t: string) => {
    asegurar(14);
    fuente(12.5, true);
    color(AZUL);
    doc.text(t, X0, y + 5);
    y += 9;
  };

  // ---- Encabezado -------------------------------------------------------
  relleno(AZUL);
  doc.roundedRect(X0, y, ANCHO, 32, 3, 3, 'F');
  let xTexto = X0 + 8;
  if (d.logo) {
    try {
      doc.addImage(d.logo, 'PNG', X0, y, 45.7, 32);
      xTexto = X0 + 52;
    } catch {
      /* sin logo */
    }
  }
  color([255, 255, 255]);
  fuente(8, true);
  doc.text('INFORME COMERCIAL', xTexto, y + 9, { charSpace: 0.6 });
  fuente(20, true);
  doc.text('Dashboard de leads', xTexto, y + 18);
  fuente(10);
  const sub = doc.splitTextToSize(d.alcance ? `${d.periodo} · ${d.alcance}` : d.periodo, X0 + ANCHO - xTexto - 6);
  doc.text(sub, xTexto, y + 25);
  y += 40;

  // ---- Indicadores principales -----------------------------------------
  const e = d.embudo;
  const [r, a, s, , o] = e.pasos;
  const kpis: Array<[string, string, string]> = [
    ['LEADS', String(e.leads), 'recibidos'],
    ['RESPONDEN', pct(r.si, r.base_total), `${r.si} de ${r.base_total}`],
    ['AGENDAN CITA', pct(a.si, a.base_total), `${a.si} de ${a.base_total}`],
    ['ASISTEN', pct(s.si, s.base_total), `${s.si} de ${s.base_total}`],
    ['HACEN OFERTA', pct(o.si, o.base_total), `${o.si} de ${o.base_total}`],
  ];
  const ancho = (ANCHO - 4 * 3) / 5;
  kpis.forEach(([t, v, det], i) => {
    const x = X0 + i * (ancho + 3);
    relleno(AZUL_CLARO);
    linea(BORDE);
    doc.roundedRect(x, y, ancho, 23, 2, 2, 'FD');
    fuente(7, true);
    color(AZUL);
    doc.text(t, x + 3, y + 6);
    fuente(16, true);
    color(TEXTO);
    doc.text(v, x + 3, y + 15);
    fuente(7.5);
    color(GRIS);
    doc.text(det, x + 3, y + 20);
  });
  y += 30;

  // ---- Puntos clave ------------------------------------------------------
  const claves = puntosClave(d);
  if (claves.length) {
    titulo('Puntos clave');
    fuente(9.5);
    color(TEXTO);
    for (const c of claves) {
      const lineas = doc.splitTextToSize(c, ANCHO - 6) as string[];
      asegurar(lineas.length * 4.6 + 1);
      doc.text('•', X0 + 1, y + 3.5);
      doc.text(lineas, X0 + 5, y + 3.5);
      y += lineas.length * 4.6 + 1;
    }
    y += 4;
  }

  // ---- Embudo ------------------------------------------------------------
  titulo('Embudo comercial');
  const filas = [
    { t: 'Leads recibidos', v: e.leads, base: e.leads },
    ...e.pasos.map((p) => ({ t: p.titulo, v: p.si, base: p.base_total })),
  ];
  const max = Math.max(1, e.leads);
  const xBarra = X0 + 48;
  const anchoBarra = ANCHO - 48 - 30;
  for (const [i, f] of filas.entries()) {
    asegurar(8);
    fuente(9.5, true);
    color(TEXTO);
    doc.text(f.t, X0, y + 4.5);
    relleno(AZUL_CLARO);
    doc.roundedRect(xBarra, y + 0.8, anchoBarra, 5, 1, 1, 'F');
    if (f.v > 0) {
      relleno(AZUL);
      doc.roundedRect(xBarra, y + 0.8, Math.max(1.5, (f.v / max) * anchoBarra), 5, 1, 1, 'F');
    }
    fuente(9.5, true);
    color(TEXTO);
    const val = String(f.v);
    if (i === 0) doc.text(val, X0 + ANCHO, y + 4.5, { align: 'right' });
    else {
      fuente(9);
      color(GRIS);
      const p = ` · ${pct(f.v, f.base)}`;
      doc.text(p, X0 + ANCHO, y + 4.5, { align: 'right' });
      fuente(9.5, true);
      color(TEXTO);
      doc.text(val, X0 + ANCHO - doc.getTextWidth(p) - 0.5, y + 4.5, { align: 'right' });
    }
    y += 8;
  }
  fuente(8);
  color(GRIS);
  const nota = doc.splitTextToSize(
    'Cada porcentaje es sobre el paso anterior: responden sobre los leads, agendan sobre quienes responden, asisten sobre quienes agendan; seguimiento y ofertas sobre quienes visitaron.',
    ANCHO,
  ) as string[];
  asegurar(nota.length * 3.6 + 2);
  doc.text(nota, X0, y + 3);
  y += nota.length * 3.6 + 6;

  // ---- Tablas ------------------------------------------------------------
  const tabla = (tit: string, columnas: string[], filasT: string[][], anchos: number[]) => {
    if (!filasT.length) return;
    titulo(tit);
    const encabezado = () => {
      relleno(AZUL);
      doc.rect(X0, y, ANCHO, 7, 'F');
      fuente(8.5, true);
      color([255, 255, 255]);
      let x = X0;
      columnas.forEach((c, i) => {
        if (i === 0) doc.text(c, x + 2, y + 4.8);
        else doc.text(c, x + anchos[i] - 2, y + 4.8, { align: 'right' });
        x += anchos[i];
      });
      y += 7;
    };
    asegurar(15);
    encabezado();
    filasT.forEach((fila, n) => {
      fuente(9);
      const nombre = doc.splitTextToSize(fila[0], anchos[0] - 4) as string[];
      const alto = Math.max(6.5, nombre.length * 4 + 2.5);
      if (y + alto > LIMITE) {
        doc.addPage();
        y = 16;
        encabezado();
      }
      if (n % 2) {
        relleno(AZUL_CLARO);
        doc.rect(X0, y, ANCHO, alto, 'F');
      }
      color(TEXTO);
      fuente(9);
      doc.text(nombre, X0 + 2, y + 4.4);
      let x = X0 + anchos[0];
      fila.slice(1).forEach((v, i) => {
        fuente(9, i === 0);
        doc.text(v, x + anchos[i + 1] - 2, y + 4.4, { align: 'right' });
        x += anchos[i + 1];
      });
      y += alto;
    });
    y += 6;
  };

  const totalEtapas = d.porEtapa.reduce((n, x) => n + x.total, 0);
  tabla(
    'Leads por etapa',
    ['Etapa', 'Leads', '% del total'],
    d.porEtapa.map((x) => [x.etapa, String(x.total), pct(x.total, totalEtapas)]),
    [ANCHO - 70, 35, 35],
  );
  const cols = ['Leads', 'Responden', 'Agendan', 'Asisten', 'Ofertas'];
  const anchosGrupo = [ANCHO - 5 * 22, 22, 22, 22, 22, 22];
  const filasGrupo = (g: FilaGrupo[]) =>
    g.map((f) => [f.nombre, String(f.leads), `${f.respondio} · ${pct(f.respondio, f.leads)}`, `${f.agendo} · ${pct(f.agendo, f.leads)}`, String(f.asistio), String(f.oferta)]);
  tabla('Leads por propiedad', ['Propiedad', ...cols], filasGrupo(d.porPropiedad), anchosGrupo);
  tabla('Leads por red social', ['Red', ...cols], filasGrupo(d.porCanal), anchosGrupo);
  tabla('Leads por ángulo del anuncio', ['Red · ángulo', ...cols], filasGrupo(d.porAngulo), anchosGrupo);

  // ---- Pie ---------------------------------------------------------------
  const hoy = (d.generado ?? new Date()).toLocaleDateString('es-EC', { day: 'numeric', month: 'long', year: 'numeric' });
  fuente(7.5);
  const pie = doc.splitTextToSize(
    'Cómo se mide: cada lead cuenta según lo marcado en su panel "Embudo"; si no hay nada marcado, según su etapa en el tablero ' +
      '(por ejemplo, "Cita Agendada" cuenta como que respondió y agendó; "Solo quiere información" como que respondió y no agendó). ' +
      'Las ofertas incluyen las verbales. No se cuentan propietarios ni consignadores.',
    ANCHO,
  ) as string[];
  asegurar(pie.length * 3.4 + 10);
  linea(BORDE);
  doc.line(X0, y, X0 + ANCHO, y);
  color(GRIS);
  doc.text(pie, X0, y + 4);
  y += pie.length * 3.4 + 5;
  doc.text(`Gladys Pérez · Asesora inmobiliaria · Informe generado el ${hoy}.`, X0, y + 2);

  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i);
    fuente(7.5);
    color(GRIS);
    doc.text(`Página ${i} de ${paginas}`, X0 + ANCHO, ALTO_PAGINA - 8, { align: 'right' });
  }
  return doc;
}

/** Nombre del archivo: "Dashboard-leads-2026-11-01-al-2026-11-23.pdf" */
export function nombreArchivo(desde?: string, hasta?: string): string {
  const rango = desde || hasta ? `-${desde ?? 'inicio'}-al-${hasta ?? 'hoy'}` : '';
  return `Dashboard-leads${rango}.pdf`;
}
