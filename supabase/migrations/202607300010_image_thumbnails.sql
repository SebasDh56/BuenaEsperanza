begin;

alter table public.publicaciones
  add column imagen_miniatura_url text,
  add column imagen_miniatura_path text;

alter table public.publicaciones
  add constraint publicaciones_miniatura_completa check (
    num_nonnulls(imagen_miniatura_url, imagen_miniatura_path) = 0
    or (
      num_nonnulls(imagen_miniatura_url, imagen_miniatura_path) = 2
      and imagen_miniatura_url ~ '^https://[^[:space:]]+$'
      and imagen_miniatura_path = lower(imagen_miniatura_path)
      and split_part(imagen_miniatura_path, '/', 1) = creado_por::text
      and imagen_miniatura_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    )
  ),
  add constraint publicaciones_imagen_con_miniatura check (
    estado <> 'publicado'::public.estado_publicacion
    or imagen_path is null
    or num_nonnulls(imagen_miniatura_url, imagen_miniatura_path) = 2
  );

create unique index publicaciones_imagen_miniatura_path_unico
  on public.publicaciones (imagen_miniatura_path)
  where imagen_miniatura_path is not null;

alter table public.galeria_items
  add column imagen_miniatura_url text,
  add column imagen_miniatura_path text;

alter table public.galeria_items
  alter column imagen_miniatura_url set not null,
  alter column imagen_miniatura_path set not null,
  add constraint galeria_items_miniatura_url_format
    check (imagen_miniatura_url ~ '^https://'),
  add constraint galeria_items_miniatura_path_format
    check (
      imagen_miniatura_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp$'
    );

create unique index galeria_items_imagen_miniatura_path_key
  on public.galeria_items (imagen_miniatura_path);

create or replace function private.prepare_publication_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'El identificador de la publicación no se puede modificar.'
        using errcode = '42501';
    end if;

    if new.created_at is distinct from old.created_at then
      raise exception 'La fecha de creación no se puede modificar.'
        using errcode = '42501';
    end if;

    if (
      new.creado_por is distinct from old.creado_por
      and (select auth.uid()) is not null
      and not (select private.is_admin())
    ) then
      raise exception 'Sólo un administrador puede reasignar una publicación.'
        using errcode = '42501';
    end if;
  end if;

  new.titulo := btrim(new.titulo);
  new.slug := lower(btrim(new.slug));
  new.resumen := btrim(new.resumen);
  new.contenido := btrim(new.contenido);
  new.imagen_url := nullif(btrim(new.imagen_url), '');
  new.imagen_path := nullif(lower(btrim(new.imagen_path)), '');
  new.imagen_miniatura_url := nullif(btrim(new.imagen_miniatura_url), '');
  new.imagen_miniatura_path := nullif(lower(btrim(new.imagen_miniatura_path)), '');
  new.imagen_alt := nullif(btrim(new.imagen_alt), '');

  if new.estado = 'publicado' and new.fecha_publicacion is null then
    new.fecha_publicacion := now();
  end if;

  new.updated_at := now();
  return new;
end
$$;

create or replace function private.prepare_gallery_item_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.id := old.id;
    new.created_at := old.created_at;

    if new.creado_por is distinct from old.creado_por
      and not (select private.is_admin())
    then
      raise exception 'Only an administrator can change gallery authorship'
        using errcode = '42501';
    end if;
  end if;

  new.titulo := btrim(new.titulo);
  new.descripcion := btrim(new.descripcion);
  new.imagen_url := btrim(new.imagen_url);
  new.imagen_path := lower(btrim(new.imagen_path));
  new.imagen_miniatura_url := btrim(new.imagen_miniatura_url);
  new.imagen_miniatura_path := lower(btrim(new.imagen_miniatura_path));
  new.imagen_alt := btrim(new.imagen_alt);
  new.credito := nullif(btrim(new.credito), '');
  new.updated_at := now();
  return new;
end;
$$;

drop policy if exists storage_publicaciones_select_public on storage.objects;
create policy storage_publicaciones_select_public
on storage.objects
for select
to anon
using (
  bucket_id = 'publicaciones'
  and exists (
    select 1
    from public.publicaciones as publication
    where storage.objects.name in (
      publication.imagen_path,
      publication.imagen_miniatura_path
    )
      and publication.estado = 'publicado'::public.estado_publicacion
      and publication.fecha_publicacion <= now()
  )
);

drop policy if exists storage_publicaciones_select_authorized on storage.objects;
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
      where storage.objects.name in (
        publication.imagen_path,
        publication.imagen_miniatura_path
      )
        and publication.estado = 'publicado'::public.estado_publicacion
        and publication.fecha_publicacion <= now()
    )
  )
);

drop policy if exists storage_galeria_public_read on storage.objects;
create policy storage_galeria_public_read
on storage.objects
for select
to anon
using (
  bucket_id = 'galeria'
  and exists (
    select 1
    from public.galeria_items
    where storage.objects.name in (
      galeria_items.imagen_path,
      galeria_items.imagen_miniatura_path
    )
      and galeria_items.estado = 'publicado'
  )
);

commit;
