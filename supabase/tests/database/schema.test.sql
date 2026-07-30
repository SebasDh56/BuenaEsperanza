begin;

create extension if not exists pgtap with schema extensions;

select plan(32);

select has_table(
  'public',
  'profiles',
  'Existe public.profiles.'
);

select has_table(
  'public',
  'publicaciones',
  'Existe public.publicaciones.'
);

select has_table(
  'public',
  'galeria_items',
  'Existe public.galeria_items.'
);

select is(
  (
    select string_agg(enum_value.enumlabel, ',' order by enum_value.enumsortorder)
    from pg_type as enum_type
    join pg_enum as enum_value on enum_value.enumtypid = enum_type.oid
    join pg_namespace as enum_schema on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'public'
      and enum_type.typname = 'rol_usuario'
  ),
  'administrador,editor',
  'Los roles permitidos son exactos.'
);

select is(
  (
    select string_agg(enum_value.enumlabel, ',' order by enum_value.enumsortorder)
    from pg_type as enum_type
    join pg_enum as enum_value on enum_value.enumtypid = enum_type.oid
    join pg_namespace as enum_schema on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'public'
      and enum_type.typname = 'tipo_publicacion'
  ),
  'noticia,proyecto',
  'Los tipos de publicación son exactos.'
);

select is(
  (
    select string_agg(enum_value.enumlabel, ',' order by enum_value.enumsortorder)
    from pg_type as enum_type
    join pg_enum as enum_value on enum_value.enumtypid = enum_type.oid
    join pg_namespace as enum_schema on enum_schema.oid = enum_type.typnamespace
    where enum_schema.nspname = 'public'
      and enum_type.typname = 'estado_publicacion'
  ),
  'borrador,publicado,archivado',
  'Los estados de publicación son exactos.'
);

select ok(
  (
    select table_class.relrowsecurity
    from pg_class as table_class
    join pg_namespace as table_schema on table_schema.oid = table_class.relnamespace
    where table_schema.nspname = 'public'
      and table_class.relname = 'profiles'
  ),
  'RLS está activo en profiles.'
);

select ok(
  (
    select table_class.relrowsecurity
    from pg_class as table_class
    join pg_namespace as table_schema on table_schema.oid = table_class.relnamespace
    where table_schema.nspname = 'public'
      and table_class.relname = 'publicaciones'
  ),
  'RLS está activo en publicaciones.'
);

select ok(
  (
    select table_class.relrowsecurity
    from pg_class as table_class
    join pg_namespace as table_schema on table_schema.oid = table_class.relnamespace
    where table_schema.nspname = 'public'
      and table_class.relname = 'galeria_items'
  ),
  'RLS está activo en galeria_items.'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'profiles_prepare_row'
      and not tgisinternal
  ),
  'Existe el trigger de profiles.'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'publicaciones_prepare_row'
      and not tgisinternal
  ),
  'Existe el trigger de publicaciones.'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'prepare_gallery_item_before_write'
      and not tgisinternal
  ),
  'Existe el trigger de galería.'
);

select ok(
  exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
      and not tgisinternal
  ),
  'Existe el trigger que crea perfiles desde Auth.'
);

select ok(
  exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as procedure_schema
      on procedure_schema.oid = procedure.pronamespace
    where procedure_schema.nspname = 'private'
      and procedure.proname = 'current_user_role'
      and procedure.prosecdef
  ),
  'current_user_role es una función security definer privada.'
);

select ok(
  exists (
    select 1
    from pg_proc as procedure
    join pg_namespace as procedure_schema
      on procedure_schema.oid = procedure.pronamespace
    where procedure_schema.nspname = 'private'
      and procedure.proname = 'is_admin'
      and procedure.prosecdef
  ),
  'is_admin es una función security definer privada.'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
  ),
  2::bigint,
  'Profiles tiene dos políticas explícitas.'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'publicaciones'
  ),
  5::bigint,
  'Publicaciones tiene cinco políticas explícitas.'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'public'
      and tablename = 'galeria_items'
  ),
  5::bigint,
  'Galería tiene cinco políticas explícitas.'
);

select ok(
  has_table_privilege('anon', 'public.publicaciones', 'SELECT')
  and not has_table_privilege('anon', 'public.publicaciones', 'INSERT')
  and not has_table_privilege('anon', 'public.publicaciones', 'UPDATE')
  and not has_table_privilege('anon', 'public.publicaciones', 'DELETE'),
  'Anon sólo tiene privilegio SELECT en publicaciones.'
);

select ok(
  has_table_privilege('authenticated', 'public.publicaciones', 'SELECT')
  and has_table_privilege('authenticated', 'public.publicaciones', 'INSERT')
  and has_table_privilege('authenticated', 'public.publicaciones', 'UPDATE')
  and has_table_privilege('authenticated', 'public.publicaciones', 'DELETE'),
  'Authenticated tiene los privilegios que después restringe RLS.'
);

select ok(
  has_table_privilege('anon', 'public.galeria_items', 'SELECT')
  and not has_table_privilege('anon', 'public.galeria_items', 'INSERT')
  and not has_table_privilege('anon', 'public.galeria_items', 'UPDATE')
  and not has_table_privilege('anon', 'public.galeria_items', 'DELETE'),
  'Anon sólo tiene privilegio SELECT en galería.'
);

select ok(
  has_table_privilege('authenticated', 'public.galeria_items', 'SELECT')
  and has_table_privilege('authenticated', 'public.galeria_items', 'INSERT')
  and has_table_privilege('authenticated', 'public.galeria_items', 'UPDATE')
  and has_table_privilege('authenticated', 'public.galeria_items', 'DELETE'),
  'Authenticated tiene privilegios de galería restringidos después por RLS.'
);

select ok(
  (
    select count(*) >= 4
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'publicaciones'
  ),
  'Publicaciones tiene índices para slug, imagen, autor y listados.'
);

select ok(
  (
    select count(*) >= 4
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'galeria_items'
  ),
  'Galería tiene índices para clave, imagen, autor y listado público.'
);

select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'publicaciones'
  ),
  'Existe el bucket publicaciones.'
);

select ok(
  exists (
    select 1
    from storage.buckets
    where id = 'galeria'
      and not public
      and file_size_limit = 5242880
  ),
  'Existe el bucket privado galeria con límite de 5 MB.'
);

select ok(
  (
    select not public
    from storage.buckets
    where id = 'publicaciones'
  ),
  'El bucket publicaciones es privado.'
);

select is(
  (
    select file_size_limit
    from storage.buckets
    where id = 'publicaciones'
  ),
  5242880::bigint,
  'Storage limita el archivo resultante a 5 MB.'
);

select is(
  (
    select array_to_string(allowed_mime_types, ',')
    from storage.buckets
    where id = 'publicaciones'
  ),
  'image/jpeg,image/png,image/webp',
  'Storage sólo admite JPEG, PNG y WebP.'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'storage_publicaciones_%'
  ),
  5::bigint,
  'Storage tiene cinco políticas específicas.'
);

select is(
  (
    select count(*)
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'storage_galeria_%'
  ),
  5::bigint,
  'Storage tiene cinco políticas específicas para galería.'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'storage_publicaciones_insert_authorized'
      and position('is_admin' in with_check) > 0
  ),
  'El administrador puede subir imágenes para publicaciones de otros autores.'
);

select * from finish();

rollback;
