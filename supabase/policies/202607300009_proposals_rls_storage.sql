begin;

alter table public.propuestas enable row level security;

revoke all on table public.propuestas from anon, authenticated;
grant select, update, delete on table public.propuestas to authenticated;

create policy propuestas_select_authorized
on public.propuestas
for select
to authenticated
using (
  (select private.current_user_role()) in (
    'administrador'::public.rol_usuario,
    'editor'::public.rol_usuario
  )
);

create policy propuestas_update_authorized
on public.propuestas
for update
to authenticated
using (
  (select private.current_user_role()) in (
    'administrador'::public.rol_usuario,
    'editor'::public.rol_usuario
  )
)
with check (
  (select private.current_user_role()) in (
    'administrador'::public.rol_usuario,
    'editor'::public.rol_usuario
  )
);

create policy propuestas_delete_admin
on public.propuestas
for delete
to authenticated
using ((select private.is_admin()));

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'propuestas',
  'propuestas',
  false,
  5242880,
  array['application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy storage_propuestas_authorized_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'propuestas'
  and (select private.current_user_role()) in (
    'administrador'::public.rol_usuario,
    'editor'::public.rol_usuario
  )
  and exists (
    select 1
    from public.propuestas
    where propuestas.archivo_path = storage.objects.name
  )
);

create policy storage_propuestas_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'propuestas'
  and (select private.is_admin())
);

commit;
