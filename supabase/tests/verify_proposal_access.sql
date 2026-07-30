-- Verificación de privilegios de propuestas para ejecutar en SQL Editor.
-- Todas las columnas deben devolver true.

select
  not has_table_privilege(
    'anon',
    'public.propuestas',
    'SELECT,INSERT,UPDATE,DELETE'
  ) as anon_sin_acceso_directo,
  has_table_privilege(
    'authenticated',
    'public.propuestas',
    'SELECT,UPDATE,DELETE'
  ) as equipo_con_gestion,
  not has_table_privilege(
    'authenticated',
    'public.propuestas',
    'INSERT'
  ) as insercion_solo_edge_function,
  (
    select count(*) = 3
    from pg_policies
    where schemaname = 'public'
      and tablename = 'propuestas'
  ) as politicas_correctas,
  (
    select not public
      and file_size_limit = 5242880
      and allowed_mime_types = array['application/pdf']
    from storage.buckets
    where id = 'propuestas'
  ) as bucket_pdf_privado;
