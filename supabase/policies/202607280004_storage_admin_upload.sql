begin;

drop policy if exists storage_publicaciones_insert_authorized
on storage.objects;

create policy storage_publicaciones_insert_authorized
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'publicaciones'
  and (
    coalesce((storage.foldername(name))[1], '') = (select auth.uid())::text
    or (select private.is_admin())
  )
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|jpeg|png)$'
  and (select private.current_user_role()) in (
    'administrador'::public.rol_usuario,
    'editor'::public.rol_usuario
  )
);

commit;
