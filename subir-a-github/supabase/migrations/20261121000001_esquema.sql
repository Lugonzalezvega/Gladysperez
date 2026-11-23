-- =====================================================================
-- Gladys en el Valle — esquema principal
-- Ejecutar en Supabase > SQL Editor (en orden: 0001, 0002, 0003).
-- =====================================================================

-- gen_random_uuid() es nativo desde Postgres 13: no se necesitan extensiones.

-- ---------------------------------------------------------------------
-- updated_at lo pone SIEMPRE el servidor: así todos los dispositivos
-- comparan con el mismo reloj ("gana la última modificación").
-- ---------------------------------------------------------------------
create or replace function public.tocar_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := coalesce(new.created_at, now());
  else
    new.created_at := old.created_at;   -- no se puede reescribir
    new.user_id := old.user_id;         -- una fila nunca cambia de dueña
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Propiedades (casas y terrenos)
-- ---------------------------------------------------------------------
create table if not exists public.properties (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo             text not null default 'Casa'
                   check (tipo in ('Casa','Terreno')),
  operacion        text not null default 'Venta'
                   check (operacion in ('Venta','Renta','Venta y Renta')),
  estado           text not null default 'Disponible'
                   check (estado in ('Disponible','En Negociación','Vendido','Rentado')),
  precio           numeric(14,2) not null default 0 check (precio >= 0),
  precio_renta     numeric(14,2) check (precio_renta is null or precio_renta >= 0),
  comision_pct     numeric(6,2) not null default 3 check (comision_pct >= 0 and comision_pct <= 100),
  direccion        text not null default '' check (char_length(direccion) <= 500),
  m2_terreno       numeric(12,2) check (m2_terreno is null or m2_terreno >= 0),
  m2_construccion  numeric(12,2) check (m2_construccion is null or m2_construccion >= 0),
  recamaras        integer check (recamaras is null or recamaras between 0 and 99),
  amenidades       text not null default '' check (char_length(amenidades) <= 2000),
  link_fotos       text check (link_fotos is null or link_fotos = '' or link_fotos ~* '^https://'),
  cerrado_en       timestamptz,
  external_key     text check (external_key is null or char_length(external_key) <= 300),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz,
  constraint properties_external_key_unico unique (user_id, external_key)
);

comment on column public.properties.precio_renta is
  'Solo para "Venta y Renta": canon mensual. precio = precio de venta.';

-- cerrado_en se llena al pasar a Vendido/Rentado y se limpia si vuelve atrás.
create or replace function public.marcar_cierre()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.estado in ('Vendido','Rentado') then
    if tg_op = 'UPDATE' and old.estado = new.estado then
      new.cerrado_en := coalesce(new.cerrado_en, old.cerrado_en, now());
    else
      new.cerrado_en := coalesce(new.cerrado_en, now());
    end if;
  else
    new.cerrado_en := null;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create table if not exists public.clients (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre             text not null default '' check (char_length(nombre) <= 200),
  telefono           text not null default '' check (telefono ~ '^[0-9]{0,15}$'),
  interes            text not null default 'Busca Comprar Casa'
                     check (interes in ('Busca Comprar Casa','Busca Rentar Casa',
                                        'Busca Comprar Terreno','Propietario/Consignador')),
  presupuesto_max    numeric(14,2) check (presupuesto_max is null or presupuesto_max >= 0),
  ubicacion_deseada  text not null default '' check (char_length(ubicacion_deseada) <= 300),
  etapa              text not null default 'Nuevo'
                     check (etapa in ('Nuevo','Contactado','Cita Agendada','Oferta Enviada','Cerrado')),
  llamo              text check (llamo is null or llamo in ('si','no')),
  llamo_en           timestamptz,
  notas              text not null default '' check (char_length(notas) <= 5000),
  external_key       text check (external_key is null or char_length(external_key) <= 300),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  constraint clients_external_key_unico unique (user_id, external_key)
);

-- ---------------------------------------------------------------------
-- Tareas / agenda
-- ---------------------------------------------------------------------
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo        text not null default 'Llamada'
              check (tipo in ('Llamada','Muestra de propiedad','Firma','Seguimiento')),
  texto       text not null default '' check (char_length(texto) <= 1000),
  fecha       date not null default current_date,
  hora        time,
  hecha       boolean not null default false,
  llamo       text check (llamo is null or llamo in ('si','no')),
  -- Sin llave foránea a propósito: la app funciona sin conexión y una tarea
  -- puede llegar al servidor antes que su cliente. Si el cliente no existe,
  -- la tarea simplemente se muestra sin cliente.
  client_id   uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ---------------------------------------------------------------------
-- Ajustes (una fila por usuaria)
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  drive_url            text not null default '' check (char_length(drive_url) <= 3000),
  ultima_importacion   timestamptz,
  probabilidad_cierre  integer not null default 60 check (probabilidad_cierre between 0 and 100),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,
  constraint settings_una_por_usuaria unique (user_id)
);

-- ---------------------------------------------------------------------
-- Triggers e índices
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['properties','clients','tasks','settings'] loop
    execute format('drop trigger if exists %1$s_updated_at on public.%1$s', t);
    execute format('create trigger %1$s_updated_at before insert or update on public.%1$s
                    for each row execute function public.tocar_updated_at()', t);
    execute format('create index if not exists %1$s_user_updated_idx on public.%1$s (user_id, updated_at)', t);
  end loop;
end $$;

drop trigger if exists properties_cierre on public.properties;
create trigger properties_cierre before insert or update on public.properties
  for each row execute function public.marcar_cierre();

create index if not exists tasks_user_fecha_idx on public.tasks (user_id, fecha);
