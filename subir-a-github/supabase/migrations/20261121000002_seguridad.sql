-- =====================================================================
-- Gladys en el Valle — seguridad (Row Level Security) y Realtime
-- Cada fila solo es visible y editable por su dueña: user_id = auth.uid().
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array['properties','clients','tasks','settings'] loop
    execute format('alter table public.%I enable row level security', t);

    -- Los visitantes sin sesión (rol anon) no tienen ningún permiso.
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    execute format('drop policy if exists "%1$s_select_propias" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_insert_propias" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_update_propias" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_delete_propias" on public.%1$s', t);

    execute format('create policy "%1$s_select_propias" on public.%1$s for select to authenticated
                    using (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s_insert_propias" on public.%1$s for insert to authenticated
                    with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s_update_propias" on public.%1$s for update to authenticated
                    using (user_id = (select auth.uid()))
                    with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s_delete_propias" on public.%1$s for delete to authenticated
                    using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- Realtime (sincronización entre dispositivos). Realtime respeta RLS.
do $$
declare t text;
begin
  foreach t in array array['properties','clients','tasks','settings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- ping(): consulta mínima usada por el workflow "mantener activo" para
-- que el plan gratuito no se pause. No lee ni devuelve datos.
-- ---------------------------------------------------------------------
create or replace function public.ping()
returns integer
language sql
stable
set search_path = public
as $$ select 1 $$;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
