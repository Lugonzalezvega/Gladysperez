# Gladys en el Valle 🏡

CRM personal para **una sola vendedora** que maneja su propio inventario de **casas y terrenos en venta y renta**.
Funciona como app instalada en el celular (PWA), también **sin internet**, y se sincroniza sola entre dispositivos.

**Costo: $0.** Usa solo planes gratuitos: GitHub (código y página web), Supabase (base de datos y acceso) y Google Sheets (opcional, para importar).

---

## Índice

1. [Qué hace](#qué-hace)
2. [Instalación paso a paso](#instalación-paso-a-paso) (para una persona no técnica, ~40 minutos)
3. [Conectar la hoja de Google Drive](#paso-11-conectar-la-hoja-de-google-drive)
4. [Copias de seguridad y cómo recuperar datos](#copias-de-seguridad)
5. [Decisiones tomadas](#decisiones-tomadas)
6. [Para programadores](#para-programadores)
7. [Checklist de seguridad](#checklist-de-seguridad)

---

## Qué hace

| Sección | Para qué sirve |
|---|---|
| **Resumen** | Comisiones ganadas del mes y del año, comisiones en negociación (total y ponderada por la probabilidad que tú eliges), inventario por estado, disponibles por tipo y operación, gráfica de los últimos 6 meses, negociaciones activas y tareas de hoy. |
| **Inventario** | Tarjetas de propiedades con etiquetas de color (**Venta** verde, **Renta** azul, **Casa** ámbar, **Terreno** lima), filtros, alta rápida, cambio de estado, enlace a fotos, compartir ficha por WhatsApp y borrar. |
| **Clientes** | Tablero (Kanban) con 5 etapas: Nuevo → Contactado → Cita Agendada → Oferta Enviada → Cerrado. En computadora se arrastran las tarjetas; en el celular hay pestañas y un selector de etapa. Cada tarjeta tiene **Llamó** / **No llamó** (guardan la fecha; "Llamó" en un cliente Nuevo lo pasa a Contactado). |
| **Matching** | Eliges un cliente y aparecen al instante las propiedades **Disponibles** que le sirven (misma operación o "Venta y Renta", precio dentro del presupuesto, misma zona). También puedes escribir el filtro: `Casa en Venta < $250k`, `terreno Tumbaco hasta 80 mil`. |
| **Agenda** | Tareas por tipo (Llamada, Muestra de propiedad, Firma, Seguimiento), fecha y hora, casilla de hecha y pendientes atrasadas. En las llamadas: **Llamó** la marca hecha; **No llamó** la deja pendiente. |
| **WhatsApp** | Un toque abre WhatsApp con el mensaje listo: ficha de la propiedad, recordatorio de cita o seguimiento. |
| **Ajustes** | Enlace de la hoja de Google Sheets, botón **Importar ahora**, botón **Importar CSV**, probabilidad de cierre, descarga de tus datos y cerrar sesión. |

**Comisión** = precio × % de comisión ÷ 100. En **rentas**, 100 % equivale a un mes de canon (ej.: canon $900 con 100 % = $900).

**Indicador arriba a la derecha:** ☁️ *Sincronizado* · 🔄 *Sincronizando* · ⛔ *Sin conexión* (los cambios se guardan en el teléfono y se envían solos cuando vuelve el internet).

---

## Instalación paso a paso

Necesitas una computadora para la instalación (después todo se usa desde el celular).
Los nombres de los botones de GitHub y Supabase pueden cambiar un poco con el tiempo; si no encuentras uno exactamente igual, busca el más parecido.

### Paso 1. Crear las cuentas gratuitas

1. **GitHub:** entra a <https://github.com/signup> y crea una cuenta.
2. **Supabase:** entra a <https://supabase.com> → **Start your project** → entra con tu cuenta de GitHub.

### Paso 2. Subir el código a GitHub

1. En GitHub, arriba a la derecha toca **+** → **New repository**.
2. Nombre: `gladys-en-el-valle`. Marca **Public** (necesario para que GitHub Pages y las tareas automáticas sean gratis). **No** marques "Add a README". Toca **Create repository**.
3. La forma más fácil de subir los archivos es con **GitHub Desktop** (<https://desktop.github.com>):
   - Instálalo y entra con tu cuenta.
   - **File → Add local repository** → elige la carpeta `gladys-en-el-valle` que descomprimiste → **Publish repository** (desmarca "Keep this code private").
   - Alternativa sin programas: en la página del repositorio vacío toca **uploading an existing file** y arrastra **todo el contenido** de la carpeta. ⚠️ Asegúrate de que se suba también la carpeta oculta **`.github`** (en Mac: en la carpeta presiona `Cmd + Shift + .` para ver los archivos ocultos).

> 🔒 El repositorio puede ser público sin problema: **no contiene contraseñas ni claves secretas**. Los datos de tus clientes viven en Supabase, protegidos.

### Paso 3. Crear el proyecto en Supabase

1. En Supabase toca **New project**.
2. Nombre: `gladys-en-el-valle`. Inventa una **contraseña de base de datos** fuerte y guárdala en un lugar seguro (no se usa en la app).
3. Región: **East US (North Virginia)** (la más rápida desde Ecuador).
4. Toca **Create new project** y espera 1–2 minutos.

### Paso 4. Crear las tablas (ejecutar las migraciones)

1. En el menú izquierdo de Supabase abre **SQL Editor** → **New query**.
2. En GitHub (o en tu carpeta), abre `supabase/migrations/20261121000001_esquema.sql`, copia **todo** el texto, pégalo en el editor y toca **Run**. Debe decir *Success*.
3. Repite con `20261121000002_seguridad.sql`.
4. Repite con `20261121000003_historial.sql`.

(Si alguna vez las vuelves a ejecutar no pasa nada: están hechas para poder repetirse.)

### Paso 5. Desactivar el registro público

Así **nadie más** puede crearse una cuenta en tu app.

1. Menú izquierdo: **Authentication** → **Sign In / Providers** (en versiones anteriores: *Providers* o *Settings*).
2. Desactiva **Allow new users to sign up** y guarda (**Save**).
3. Confirma que **Email** siga activado como forma de entrar.

### Paso 6. Crear tu usuario

1. **Authentication** → **Users** → **Add user** → **Create new user**.
2. Escribe tu correo y una contraseña fuerte (mínimo 12 caracteres).
3. Marca **Auto Confirm User** y toca **Create user**.

### Paso 7. Copiar los datos públicos del proyecto

1. Abre **Project Settings** (ícono de engranaje) → **API** (o **Data API** / **API Keys**).
2. Copia la **Project URL** (algo como `https://abcdefgh.supabase.co`).
3. Copia la clave **anon public** (o **publishable key**, que empieza con `sb_publishable_`).

> ⛔ **Nunca copies la clave `service_role` ni la `secret key`.** La app no la necesita y no debe ir en ningún lado.

### Paso 8. Guardar los secretos en GitHub

En tu repositorio de GitHub: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Crea estos (nombre exacto, en mayúsculas):

| Nombre | Valor | ¿Obligatorio? |
|---|---|---|
| `SUPABASE_URL` | La Project URL del paso 7 | Sí |
| `SUPABASE_ANON_KEY` | La clave anon / publishable del paso 7 | Sí |
| `GLADYS_EMAIL` | Tu correo del paso 6 | Para importar de Drive cada 5 min aunque la app esté cerrada, y para el respaldo semanal |
| `GLADYS_PASSWORD` | Tu contraseña del paso 6 | Igual que el anterior |
| `BACKUP_PASSWORD` | Una contraseña **nueva y distinta** (mín. 12 caracteres) para cifrar los respaldos. **Anótala en papel**: sin ella no se pueden abrir. | Para el respaldo semanal |

Los secretos de GitHub están cifrados y no se muestran a nadie, ni siquiera en los registros.

### Paso 9. Activar la página (GitHub Pages)

1. En el repositorio: **Settings** → **Pages**.
2. En **Source** elige **GitHub Actions**.
3. Ve a la pestaña **Actions** → **Desplegar en GitHub Pages** → **Run workflow** → **Run workflow**.
4. Espera ~2 minutos a que aparezca ✅. Tu app queda en:
   **`https://TU-USUARIO.github.io/gladys-en-el-valle/`**
5. Ábrela, entra con tu correo y contraseña. ¡Listo!

Cada vez que se cambie algo en la rama `main`, la página se vuelve a publicar sola y la app te mostrará el aviso **"Hay una versión nueva, toca para actualizar"**.

### Paso 10. Instalar la app en el celular

- **Android (Chrome):** abre la dirección de tu app → menú **⋮** → **Instalar aplicación** (o **Agregar a la pantalla principal**).
- **iPhone (Safari):** abre la dirección → botón **Compartir** (cuadrado con flecha) → **Agregar a inicio**.

Aparece el ícono azul con las letras **GP** (nombre "Gladys"). Ábrela desde ahí: se ve a pantalla completa y funciona sin internet.

### Paso 11. Conectar la hoja de Google Drive

1. Abre tu hoja en Google Sheets. Los títulos de las columnas pueden estar en la primera fila **o más abajo** (si arriba hay un título o un resumen, la app encuentra sola la fila de títulos). Los reconoce **sin importar tildes ni mayúsculas**:

   **Hoja de clientes** (basta con *Nombre* o *Teléfono*):

   | Columna | También se reconoce como |
   |---|---|
   | Nombre | Cliente, Nombres, Contacto |
   | Teléfono | Celular, WhatsApp, Móvil, Número |
   | Interés | Busca, Qué busca — se entiende "comprar casa", "arriendo", "terreno", "propietario" |
   | Presupuesto | Presupuesto máximo, Monto (acepta `$250.000`, `250k`, `80 mil`) |
   | Ubicación | Zona, Sector |
   | Notas | Comentarios, Observaciones |
   | Código *(opcional)* | ID, Clave, Referencia |
   | Propiedad · De dónde vino · Correo · Fecha · Cómo piensa comprar · Quiere agendar visita · Propiedad y precio le convienen | Columnas típicas de un formulario de leads: se guardan en las **notas** del cliente. Si no hay columna *Interés*, se deduce de *Propiedad* ("Terreno…" → Busca Comprar Terreno). |

   **Hoja de propiedades** (se reconoce si tiene *Precio* y *Tipo/Operación/Dirección*):
   Código, Tipo (Casa/Terreno/Lote), Operación (Venta/Renta/Arriendo/Venta y Renta), Precio, Canon mensual, Comisión, Dirección o Ubicación, Terreno m², Construcción m², Habitaciones, Amenidades, Fotos (enlace https), Estado.

2. Abre la hoja **en la pestaña correcta** (ej. "Prospectos") y copia el enlace de la barra del navegador. Debe incluir `#gid=` (indica la pestaña). Basta con **permiso de lectura**: la hoja debe estar compartida como *Cualquier persona con el enlace puede ver* (o *Lector*). Sin `#gid=` se lee la primera pestaña creada.
   - Si eres dueña de la hoja, también sirve **Archivo → Compartir → Publicar en la web** → elige la pestaña y **Valores separados por comas (.csv)**.
3. En la app: **Ajustes** → pega el enlace → **Guardar enlace** → **Importar ahora**. Puedes pegar dos enlaces (clientes y propiedades), uno por línea.

**Qué pasa al importar:**
- Los teléfonos de Ecuador se normalizan: `0999 123 456` → `593999123456`.
- No se duplica nada: cada fila se reconoce por su **Código**; si no hay, por el **teléfono** (clientes) o por **tipo + operación + dirección** (propiedades). También se reconocen los registros que creaste a mano en la app.
- Cada **cliente nuevo** crea una tarea **"Llamar a …"** para hoy (si respondió que quiere visitar *esta semana*, la tarea lo dice). ⚠️ La primera importación crea una tarea por cada lead que ya está en la hoja.
- Las **notas** se llenan solo al crear el cliente: lo que escribas después en la app nunca se sobrescribe.
- Las celdas vacías **no borran** lo que ya tienes. La **etapa** del cliente y el **estado** de la propiedad se manejan en la app (de la hoja solo se toman al crear).
- Lo que borraste en la app **no vuelve a aparecer**.
- Se importa sola: cada **2 minutos** con la app abierta y cada **5 minutos** aunque esté cerrada, gracias a GitHub (si configuraste `GLADYS_EMAIL` y `GLADYS_PASSWORD`). GitHub a veces retrasa unos minutos sus tareas programadas en horas pico. Si necesitas un lead al instante: **Ajustes → Importar ahora**.
- Botón **Importar CSV**: sube un archivo `.csv` exportado de Excel o Sheets (acepta `,` o `;`).

> 🔒 Quien tenga el enlace de la hoja puede ver sus datos. No lo compartas. El acceso lo controla la persona dueña de la hoja.

---

## Copias de seguridad

Hay **tres** capas:

1. **Historial automático en Supabase:** cada vez que cambias algo se guarda una versión (máximo **una por hora por registro**, se conservan las **últimas 60**). Para recuperar algo:
   - Supabase → **SQL Editor**, ejecuta (cambia el nombre):
     ```sql
     select id, hora, datos->>'nombre' as nombre, datos->>'etapa' as etapa
     from historial where tabla = 'clients' and datos->>'nombre' ilike '%ana%'
     order by hora desc;
     ```
   - Elige el `id` de la versión buena y ejecuta: `select public.restaurar_version(123);`
   - Un registro "borrado" en la app no desaparece: solo se marca con `deleted_at`. Para recuperarlo: `update clients set deleted_at = null where id = '…';`
2. **Respaldo semanal cifrado en GitHub:** cada domingo, pestaña **Actions → Respaldo semanal** → al final de la ejecución, sección **Artifacts**, se descarga `gladys-respaldo-FECHA`. Está cifrado con tu `BACKUP_PASSWORD`. Para abrirlo (Mac/Linux, o "Git Bash" en Windows):
   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in gladys-respaldo-FECHA.tgz.enc | tar xz
   ```
   Te pide la contraseña y crea la carpeta `respaldo/` con los CSV (se abren en Excel).
3. **Descarga manual:** en la app, **Ajustes → Descargar mis datos (CSV)**.

---

## Mantenimiento automático

| Workflow (pestaña Actions) | Cuándo | Qué hace |
|---|---|---|
| Desplegar en GitHub Pages | Cada cambio en `main` | Corre las pruebas, compila y publica la app. |
| Mantener activo | Cada 3 días | Hace una consulta mínima para que Supabase gratuito **no pause** el proyecto (se pausa tras 7 días sin uso). |
| Respaldo semanal | Domingos | Exporta las tablas a CSV cifrado (guardado 90 días). |
| Importar desde Google Drive | Cada 5 min | Trae lo nuevo de la hoja (necesita `GLADYS_EMAIL` / `GLADYS_PASSWORD`). |

⚠️ GitHub **desactiva las tareas programadas** de un repositorio que pasa **60 días sin cambios**. El workflow "Mantener activo" intenta reactivarlas solo, pero si GitHub te envía un correo avisando que se desactivaron, entra a **Actions**, elige el workflow y toca **Enable workflow**. Si Supabase llegara a pausar el proyecto, entra a supabase.com y toca **Restore project** (tus datos no se pierden).

---

## Decisiones tomadas

Donde las instrucciones dejaban opciones abiertas, se eligió lo más simple y seguro:

1. **Importación de Drive con GitHub Actions (no Edge Function).** No requiere instalar herramientas de Supabase ni desplegar funciones; el código de importación es el mismo que usa la app (y está probado). El workflow entra **con la cuenta de Gladys** (secretos `GLADYS_EMAIL`/`GLADYS_PASSWORD`), así que todo pasa por Row Level Security; **nunca se usa la `service_role` key**. Además la app importa sola cada 2 min mientras está abierta. No se usa un servidor siempre encendido (Render u otro): en el plan gratuito se duerme y aun así tendría que consultar la hoja periódicamente; para avisos instantáneos, la dueña de la hoja tendría que agregarle un script que envíe cada lead a Supabase.
2. **IDs deterministas al importar:** el mismo cliente de la hoja siempre genera el mismo id, así la app y GitHub pueden importar a la vez sin crear duplicados (ni tareas "Llamar a…" repetidas).
3. **"Gana la última modificación" con la hora del servidor:** `updated_at` lo pone siempre Postgres, para que celulares con la hora mal configurada no causen problemas. Un cambio hecho sin conexión que todavía no se envía nunca es pisado por uno remoto; al enviarse, pasa a ser el último.
4. **Campo extra `precio_renta`:** para propiedades "Venta y Renta", `precio` es el de venta y `precio_renta` el canon mensual. El matching de quien busca rentar compara con el canon, y la comisión de una "Venta y Renta" cerrada como **Rentado** se calcula sobre el canon. En negociación se usa el precio de venta.
5. **Matching de ubicación:** coincide si **alguna** palabra significativa de la ubicación deseada aparece en la dirección (sin tildes; se ignoran "de", "sector", "barrio", etc.). Ubicación vacía = cualquier zona. Los resultados se ordenan del precio más alto (más cercano al presupuesto) al más bajo. Clientes "Propietario/Consignador" no tienen filtro automático. El filtro escrito a mano reemplaza todo el filtro.
6. **Historial "una versión por hora (últimas 60)"** se interpretó **por registro**.
7. **Tareas sin llave foránea a clientes:** para que funcione sin conexión aunque la tarea llegue al servidor antes que el cliente.
8. **Teléfonos** se guardan solo con dígitos (`593…`, máximo 15). Los fijos `02 234 5678` → `59322345678`.
9. **Cerrar sesión borra los datos guardados en ese dispositivo** (avisa si hay cambios sin enviar). Si entra otra cuenta en el mismo navegador, se limpia la copia local anterior.
10. **"Llamó / No llamó" en la Agenda** también se registra en el cliente si la tarea tiene cliente.
11. Al crear un cliente a mano también se crea la tarea "Llamar a …" para hoy (igual que al importar).
12. Los enlaces `tel:` (llamar) se permiten además de `https:`; cualquier otro enlace externo debe ser https.

---

## Para programadores

```bash
npm ci
cp .env.example .env.local   # pon tu URL y anon key
npm run dev                  # http://localhost:5173
npm test                     # Vitest: lógica + seguridad SQL (PGlite)
npm run build
```

- **Stack:** Vite + React 18 + TypeScript, Tailwind CSS, lucide-react, HashRouter, Supabase (Postgres + Auth + Realtime), vite-plugin-pwa (red primero con caché de respaldo), IndexedDB (`idb`), Vitest.
- **Estructura:**
  - `src/lib/` lógica pura sin dependencias (comisiones, matching, CSV, teléfonos, importación, WhatsApp). La usan la app **y** los scripts de los workflows (Node 22 con `--experimental-strip-types`, por eso los imports llevan `.ts`).
  - `src/data/` capa offline-first: `store.ts` (IndexedDB + cola de sincronización con espera creciente 2 s → 5 min + Realtime), `importador.ts`.
  - `src/pages/`, `src/components/` interfaz.
  - `supabase/migrations/` SQL; `supabase/tests/` pruebas de RLS que ejecutan las migraciones reales en PGlite.
  - `scripts/` importación de Drive y respaldo para GitHub Actions.
- **Pruebas:** 60 en verde — comisiones (venta, renta, "Venta y Renta", mes/año en hora de Ecuador, ponderado, últimos 6 meses), matching (interés, presupuesto, ubicación, filtro escrito), CSV, teléfonos, números, importación (idempotencia, sin duplicados, no revive borrados), enlaces y RLS.

---

## Checklist de seguridad

| # | Requisito | Estado | Cómo se verificó |
|---|---|---|---|
| 1 | Row Level Security activado en **todas** las tablas | ✅ | `20261121000002_seguridad.sql` y `..._historial.sql` activan RLS en `properties`, `clients`, `tasks`, `settings` e `historial`. Prueba `supabase/tests/seguridad.test.ts`. |
| 2 | Cada fila lleva `user_id default auth.uid()` | ✅ | Definido en cada tabla; la prueba comprueba que una fila nueva queda con el id de la usuaria. |
| 3 | Políticas solo permiten `user_id = auth.uid()` | ✅ | Políticas de select/insert/update/delete para `authenticated`. Prueba: otra cuenta no ve, no edita, no borra, no inserta a nombre ajeno y no puede cambiar el dueño de una fila (el trigger lo impide). |
| 4 | Sin sesión no hay acceso | ✅ | `revoke all … from anon`. Prueba: el rol `anon` recibe error en las 5 tablas; solo puede llamar `ping()` (que no lee datos). |
| 5 | El historial no se puede alterar desde el navegador | ✅ | Solo `select` para `authenticated`; lo escribe un trigger `security definer`. Prueba: insertar en `historial` falla. |
| 6 | Login con correo y contraseña; **registro público desactivado** | ✅ / 👤 | La app no tiene pantalla de registro (solo `signInWithPassword`). Desactivar *Allow new users to sign up* es el **paso 5** (se hace en Supabase). |
| 7 | En el frontend solo va la anon key | ✅ | `src/data/supabase.ts` usa únicamente `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Búsqueda en el código: no existe `service_role` fuera de este README y comentarios de advertencia. |
| 8 | La `service_role` key nunca se usa | ✅ | Ni la app ni los workflows la usan; los workflows entran como la usuaria y pasan por RLS. |
| 9 | Repositorio sin secretos | ✅ | `.env*` está en `.gitignore` (excepto `.env.example` con valores de ejemplo). Los valores reales van como secretos de GitHub (paso 8). |
| 10 | Sin `dangerouslySetInnerHTML` | ✅ | Búsqueda en `src/`: 0 resultados. Todo texto se muestra con React (escapado). |
| 11 | Enlaces externos solo https | ✅ | `urlHttpsSegura()` valida enlaces de fotos (también rechaza `usuario:clave@`); la base de datos lo exige con un `check` (`^https://`); la importación descarta enlaces no https; los enlaces de Sheets deben ser `https://docs.google.com`. Se abren con `noopener,noreferrer`. Pruebas en `importar.test.ts` y en el navegador. |
| 12 | Content-Security-Policy por meta tag | ✅ | Se inyecta al compilar (`vite.config.ts`): `default-src 'self'`, `script-src 'self'` (sin scripts en línea), `style-src 'self'`, `connect-src` solo Supabase y Google Sheets, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`. Se probó en Chrome sin ninguna violación de CSP. |
| 13 | Sin datos de clientes en la consola | ✅ | El código de la app no tiene ningún `console.*` (búsqueda en `src/`: 0); el error boundary no imprime el error. Las librerías (React, Supabase) solo emiten avisos técnicos propios, sin datos. Los scripts de los workflows (cuyos registros son públicos) imprimen solo cantidades. |
| 14 | Respaldos protegidos | ✅ | El respaldo semanal se cifra con AES-256 (`BACKUP_PASSWORD`) antes de subirse; si falta la contraseña no se guarda nada. Se probó cifrar y descifrar. |
| 15 | Datos locales del dispositivo | ✅ | IndexedDB del navegador (solo accesible por la app); se borra al cerrar sesión. |
| 16 | Política `Referrer` | ✅ | `no-referrer`: las URLs de la app no se filtran a sitios externos. |

**Límite conocido:** GitHub Pages no permite cabeceras HTTP propias, por lo que no se puede usar `frame-ancestors` (protección contra que otra página incruste la app). El riesgo es bajo porque la app exige sesión y no tiene acciones de un solo clic peligrosas fuera de confirmaciones.

---

## Qué falta / ideas futuras

- Subir fotos directamente a la app (hoy se enlaza una carpeta de Drive o similar).
- Notificaciones push de las tareas del día.
- Exportar fichas en PDF.
