// Almacén offline-first.
// 1) Todo se lee y escribe primero en IndexedDB (respuesta instantánea).
// 2) Cada cambio entra a una cola "pendientes" que se envía a Supabase con
//    reintentos y espera creciente (2 s, 4 s, 8 s… hasta 5 min).
// 3) Supabase Realtime trae los cambios de otros dispositivos.
//    Regla: gana la última modificación (updated_at lo pone el servidor);
//    un cambio local que aún no se envía nunca es pisado por uno remoto.

import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Ajustes, FilasPorTabla, Tabla } from '../lib/tipos.ts';
import { abrirBase, TABLAS, type BaseLocal, type PendienteSync } from './db.ts';
import { soloColumnas, valoresPorDefecto } from './filas.ts';
import { mensajeError, supabase } from './supabase.ts';

export type EstadoSync = 'sincronizado' | 'sincronizando' | 'sin-conexion';

export interface InfoSync {
  estado: EstadoSync;
  pendientes: number;
  error: string | null;
  listo: boolean; // ya se cargó la base local
  primeraDescarga: boolean; // ya se bajaron datos del servidor al menos una vez
  /** Administradora de la app: ve la pestaña Ajustes. */
  esAdmin: boolean;
}

type Fila = FilasPorTabla[Tabla];
type Mapas = { [T in Tabla]: Map<string, FilasPorTabla[T]> };

const ESPERA_MIN = 2_000;
const ESPERA_MAX = 300_000;
const TAM_PAGINA = 1000;

/** Fila con todas las columnas: las que falten toman su valor por defecto. */
function completar<T extends Tabla>(tabla: T, fila: Record<string, unknown>): FilasPorTabla[T] {
  const base = valoresPorDefecto(tabla);
  const llena: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(fila)) if (v !== undefined) llena[k] = v;
  // Los textos nunca quedan en null (la base de datos tampoco lo permite).
  for (const [k, v] of Object.entries(base)) if (typeof v === 'string' && llena[k] == null) llena[k] = v;
  return soloColumnas(tabla, llena);
}

function ahoraISO(): string {
  return new Date().toISOString();
}

function esErrorDeDatos(e: { code?: string } | null): boolean {
  // 22xxx: dato inválido · 23xxx: restricción (check, unique, not null)
  return !!e?.code && /^2[23]/.test(e.code);
}

class Almacen {
  private db: BaseLocal | null = null;
  private userId: string | null = null;
  /** Cuenta dueña de los datos: la propia o, si es colaboradora, la de Gladys. */
  private cuentaId: string | null = null;
  private mapas: Mapas = { properties: new Map(), clients: new Map(), tasks: new Map(), settings: new Map() };
  private pendientes = new Map<string, PendienteSync>();
  private instantaneas = new Map<Tabla, unknown[]>();
  private oyentes = new Set<() => void>();
  private canal: RealtimeChannel | null = null;
  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private intentos = 0;
  private trabajando = false;
  private otraVuelta = false;
  private revContador = 0;
  private info: InfoSync = {
    estado: navigator.onLine ? 'sincronizando' : 'sin-conexion',
    pendientes: 0,
    error: null,
    listo: false,
    primeraDescarga: false,
    esAdmin: false,
  };

  // ---------------------------------------------------------------
  // Suscripción para React (useSyncExternalStore)
  // ---------------------------------------------------------------
  suscribir = (fn: () => void) => {
    this.oyentes.add(fn);
    return () => this.oyentes.delete(fn);
  };
  private avisar(tablas?: Tabla[]) {
    for (const t of tablas ?? TABLAS) this.instantaneas.delete(t);
    this.oyentes.forEach((fn) => fn());
  }
  /** Filas no borradas de una tabla (misma referencia mientras no cambie). */
  filas<T extends Tabla>(tabla: T): FilasPorTabla[T][] {
    let s = this.instantaneas.get(tabla) as FilasPorTabla[T][] | undefined;
    if (!s) {
      s = [...this.mapas[tabla].values()].filter((f) => !f.deleted_at) as FilasPorTabla[T][];
      this.instantaneas.set(tabla, s);
    }
    return s;
  }
  /** Incluye borradas (para importar sin revivir lo eliminado). */
  todas<T extends Tabla>(tabla: T): FilasPorTabla[T][] {
    return [...this.mapas[tabla].values()] as FilasPorTabla[T][];
  }
  obtener<T extends Tabla>(tabla: T, id: string): FilasPorTabla[T] | undefined {
    return this.mapas[tabla].get(id) as FilasPorTabla[T] | undefined;
  }
  ajustes(): Ajustes | null {
    return this.filas('settings')[0] ?? null;
  }
  estadoSync = (): InfoSync => this.info;
  private ponerInfo(p: Partial<InfoSync>) {
    const online = navigator.onLine;
    const sig = { ...this.info, ...p, pendientes: this.pendientes.size };
    sig.estado = !online
      ? 'sin-conexion'
      : this.trabajando || sig.pendientes > 0 || !sig.primeraDescarga
        ? 'sincronizando'
        : 'sincronizado';
    const cambio = (Object.keys(sig) as Array<keyof InfoSync>).some((k) => sig[k] !== this.info[k]);
    if (cambio) {
      this.info = sig;
      this.oyentes.forEach((fn) => fn());
    }
  }

  // ---------------------------------------------------------------
  // Ciclo de vida
  // ---------------------------------------------------------------
  async iniciar(userId: string) {
    if (this.userId === userId && this.db) return;
    this.db = await abrirBase();
    const anterior = (await this.db.get('meta', 'userId')) as string | undefined;
    if (anterior && anterior !== userId) await this.vaciarLocal();
    await this.db.put('meta', userId, 'userId');
    this.userId = userId;
    this.cuentaId = await this.resolverCuenta(userId);
    this.info = { ...this.info, esAdmin: await this.resolverAdmin() };

    for (const t of TABLAS) {
      // Las copias guardadas antes de una actualización pueden no tener
      // columnas nuevas: se completan con sus valores por defecto.
      const filas = (await this.db.getAll(t)).map((f) => completar(t, f as unknown as Record<string, unknown>));
      this.mapas[t] = new Map(filas.map((f) => [f.id, f])) as never;
    }
    for (const p of await this.db.getAll('pendientes')) this.pendientes.set(p.clave, p);
    this.revContador = Date.now();
    this.ponerInfo({ listo: true });
    this.avisar();

    window.addEventListener('online', this.alVolverConexion);
    window.addEventListener('offline', this.alPerderConexion);
    document.addEventListener('visibilitychange', this.alVolverAPantalla);
    this.conectarRealtime();
    void this.sincronizar();
  }

  async detener(borrarDatos: boolean) {
    window.removeEventListener('online', this.alVolverConexion);
    window.removeEventListener('offline', this.alPerderConexion);
    document.removeEventListener('visibilitychange', this.alVolverAPantalla);
    if (this.temporizador) clearTimeout(this.temporizador);
    if (this.canal && supabase) await supabase.removeChannel(this.canal);
    this.canal = null;
    if (borrarDatos) await this.vaciarLocal();
    this.userId = null;
    this.cuentaId = null;
    this.mapas = { properties: new Map(), clients: new Map(), tasks: new Map(), settings: new Map() };
    this.pendientes.clear();
    this.info = { ...this.info, listo: false, primeraDescarga: false, error: null, esAdmin: false };
    this.avisar();
  }

  /**
   * Pregunta al servidor de qué cuenta son los datos (función mi_cuenta()).
   * Sin conexión usa la última respuesta guardada; si la función no existe
   * (migración 0004 sin ejecutar), usa la propia cuenta.
   */
  private async resolverCuenta(userId: string): Promise<string> {
    const guardada = (await this.db!.get('meta', 'cuentaId')) as string | undefined;
    if (supabase && navigator.onLine) {
      const { data, error } = await supabase.rpc('mi_cuenta');
      if (!error && typeof data === 'string') {
        if (guardada && guardada !== data) {
          // Cambió la cuenta compartida: se descarta la copia local anterior.
          for (const t of [...TABLAS, 'pendientes'] as const) await this.db!.clear(t);
          for (const t of TABLAS) await this.db!.delete('meta', `desde:${t}`);
        }
        await this.db!.put('meta', data, 'cuentaId');
        return data;
      }
    }
    return guardada ?? userId;
  }

  /**
   * ¿Es la administradora? Si la función soy_admin() aún no existe en la base
   * (migración 0005 sin ejecutar), se considera administradora para no
   * dejar a nadie sin acceso a Ajustes.
   */
  private async resolverAdmin(): Promise<boolean> {
    const guardado = (await this.db!.get('meta', 'esAdmin')) as boolean | undefined;
    if (supabase && navigator.onLine) {
      const { data, error } = await supabase.rpc('soy_admin');
      if (!error && typeof data === 'boolean') {
        await this.db!.put('meta', data, 'esAdmin');
        return data;
      }
      if (error && /soy_admin|function|404|PGRST202/i.test(`${error.message} ${error.code}`)) return guardado ?? true;
    }
    return guardado ?? true;
  }

  /** Id de la cuenta dueña de los datos (para los ids deterministas al importar). */
  cuenta(): string | null {
    return this.cuentaId;
  }

  private async vaciarLocal() {
    if (!this.db) return;
    for (const t of [...TABLAS, 'pendientes', 'meta'] as const) await this.db.clear(t);
  }

  private alVolverConexion = () => {
    this.intentos = 0;
    this.ponerInfo({});
    void this.sincronizar();
  };
  private alPerderConexion = () => this.ponerInfo({});
  private alVolverAPantalla = () => {
    if (document.visibilityState === 'visible') void this.sincronizar();
  };

  // ---------------------------------------------------------------
  // Escrituras locales (optimistas)
  // ---------------------------------------------------------------
  async guardar<T extends Tabla>(tabla: T, cambios: Partial<FilasPorTabla[T]> & { id?: string }): Promise<FilasPorTabla[T]> {
    if (!this.db || !this.userId) throw new Error('Sesión no iniciada');
    const id = cambios.id ?? crypto.randomUUID();
    const actual = this.mapas[tabla].get(id) as Record<string, unknown> | undefined;
    const ahora = ahoraISO();
    const fila: Record<string, unknown> = {
      ...valoresPorDefecto(tabla),
      created_at: ahora,
      deleted_at: null,
      ...actual,
      ...cambios,
      id,
      user_id: this.cuentaId,
      updated_at: ahora,
    };
    if (tabla === 'properties') {
      const cerrada = fila.estado === 'Vendido' || fila.estado === 'Rentado';
      if (!cerrada) fila.cerrado_en = null;
      else if (!fila.cerrado_en || (actual && actual.estado !== fila.estado)) fila.cerrado_en = ahora;
    }
    const limpia = soloColumnas(tabla, fila);
    await this.ponerLocal(tabla, limpia);
    const clave = `${tabla}:${id}`;
    const pendiente: PendienteSync = { clave, tabla, id, fila: limpia as unknown as Record<string, unknown>, rev: ++this.revContador };
    this.pendientes.set(clave, pendiente);
    await this.db.put('pendientes', pendiente);
    this.avisar([tabla]);
    this.ponerInfo({});
    this.programar(300);
    return limpia;
  }

  /** Borrado lógico (deleted_at). */
  borrar(tabla: Tabla, id: string) {
    return this.guardar(tabla, { id, deleted_at: ahoraISO() } as never);
  }

  async guardarAjustes(cambios: Partial<Ajustes>) {
    const actual = this.ajustes();
    return this.guardar('settings', { ...(actual ? { id: actual.id } : {}), ...cambios });
  }

  private async ponerLocal(tabla: Tabla, fila: Fila) {
    (this.mapas[tabla] as Map<string, Fila>).set(fila.id, fila);
    await this.db!.put(tabla, fila as never);
  }

  /** Aplica una fila que viene del servidor si no hay un cambio local pendiente. */
  private async aplicarRemota(tabla: Tabla, fila: Fila, forzar = false): Promise<boolean> {
    if (this.pendientes.has(`${tabla}:${fila.id}`)) return false;
    const actual = this.mapas[tabla].get(fila.id);
    // Ignora eventos viejos que llegan tarde (salvo la respuesta directa a un envío).
    if (!forzar && actual && actual.updated_at > fila.updated_at) return false;
    if (tabla === 'settings') {
      // Solo existe una fila de ajustes: si había otra local con otro id, se reemplaza.
      for (const [id] of this.mapas.settings) {
        if (id !== fila.id && !this.pendientes.has(`settings:${id}`)) {
          this.mapas.settings.delete(id);
          await this.db!.delete('settings', id);
        }
      }
    }
    await this.ponerLocal(tabla, completar(tabla, fila as unknown as Record<string, unknown>));
    return true;
  }

  // ---------------------------------------------------------------
  // Sincronización con Supabase
  // ---------------------------------------------------------------
  private programar(ms: number) {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => void this.sincronizar(), ms);
  }

  async sincronizar(): Promise<void> {
    if (!supabase || !this.db || !this.userId) return;
    if (this.trabajando) {
      this.otraVuelta = true;
      return;
    }
    if (!navigator.onLine) {
      this.ponerInfo({});
      return;
    }
    this.trabajando = true;
    this.ponerInfo({});
    try {
      await this.enviarPendientes();
      await this.descargar();
      this.intentos = 0;
      this.ponerInfo({ error: null, primeraDescarga: true });
    } catch (e) {
      this.intentos++;
      const espera = Math.min(ESPERA_MAX, ESPERA_MIN * 2 ** (this.intentos - 1)) * (0.8 + Math.random() * 0.4);
      this.ponerInfo({ error: mensajeError(e) });
      this.programar(espera);
    } finally {
      this.trabajando = false;
      this.ponerInfo({});
      if (this.otraVuelta) {
        this.otraVuelta = false;
        this.programar(50);
      }
    }
  }

  private async enviarPendientes() {
    const lista = [...this.pendientes.values()];
    for (const tabla of TABLAS) {
      const deTabla = lista.filter((p) => p.tabla === tabla);
      if (!deTabla.length) continue;
      const filas = deTabla.map((p) => ({ ...p.fila, user_id: this.cuentaId }));
      const onConflict = tabla === 'settings' ? 'user_id' : 'id';
      const { data, error } = await supabase!.from(tabla).upsert(filas, { onConflict }).select();
      if (!error) {
        await this.confirmar(tabla, deTabla, (data ?? []) as Fila[]);
        continue;
      }
      if (!esErrorDeDatos(error)) throw error;
      // Algún registro es inválido: se envían uno por uno y se descartan solo los malos.
      for (const p of deTabla) {
        const r = await supabase!.from(tabla).upsert({ ...p.fila, user_id: this.cuentaId }, { onConflict }).select();
        if (!r.error) await this.confirmar(tabla, [p], (r.data ?? []) as Fila[]);
        else if (esErrorDeDatos(r.error)) {
          await this.quitarPendiente(p);
          this.ponerInfo({ error: `No se pudo guardar un registro: ${mensajeError(r.error)}` });
          await this.restaurarDelServidor(tabla, p.id);
        } else throw r.error;
      }
    }
  }

  private async confirmar(tabla: Tabla, enviados: PendienteSync[], devueltas: Fila[]) {
    for (const p of enviados) {
      const vigente = this.pendientes.get(p.clave);
      if (vigente && vigente.rev === p.rev) await this.quitarPendiente(p);
    }
    for (const f of devueltas) await this.aplicarRemota(tabla, f, true);
    if (tabla === 'settings') {
      // Si el servidor ya tenía ajustes con otro id, se descarta la copia local.
      for (const p of enviados) {
        if (!devueltas.some((d) => d.id === p.id) && !this.pendientes.has(p.clave)) {
          this.mapas.settings.delete(p.id);
          await this.db!.delete('settings', p.id);
        }
      }
    }
    this.avisar([tabla]);
  }

  /** Vuelve a la versión del servidor de una fila (o la quita si no existe allá). */
  private async restaurarDelServidor(tabla: Tabla, id: string) {
    const { data, error } = await supabase!.from(tabla).select('*').eq('id', id).maybeSingle();
    if (error) return;
    if (data) await this.aplicarRemota(tabla, data as Fila, true);
    else {
      this.mapas[tabla].delete(id);
      await this.db!.delete(tabla, id);
    }
    this.avisar([tabla]);
  }

  private async quitarPendiente(p: PendienteSync) {
    this.pendientes.delete(p.clave);
    await this.db!.delete('pendientes', p.clave);
  }

  /**
   * Baja lo que cambió en el servidor desde la última vez (incluye borrados lógicos).
   * Paginación por (updated_at, id) para no saltarse filas con la misma hora.
   */
  private async descargar() {
    for (const tabla of TABLAS) {
      const marca = (await this.db!.get('meta', `desde:${tabla}`)) as { t: string; id: string } | string | undefined;
      let desde = typeof marca === 'object' && marca ? marca : { t: '1970-01-01T00:00:00Z', id: '' };
      for (;;) {
        let q = supabase!.from(tabla).select('*');
        q = desde.id
          ? q.or(`updated_at.gt."${desde.t}",and(updated_at.eq."${desde.t}",id.gt.${desde.id})`)
          : q.gt('updated_at', desde.t);
        const { data, error } = await q
          .order('updated_at', { ascending: true })
          .order('id', { ascending: true })
          .limit(TAM_PAGINA);
        if (error) throw error;
        const filas = (data ?? []) as Fila[];
        for (const f of filas) await this.aplicarRemota(tabla, f);
        if (filas.length) {
          const ultima = filas[filas.length - 1];
          desde = { t: ultima.updated_at, id: ultima.id };
          await this.db!.put('meta', desde, `desde:${tabla}`);
          this.avisar([tabla]);
        }
        if (filas.length < TAM_PAGINA) break;
      }
    }
  }

  private conectarRealtime() {
    if (!supabase || !this.userId) return;
    let canal = supabase.channel(`gladys-${this.userId}`);
    for (const tabla of TABLAS) {
      canal = canal.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tabla, filter: `user_id=eq.${this.cuentaId}` },
        (payload) => {
          const fila = payload.new as Fila | undefined;
          if (fila && 'id' in fila) {
            void this.aplicarRemota(tabla, fila).then((ok) => ok && this.avisar([tabla]));
          }
        },
      );
    }
    this.canal = canal.subscribe((estado) => {
      // Al (re)conectar se descarga lo que haya cambiado mientras tanto.
      if (estado === 'SUBSCRIBED') void this.sincronizar();
    });
  }

  /** Espera a que termine la primera descarga (máx. 15 s). */
  async esperarPrimeraDescarga(): Promise<boolean> {
    const inicio = Date.now();
    while (!this.info.primeraDescarga && Date.now() - inicio < 15_000) {
      if (!navigator.onLine) return false;
      await new Promise((r) => setTimeout(r, 250));
    }
    return this.info.primeraDescarga;
  }
}

export const almacen = new Almacen();
