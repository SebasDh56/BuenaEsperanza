begin;

alter table public.profiles enable row level security;
alter table public.publicaciones enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.publicaciones from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select on table public.publicaciones to anon;
grant select, insert, update, delete
  on table public.publicaciones
  to authenticated;

create policy profiles_select_authorized
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = id
  or (select private.is_admin())
);

create policy profiles_update_authorized
on public.profiles
for update
to authenticated
using (
  (select auth.uid()) = id
  or (select private.is_admin())
)
with check (
  (select auth.uid()) = id
  or (select private.is_admin())
);

create policy publicaciones_select_public
on public.publicaciones
for select
to anon
using (
  estado = 'publicado'::public.estado_publicacion
  and fecha_publicacion <= now()
);

create policy publicaciones_select_authorized
on public.publicaciones
for select
to authenticated
using (
  (
    estado = 'publicado'::public.estado_publicacion
    and fecha_publicacion <= now()
  )
  or creado_por = (select auth.uid())
  or (select private.is_admin())
);

create policy publicaciones_insert_authorized
on public.publicaciones
for insert
to authenticated
with check (
  (
    creado_por = (select auth.uid())
    and (select private.current_user_role()) in (
      'administrador'::public.rol_usuario,
      'editor'::public.rol_usuario
    )
  )
  or (select private.is_admin())
);

create policy publicaciones_update_authorized
on public.publicaciones
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

create policy publicaciones_delete_authorized
on public.publicaciones
for delete
to authenticated
using (
  creado_por = (select auth.uid())
  or (select private.is_admin())
);

commit;
