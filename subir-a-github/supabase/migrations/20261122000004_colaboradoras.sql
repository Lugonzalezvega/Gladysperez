-- =====================================================================
-- Gladys en el Valle — colaboradoras con usuario propio
-- Cada colaboradora entra con su propio correo y contraseña, pero ve y
-- edita los mismos datos que la dueña de la cuenta (Gladys).
-- Para quitarle el acceso basta con borrar su fila de "miembros" o su
-- usuario en Authentication → Users.
-- =====================================================================

create table if not exists public.miembros (
  member_id   uuid primary key references auth.users(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint miembros_no_a_si_misma check (member_id <> owner_id)
);

-- Nadie la lee ni la edita desde la app: solo se administra en el SQL Editor.
alter table public.miembros enable row level security;
revoke all on public.miembros from anon, authenticated;

-- De qué cuenta son los datos de quien está conectada:
-- la de su dueña si es colaboradora, o la propia en cualquier otro caso.
create or replace function public.mi_cuenta()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select owner_id from public.miembros where member_id = auth.uid()),
    auth.uid()
  )
$$;

revoke all on function public.mi_cuenta() from public, anon;
grant execute on function public.mi_cuenta() to authenticated;

-- Las filas nuevas pertenecen a la cuenta dueña, y las políticas permiten
-- ver y editar solo las filas de esa cuenta.
do $$
declare t text;
begin
  foreach t in array array['properties','clients','tasks','settings'] loop
    execute format('alter table public.%I alter column user_id set default public.mi_cuenta()', t);

    execute format('drop policy if exists "%1$s_select_propias" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_insert_propias" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_update_propias" on public.%1$s', t);
    execute format('drop policy if exists "%1$s_delete_propias" on public.%1$s', t);

    execute format('create policy "%1$s_select_propias" on public.%1$s for select to authenticated
                    using (user_id = (select public.mi_cuenta()))', t);
    execute format('create policy "%1$s_insert_propias" on public.%1$s for insert to authenticated
                    with check (user_id = (select public.mi_cuenta()))', t);
    execute format('create policy "%1$s_update_propias" on public.%1$s for update to authenticated
                    using (user_id = (select public.mi_cuenta()))
                    with check (user_id = (select public.mi_cuenta()))', t);
    execute format('create policy "%1$s_delete_propias" on public.%1$s for delete to authenticated
                    using (user_id = (select public.mi_cuenta()))', t);
  end loop;
end $$;

drop policy if exists "historial_select_propio" on public.historial;
create policy "historial_select_propio" on public.historial for select to authenticated
  using (user_id = (select public.mi_cuenta()));
