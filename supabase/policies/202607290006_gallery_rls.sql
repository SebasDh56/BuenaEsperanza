begin;

alter table public.galeria_items enable row level security;

revoke all on table public.galeria_items from anon, authenticated;
grant select on table public.galeria_items to anon;
grant select, insert, update, delete on table public.galeria_items to authenticated;

drop policy if exists galeria_items_public_read on public.galeria_items;
create policy galeria_items_public_read
on public.galeria_items
for select
to anon
using (estado = 'publicado');

drop policy if exists galeria_items_authenticated_read on public.galeria_items;
create policy galeria_items_authenticated_read
on public.galeria_items
for select
to authenticated
using (
  estado = 'publicado'
  or creado_por = (select auth.uid())
  or (select private.is_admin())
);

drop policy if exists galeria_items_authorized_insert on public.galeria_items;
create policy galeria_items_authorized_insert
on public.galeria_items
for insert
to authenticated
with check (
  (
    creado_por = (select auth.uid())
    and (select private.current_user_role()) in ('administrador', 'editor')
  )
  or (select private.is_admin())
);

drop policy if exists galeria_items_owner_or_admin_update on public.galeria_items;
create policy galeria_items_owner_or_admin_update
on public.galeria_items
for update
to authenticated
using (
  creado_por = (select auth.uid())
  or (select private.is_admin())
)
with check (
  creado_por = (select auth.uid())
  or (select private.is_admin())
);

drop policy if exists galeria_items_owner_or_admin_delete on public.galeria_items;
create policy galeria_items_owner_or_admin_delete
on public.galeria_items
for delete
to authenticated
using (
  creado_por = (select auth.uid())
  or (select private.is_admin())
);

commit;
