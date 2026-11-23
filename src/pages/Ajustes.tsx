import { useEffect, useRef, useState } from 'react';
import { Download, FileUp, Loader2, LogOut, RefreshCw, Save } from 'lucide-react';
import { useAjustes, useSync } from '../data/hooks.ts';
import { almacen } from '../data/store.ts';
import { supabase } from '../data/supabase.ts';
import { importarCsv, importarDesdeDrive } from '../data/importador.ts';
import { enlacesDeAjustes } from '../lib/importar.ts';
import { aCsv } from '../lib/csv.ts';
import { formatoFechaHora, hoyISO } from '../lib/texto.ts';
import type { Tabla } from '../lib/tipos.ts';
import { Aviso, Campo, Titulo } from '../components/ui.tsx';

function descargar(nombre: string, contenido: string) {
  const url = URL.createObjectURL(new Blob(['﻿', contenido], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Ajustes({ userId, correo }: { userId: string; correo: string }) {
  const ajustes = useAjustes();
  const sync = useSync();
  const [drive, setDrive] = useState(ajustes?.drive_url ?? '');
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDrive(ajustes?.drive_url ?? '');
  }, [ajustes?.drive_url]);

  async function ejecutar(fn: () => Promise<string>) {
    setOcupado(true);
    setMsg(null);
    try {
      setMsg({ tipo: 'ok', texto: await fn() });
    } catch (e) {
      setMsg({ tipo: 'error', texto: e instanceof Error ? e.message : 'No se pudo completar la acción.' });
    } finally {
      setOcupado(false);
    }
  }

  async function guardarDrive() {
    const enlaces = drive.split(/[\s,]+/).filter(Boolean);
    const validos = enlacesDeAjustes(drive);
    if (enlaces.length && validos.length !== enlaces.length) {
      setMsg({ tipo: 'error', texto: 'Algún enlace no es de Google Sheets (debe empezar con https://docs.google.com/spreadsheets/).' });
      return;
    }
    await almacen.guardarAjustes({ drive_url: enlaces.join('\n') });
    setMsg({ tipo: 'ok', texto: 'Enlace guardado.' });
  }

  async function salir() {
    if (sync.pendientes > 0 && !window.confirm(`Hay ${sync.pendientes} cambios sin enviar. Si sales ahora se perderán. ¿Salir de todos modos?`)) return;
    await almacen.detener(true);
    await supabase?.auth.signOut();
  }

  function exportar() {
    const tablas: Array<[Tabla, string]> = [['properties', 'propiedades'], ['clients', 'clientes'], ['tasks', 'tareas']];
    for (const [t, nombre] of tablas) {
      const filas = almacen.filas(t).map((f) => {
        const { user_id: _u, ...resto } = f as unknown as Record<string, unknown>;
        return resto;
      });
      if (filas.length) descargar(`gladys-${nombre}-${hoyISO()}.csv`, aCsv(filas));
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Titulo>Ajustes</Titulo>

      <section className="tarjeta space-y-3">
        <h2 className="text-lg font-semibold">Hoja de Google Drive</h2>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Abre la hoja en la pestaña correcta (por ejemplo “Prospectos”) y copia el enlace de la barra del navegador: debe incluir <b>#gid=</b>.
          Basta con tener permiso de lectura. También sirve un enlace de “Publicar en la web” en CSV. Puedes pegar varias hojas, una por línea.
          Se revisa cada 2 minutos con la app abierta y cada 5 minutos aunque esté cerrada.
        </p>
        <Campo etiqueta="Enlace(s) de la hoja">
          <textarea className="campo font-mono text-sm" rows={3} value={drive} onChange={(e) => setDrive(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?output=csv" />
        </Campo>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secundario" onClick={() => void guardarDrive()}>
            <Save className="h-5 w-5" /> Guardar enlace
          </button>
          <button className="btn-primario" disabled={ocupado || !ajustes?.drive_url} onClick={() => void ejecutar(() => importarDesdeDrive(userId))}>
            {ocupado ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />} Importar ahora
          </button>
          <button className="btn-secundario" disabled={ocupado} onClick={() => archivo.current?.click()}>
            <FileUp className="h-5 w-5" /> Importar CSV
          </button>
          <input
            ref={archivo}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (f.size > 5 * 1024 * 1024) return setMsg({ tipo: 'error', texto: 'El archivo es muy grande (máximo 5 MB).' });
              void ejecutar(async () => importarCsv(await f.text(), userId));
            }}
          />
        </div>
        <p className="text-xs text-stone-500">
          Última importación: {ajustes?.ultima_importacion ? formatoFechaHora(ajustes.ultima_importacion) : 'nunca'}
        </p>
        {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      </section>

      <section className="tarjeta space-y-3">
        <h2 className="text-lg font-semibold">Comisiones</h2>
        <Campo etiqueta="Probabilidad de cierre para lo que está en negociación (%)">
          <input
            className="campo"
            type="number"
            min={0}
            max={100}
            inputMode="numeric"
            value={ajustes?.probabilidad_cierre ?? 60}
            onChange={(e) => void almacen.guardarAjustes({ probabilidad_cierre: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
          />
        </Campo>
      </section>

      <section className="tarjeta space-y-3">
        <h2 className="text-lg font-semibold">Copias de seguridad</h2>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Supabase guarda una versión por hora de cada registro (últimas 60) y GitHub hace un respaldo cifrado cada semana. También puedes descargar tus datos ahora.
        </p>
        <button className="btn-secundario" onClick={exportar}>
          <Download className="h-5 w-5" /> Descargar mis datos (CSV)
        </button>
      </section>

      <section className="tarjeta space-y-3">
        <h2 className="text-lg font-semibold">Cuenta</h2>
        <p className="text-sm text-stone-600 dark:text-stone-400">Sesión iniciada como {correo}</p>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Estado: {sync.estado === 'sincronizado' ? 'todo sincronizado' : sync.estado === 'sin-conexion' ? 'sin conexión' : 'sincronizando'}
          {sync.pendientes ? ` · ${sync.pendientes} cambios por enviar` : ''}
        </p>
        <button className="btn-peligro" onClick={() => void salir()}>
          <LogOut className="h-5 w-5" /> Cerrar sesión
        </button>
        <p className="text-xs text-stone-500">Al cerrar sesión se borran los datos guardados en este dispositivo.</p>
      </section>
    </div>
  );
}
