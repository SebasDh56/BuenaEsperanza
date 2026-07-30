begin;

create table public.galeria_items (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descripcion text not null,
  imagen_url text not null,
  imagen_path text not null,
  imagen_alt text not null,
  fecha_toma date,
  credito text,
  estado public.estado_publicacion not null default 'borrador',
  orden integer not null default 0,
  creado_por uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint galeria_items_titulo_length
    check (char_length(btrim(titulo)) between 5 and 140),
  constraint galeria_items_descripcion_length
    check (char_length(btrim(descripcion)) between 20 and 1000),
  constraint galeria_items_imagen_url_format
    check (imagen_url ~ '^https://'),
  constraint galeria_items_imagen_path_format
    check (
      imagen_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpe?g|png|webp)$'
    ),
  constraint galeria_items_imagen_alt_length
    check (char_length(btrim(imagen_alt)) between 5 and 250),
  constraint galeria_items_fecha_toma_valid
    check (fecha_toma is null or fecha_toma <= current_date),
  constraint galeria_items_credito_length
    check (
      credito is null
      or char_length(btrim(credito)) between 2 and 160
    ),
  constraint galeria_items_orden_range
    check (orden between 0 and 9999)
);

comment on table public.galeria_items is
  'Fotografías comunitarias autorizadas y contextualizadas.';
comment on column public.galeria_items.orden is
  'Orden manual ascendente dentro de la galería pública.';
comment on column public.galeria_items.credito is
  'Autoría o procedencia del archivo cuando haya sido confirmada.';

create unique index galeria_items_imagen_path_key
  on public.galeria_items (imagen_path);

create index galeria_items_public_listing_idx
  on public.galeria_items (orden asc, fecha_toma desc nulls last, id desc)
  where estado = 'publicado';

create index galeria_items_author_updated_idx
  on public.galeria_items (creado_por, updated_at desc);

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
  new.imagen_alt := btrim(new.imagen_alt);
  new.credito := nullif(btrim(new.credito), '');
  new.updated_at := now();

  return new;
end;
$$;

revoke all on function private.prepare_gallery_item_row() from public;

create trigger prepare_gallery_item_before_write
before insert or update on public.galeria_items
for each row execute function private.prepare_gallery_item_row();

commit;
