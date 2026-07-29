begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'publicaciones',
  'publicaciones',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy storage_publicaciones_select_public
on storage.objects
for select
to anon
using (
  bucket_id = 'publicaciones'
  and storage.allow_any_operation(
    array['object.get_authenticated_info', 'object.get_authenticated']
  )
  and exists (
    select 1
    from public.publicaciones as publication
    where publication.imagen_path = storage.objects.name
      and publication.estado = 'publicado'::public.estado_publicacion
      and publication.fecha_publicacion <= now()
  )
);

create policy storage_publicaciones_select_authorized
on storage.objects
for select
to authenticated
using (
  bucket_id = 'publicaciones'
  and (
    coalesce((storage.foldername(name))[1], '') = (select auth.uid())::text
    or (select private.is_admin())
    or exists (
      select 1
      from public.publicaciones as publication
      where publication.imagen_path = storage.objects.name
        and publication.estado = 'publicado'::public.estado_publicacion
        and publication.fecha_publicacion <= now()
    )
  )
);

create policy storage_publicaciones_insert_authorized
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'publicaciones'
  and coalesce((storage.foldername(name))[1], '') = (select auth.uid())::text
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|jpeg|png)$'
  and (select private.current_user_role()) in (
    'administrador'::public.rol_usuario,
    'editor'::public.rol_usuario
  )
);

create policy storage_publicaciones_update_authorized
on storage.objects
for update
to authenticated
using (
  bucket_id = 'publicaciones'
  and (
    coalesce((storage.foldername(name))[1], '') = (select auth.uid())::text
    or (select private.is_admin())
  )
)
with check (
  bucket_id = 'publicaciones'
  and (
    coalesce((storage.foldername(name))[1], '') = (select auth.uid())::text
    or (select private.is_admin())
  )
);

create policy storage_publicaciones_delete_authorized
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'publicaciones'
  and (
    coalesce((storage.foldername(name))[1], '') = (select auth.uid())::text
    or (select private.is_admin())
  )
);

commit;
