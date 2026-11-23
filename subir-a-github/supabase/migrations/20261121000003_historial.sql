-- =====================================================================
-- Gladys en el Valle — copias de seguridad automáticas (historial)
-- Por cada fila se guarda como máximo UNA versión por hora y se
-- conservan las últimas 60 versiones de esa fila.
-- =====================================================================

create table if not exists public.historial (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  tabla       text not null,
  fila_id     uuid not null,
  hora        timestamptz not null,           -- hora truncada (una versión por hora)
  datos       jsonb not null,
  created_at  timestamptz not null default now(),
  constraint historial_una_por_hora unique (tabla, fila_id, hora)
);

create index if not exists historial_fila_idx on public.historial (tabla, fila_id, hora desc);

alter table public.historial enable row level security;
revoke all on public.historial from anon, authenticated;
grant select on public.historial to authenticated;     -- solo lectura desde la app

drop policy if exists "historial_select_propio" on public.historial;
create policy "historial_select_propio" on public.historial for select to authenticated
  using (user_id = (select auth.uid()));

-- La escritura la hace solo este trigger (security definer), nunca el navegador.
create or replace function public.guardar_historial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hora timestamptz := date_trunc('hour', now());
begin
  insert into public.historial (user_id, tabla, fila_id, hora, datos)
  values (new.user_id, tg_table_name, new.id, v_hora, to_jsonb(new))
  on conflict (tabla, fila_id, hora) do update set datos = excluded.datos, created_at = now();

  delete from public.historial h
  where h.tabla = tg_table_name
    and h.fila_id = new.id
    and h.id not in (
      select id from public.historial
      where tabla = tg_table_name and fila_id = new.id
      order by hora desc
      limit 60
    );
  return null;
end;
$$;

revoke all on function public.guardar_historial() from public, anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['properties','clients','tasks','settings'] loop
    execute format('drop trigger if exists %1$s_historial on public.%1$s', t);
    execute format('create trigger %1$s_historial after insert or update on public.%1$s
                    for each row execute function public.guardar_historial()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Restaurar una fila a una versión anterior (desde el SQL Editor):
--   select public.restaurar_version(<id del historial>);
-- Solo funciona sobre filas propias.
-- ---------------------------------------------------------------------
create or replace function public.restaurar_version(p_historial_id bigint)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare r public.historial;
begin
  select * into r from public.historial where id = p_historial_id;
  if not found then raise exception 'Versión no encontrada'; end if;

  if r.tabla = 'properties' then
    insert into public.properties select * from jsonb_populate_record(null::public.properties, r.datos)
    on conflict (id) do update set (tipo, operacion, estado, precio, precio_renta, comision_pct, direccion,
      m2_terreno, m2_construccion, recamaras, amenidades, link_fotos, cerrado_en, external_key, deleted_at)
      = (excluded.tipo, excluded.operacion, excluded.estado, excluded.precio, excluded.precio_renta,
         excluded.comision_pct, excluded.direccion, excluded.m2_terreno, excluded.m2_construccion,
         excluded.recamaras, excluded.amenidades, excluded.link_fotos, excluded.cerrado_en,
         excluded.external_key, excluded.deleted_at);
  elsif r.tabla = 'clients' then
    insert into public.clients select * from jsonb_populate_record(null::public.clients, r.datos)
    on conflict (id) do update set (nombre, telefono, interes, presupuesto_max, ubicacion_deseada, etapa,
      llamo, llamo_en, notas, external_key, deleted_at)
      = (excluded.nombre, excluded.telefono, excluded.interes, excluded.presupuesto_max,
         excluded.ubicacion_deseada, excluded.etapa, excluded.llamo, excluded.llamo_en, excluded.notas,
         excluded.external_key, excluded.deleted_at);
  elsif r.tabla = 'tasks' then
    insert into public.tasks select * from jsonb_populate_record(null::public.tasks, r.datos)
    on conflict (id) do update set (tipo, texto, fecha, hora, hecha, llamo, client_id, deleted_at)
      = (excluded.tipo, excluded.texto, excluded.fecha, excluded.hora, excluded.hecha, excluded.llamo,
         excluded.client_id, excluded.deleted_at);
  elsif r.tabla = 'settings' then
    update public.settings s set drive_url = x.drive_url, probabilidad_cierre = x.probabilidad_cierre
    from jsonb_populate_record(null::public.settings, r.datos) x where s.id = x.id;
  end if;
end;
$$;

revoke all on function public.restaurar_version(bigint) from public, anon;
grant execute on function public.restaurar_version(bigint) to authenticated;
