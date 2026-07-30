begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'galeria',
  'galeria',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists storage_galeria_public_read on storage.objects;
create policy storage_galeria_public_read
on storage.objects
for select
to anon
using (
  bucket_id = 'galeria'
  and (storage.foldername(name))[1] ~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1
    from public.galeria_items
    where galeria_items.imagen_path = storage.objects.name
      and galeria_items.estado = 'publicado'
  )
);

drop policy if exists storage_galeria_authenticated_read on storage.objects;
create policy storage_galeria_authenticated_read
on storage.objects
for select
to authenticated
using (
  bucket_id = 'galeria'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_admin())
    or exists (
      select 1
      from public.galeria_items
      where galeria_items.imagen_path = storage.objects.name
        and galeria_items.estado = 'publicado'
    )
  )
);

drop policy if exists storage_galeria_authorized_insert on storage.objects;
create policy storage_galeria_authorized_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'galeria'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and (
    (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and (select private.current_user_role()) in ('administrador', 'editor')
    )
    or (select private.is_admin())
  )
);

drop policy if exists storage_galeria_owner_or_admin_update on storage.objects;
create policy storage_galeria_owner_or_admin_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'galeria'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_admin())
  )
)
with check (
  bucket_id = 'galeria'
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_admin())
  )
);

drop policy if exists storage_galeria_owner_or_admin_delete on storage.objects;
create policy storage_galeria_owner_or_admin_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'galeria'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select private.is_admin())
  )
);

commit;
