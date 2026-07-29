begin;

create schema if not exists private;

comment on schema private is
  'Funciones internas no expuestas por la API de datos.';

create type public.rol_usuario as enum (
  'administrador',
  'editor'
);

create type public.tipo_publicacion as enum (
  'noticia',
  'proyecto'
);

create type public.estado_publicacion as enum (
  'borrador',
  'publicado',
  'archivado'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text,
  rol public.rol_usuario not null default 'editor',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_nombre_valido check (
    nombre is null
    or char_length(btrim(nombre)) between 2 and 100
  )
);

comment on table public.profiles is
  'Perfil y rol autorizado de cada cuenta creada en Supabase Auth.';
comment on column public.profiles.rol is
  'El rol se administra en la base de datos, nunca desde user_metadata.';

create table public.publicaciones (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_publicacion not null,
  titulo text not null,
  slug text not null,
  resumen text not null,
  contenido text not null,
  imagen_url text,
  imagen_path text,
  imagen_alt text,
  estado public.estado_publicacion not null default 'borrador',
  fecha_publicacion timestamptz,
  creado_por uuid not null references public.profiles (id)
    on update restrict
    on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint publicaciones_titulo_valido check (
    char_length(btrim(titulo)) between 5 and 180
  ),
  constraint publicaciones_slug_unico unique (slug),
  constraint publicaciones_slug_valido check (
    char_length(slug) between 3 and 180
    and slug = lower(slug)
    and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint publicaciones_resumen_valido check (
    char_length(btrim(resumen)) between 20 and 500
  ),
  constraint publicaciones_contenido_valido check (
    char_length(btrim(contenido)) between 50 and 50000
  ),
  constraint publicaciones_imagen_completa check (
    num_nonnulls(imagen_url, imagen_path, imagen_alt) = 0
    or (
      num_nonnulls(imagen_url, imagen_path, imagen_alt) = 3
      and char_length(imagen_url) between 10 and 2048
      and char_length(imagen_path) between 40 and 512
      and char_length(imagen_alt) between 5 and 250
    )
  ),
  constraint publicaciones_imagen_publicada check (
    estado <> 'publicado'
    or num_nonnulls(imagen_url, imagen_path, imagen_alt) = 3
  ),
  constraint publicaciones_imagen_url_segura check (
    imagen_url is null
    or imagen_url ~ '^https://[^[:space:]]+$'
  ),
  constraint publicaciones_imagen_path_segura check (
    imagen_path is null
    or (
      imagen_path = lower(imagen_path)
      and split_part(imagen_path, '/', 1) = creado_por::text
      and imagen_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(webp|jpg|jpeg|png)$'
    )
  ),
  constraint publicaciones_publicacion_con_fecha check (
    estado <> 'publicado'
    or fecha_publicacion is not null
  )
);

comment on table public.publicaciones is
  'Noticias y proyectos administrados por la comunidad.';
comment on column public.publicaciones.contenido is
  'Texto editorial sin HTML arbitrario; el frontend lo renderiza con nodos seguros.';
comment on column public.publicaciones.fecha_publicacion is
  'Fecha efectiva. Una fecha futura mantiene oculta una publicación programada.';
comment on column public.publicaciones.imagen_path is
  'Ruta privada en Storage con formato <creado_por>/<uuid>.<extension>.';

create unique index publicaciones_imagen_path_unico
  on public.publicaciones (imagen_path)
  where imagen_path is not null;

create index publicaciones_publicas_idx
  on public.publicaciones (tipo, fecha_publicacion desc)
  where estado = 'publicado';

create index publicaciones_autor_actualizacion_idx
  on public.publicaciones (creado_por, updated_at desc);

create index publicaciones_gestion_idx
  on public.publicaciones (estado, tipo, updated_at desc);

create function private.current_user_role()
returns public.rol_usuario
language sql
stable
security definer
set search_path = ''
as $$
  select profile.rol
  from public.profiles as profile
  where profile.id = (select auth.uid())
$$;

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select profile.rol = 'administrador'::public.rol_usuario
      from public.profiles as profile
      where profile.id = (select auth.uid())
    ),
    false
  )
$$;

create function private.prepare_profile_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception 'El identificador del perfil no se puede modificar.'
        using errcode = '42501';
    end if;

    if new.created_at is distinct from old.created_at then
      raise exception 'La fecha de creación del perfil no se puede modificar.'
        using errcode = '42501';
    end if;

    if (
      new.rol is distinct from old.rol
      and (select auth.uid()) is not null
      and not (select private.is_admin())
    ) then
      raise exception 'Sólo un administrador puede cambiar roles.'
        using errcode = '42501';
    end if;
  end if;

  new.nombre := nullif(btrim(new.nombre), '');
  new.updated_at := now();

  return new;
end
$$;

create function private.prepare_publication_row()
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
  new.imagen_alt := nullif(btrim(new.imagen_alt), '');

  if new.estado = 'publicado' and new.fecha_publicacion is null then
    new.fecha_publicacion := now();
  end if;

  new.updated_at := now();

  return new;
end
$$;

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text := nullif(btrim(new.raw_user_meta_data ->> 'nombre'), '');
begin
  if requested_name is not null
    and char_length(requested_name) not between 2 and 100
  then
    requested_name := null;
  end if;

  insert into public.profiles (id, nombre, rol)
  values (new.id, requested_name, 'editor'::public.rol_usuario);

  return new;
end
$$;

create trigger profiles_prepare_row
before insert or update on public.profiles
for each row execute function private.prepare_profile_row();

create trigger publicaciones_prepare_row
before insert or update on public.publicaciones
for each row execute function private.prepare_publication_row();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

insert into public.profiles (id, nombre, rol)
select
  auth_user.id,
  case
    when char_length(btrim(auth_user.raw_user_meta_data ->> 'nombre'))
      between 2 and 100
    then btrim(auth_user.raw_user_meta_data ->> 'nombre')
    else null
  end,
  'editor'::public.rol_usuario
from auth.users as auth_user
on conflict (id) do nothing;

revoke all on schema private from public;
revoke all on function private.current_user_role() from public;
revoke all on function private.is_admin() from public;
revoke all on function private.prepare_profile_row() from public;
revoke all on function private.prepare_publication_row() from public;
revoke all on function private.handle_new_user() from public;

grant usage on schema private to authenticated;
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.is_admin() to authenticated;

commit;
