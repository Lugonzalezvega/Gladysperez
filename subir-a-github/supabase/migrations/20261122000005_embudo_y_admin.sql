-- =====================================================================
-- Gladys en el Valle — indicadores del embudo de leads
-- Por cada cliente (lead) se guarda de qué propiedad y de qué red vino,
-- y si respondió, agendó, asistió a la visita, sigue en seguimiento y
-- si hizo una oferta (aunque sea verbal), con la fecha de cada paso.
-- =====================================================================

alter table public.clients
  add column if not exists propiedad_interes text not null default ''
    check (char_length(propiedad_interes) <= 300),
  add column if not exists fuente text not null default ''
    check (char_length(fuente) <= 300),
  add column if not exists fecha_lead date,
  add column if not exists respondio text check (respondio is null or respondio in ('si','no')),
  add column if not exists respondio_en timestamptz,
  add column if not exists agendo text check (agendo is null or agendo in ('si','no')),
  add column if not exists agendo_en timestamptz,
  add column if not exists asistio text check (asistio is null or asistio in ('si','no')),
  add column if not exists asistio_en timestamptz,
  add column if not exists seguimiento text check (seguimiento is null or seguimiento in ('si','no')),
  add column if not exists seguimiento_en timestamptz,
  add column if not exists oferta text check (oferta is null or oferta in ('verbal','escrita','no')),
  add column if not exists oferta_en timestamptz,
  add column if not exists oferta_monto numeric(14,2) check (oferta_monto is null or oferta_monto >= 0);

-- Los leads que ya se importaron guardaron propiedad, fuente y fecha en las
-- notas: se copian a las columnas nuevas (la importación los mantiene al día).
update public.clients
set propiedad_interes = coalesce(nullif(propiedad_interes, ''), trim(substring(notas from 'Propiedad: ([^\n]+)')), ''),
    fuente            = coalesce(nullif(fuente, ''), trim(substring(notas from 'Fuente: ([^\n]+)')), ''),
    fecha_lead        = coalesce(fecha_lead,
                          case when substring(notas from 'Fecha del lead: (\d{1,2}/\d{1,2}/\d{4})') is not null
                               then to_date(substring(notas from 'Fecha del lead: (\d{1,2}/\d{1,2}/\d{4})'), 'DD/MM/YYYY')
                          end)
where notas like '%Propiedad: %' or notas like '%Fuente: %' or notas like '%Fecha del lead: %';

create index if not exists clients_user_fecha_lead_idx on public.clients (user_id, fecha_lead);

-- =====================================================================
-- Administradora de la app
-- Solo quien tenga rol 'admin' ve la pestaña Ajustes (enlace de Drive,
-- importación, probabilidad de cierre, descargas). Gladys y las demás
-- colaboradoras usan todo lo demás.
-- =====================================================================

alter table public.miembros
  add column if not exists rol text not null default 'colaboradora'
    check (rol in ('colaboradora', 'admin'));

create or replace function public.soy_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.miembros where member_id = auth.uid() and rol = 'admin')
$$;

revoke all on function public.soy_admin() from public, anon;
grant execute on function public.soy_admin() to authenticated;
