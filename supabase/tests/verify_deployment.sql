-- Verificación de sólo lectura para ejecutar en Supabase SQL Editor.
-- Todas las filas deben mostrar resultado = true.

with checks (verificacion, resultado, detalle) as (
  values
    (
      'Tabla profiles',
      to_regclass('public.profiles') is not null,
      'Debe existir public.profiles.'
    ),
    (
      'Tabla publicaciones',
      to_regclass('public.publicaciones') is not null,
      'Debe existir public.publicaciones.'
    ),
    (
      'Tabla galeria_items',
      to_regclass('public.galeria_items') is not null,
      'Debe existir public.galeria_items.'
    ),
    (
      'Tabla propuestas',
      to_regclass('public.propuestas') is not null,
      'Debe existir public.propuestas.'
    ),
    (
      'RLS en profiles',
      coalesce(
        (
          select table_class.relrowsecurity
          from pg_class as table_class
          join pg_namespace as table_schema
            on table_schema.oid = table_class.relnamespace
          where table_schema.nspname = 'public'
            and table_class.relname = 'profiles'
        ),
        false
      ),
      'RLS debe estar habilitado.'
    ),
    (
      'RLS en publicaciones',
      coalesce(
        (
          select table_class.relrowsecurity
          from pg_class as table_class
          join pg_namespace as table_schema
            on table_schema.oid = table_class.relnamespace
          where table_schema.nspname = 'public'
            and table_class.relname = 'publicaciones'
        ),
        false
      ),
      'RLS debe estar habilitado.'
    ),
    (
      'RLS en galeria_items',
      coalesce(
        (
          select table_class.relrowsecurity
          from pg_class as table_class
          join pg_namespace as table_schema
            on table_schema.oid = table_class.relnamespace
          where table_schema.nspname = 'public'
            and table_class.relname = 'galeria_items'
        ),
        false
      ),
      'RLS debe estar habilitado.'
    ),
    (
      'RLS en propuestas',
      coalesce(
        (
          select table_class.relrowsecurity
          from pg_class as table_class
          join pg_namespace as table_schema
            on table_schema.oid = table_class.relnamespace
          where table_schema.nspname = 'public'
            and table_class.relname = 'propuestas'
        ),
        false
      ),
      'RLS debe estar habilitado.'
    ),
    (
      'Políticas de profiles',
      (
        select count(*) = 2
        from pg_policies
        where schemaname = 'public'
          and tablename = 'profiles'
      ),
      'Deben existir dos políticas.'
    ),
    (
      'Políticas de publicaciones',
      (
        select count(*) = 5
        from pg_policies
        where schemaname = 'public'
          and tablename = 'publicaciones'
      ),
      'Deben existir cinco políticas.'
    ),
    (
      'Políticas de galería',
      (
        select count(*) = 5
        from pg_policies
        where schemaname = 'public'
          and tablename = 'galeria_items'
      ),
      'Deben existir cinco políticas.'
    ),
    (
      'Políticas de propuestas',
      (
        select count(*) = 3
        from pg_policies
        where schemaname = 'public'
          and tablename = 'propuestas'
      ),
      'Deben existir tres políticas.'
    ),
    (
      'Anon sin escritura',
      not has_table_privilege('anon', 'public.publicaciones', 'INSERT')
      and not has_table_privilege('anon', 'public.publicaciones', 'UPDATE')
      and not has_table_privilege('anon', 'public.publicaciones', 'DELETE'),
      'Anon no debe escribir publicaciones.'
    ),
    (
      'Anon sin escritura en galería',
      not has_table_privilege('anon', 'public.galeria_items', 'INSERT')
      and not has_table_privilege('anon', 'public.galeria_items', 'UPDATE')
      and not has_table_privilege('anon', 'public.galeria_items', 'DELETE'),
      'Anon no debe escribir fotografías.'
    ),
    (
      'Anon sin acceso directo a propuestas',
      not has_table_privilege('anon', 'public.propuestas', 'SELECT')
      and not has_table_privilege('anon', 'public.propuestas', 'INSERT')
      and not has_table_privilege('anon', 'public.propuestas', 'UPDATE')
      and not has_table_privilege('anon', 'public.propuestas', 'DELETE'),
      'Anon sólo puede enviar mediante la Edge Function.'
    ),
    (
      'Trigger de perfiles',
      exists (
        select 1
        from pg_trigger
        where tgname = 'on_auth_user_created'
          and not tgisinternal
      ),
      'Las cuentas de Auth deben crear un perfil editor.'
    ),
    (
      'Bucket privado',
      coalesce(
        (
          select not public
          from storage.buckets
          where id = 'publicaciones'
        ),
        false
      ),
      'El bucket publicaciones debe existir y ser privado.'
    ),
    (
      'Bucket galería privado',
      coalesce(
        (
          select not public
            and file_size_limit = 5242880
          from storage.buckets
          where id = 'galeria'
        ),
        false
      ),
      'El bucket galeria debe existir, ser privado y limitar 5 MB.'
    ),
    (
      'Bucket propuestas privado',
      coalesce(
        (
          select not public
            and file_size_limit = 5242880
            and allowed_mime_types = array['application/pdf']
          from storage.buckets
          where id = 'propuestas'
        ),
        false
      ),
      'El bucket propuestas debe ser privado y aceptar sólo PDF de 5 MB.'
    ),
    (
      'Miniaturas de publicaciones',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'publicaciones'
          and column_name = 'imagen_miniatura_path'
      ),
      'Las publicaciones deben disponer de una ruta de miniatura.'
    ),
    (
      'Miniaturas de galería',
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'galeria_items'
          and column_name = 'imagen_miniatura_path'
      ),
      'La galería debe disponer de una ruta de miniatura.'
    ),
    (
      'Límite de Storage',
      coalesce(
        (
          select file_size_limit = 5242880
          from storage.buckets
          where id = 'publicaciones'
        ),
        false
      ),
      'El archivo procesado no debe superar 5 MB.'
    ),
    (
      'Tipos de Storage',
      coalesce(
        (
          select allowed_mime_types @> array[
            'image/jpeg',
            'image/png',
            'image/webp'
          ]
          and cardinality(allowed_mime_types) = 3
          from storage.buckets
          where id = 'publicaciones'
        ),
        false
      ),
      'Sólo se permiten JPEG, PNG y WebP.'
    ),
    (
      'Políticas de Storage',
      (
        select count(*) = 5
        from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname like 'storage_publicaciones_%'
      ),
      'Deben existir cinco políticas específicas.'
    ),
    (
      'Políticas de Storage para galería',
      (
        select count(*) = 5
        from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname like 'storage_galeria_%'
      ),
      'Deben existir cinco políticas específicas para galería.'
    ),
    (
      'Carga administrativa de imágenes',
      exists (
        select 1
        from pg_policies
        where schemaname = 'storage'
          and tablename = 'objects'
          and policyname = 'storage_publicaciones_insert_authorized'
          and position('is_admin' in with_check) > 0
      ),
      'El administrador debe poder subir imágenes para cualquier autor.'
    )
)
select
  verificacion,
  resultado,
  detalle
from checks
order by resultado, verificacion;
