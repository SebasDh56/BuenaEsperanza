-- Este archivo es inerte por defecto.
-- Para crear los borradores de demostración, copia el contenido al SQL Editor
-- y reemplaza null::uuid por el UUID de un perfil ya existente.

do $$
declare
  seed_user_id constant uuid := null::uuid;
begin
  if seed_user_id is null then
    raise notice 'Seed omitido: define seed_user_id antes de ejecutarlo.';
    return;
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = seed_user_id
  ) then
    raise exception 'El perfil indicado para el seed no existe.';
  end if;

  insert into public.publicaciones (
    tipo,
    titulo,
    slug,
    resumen,
    contenido,
    estado,
    creado_por
  )
  values
    (
      'noticia',
      'Borrador de demostración para una noticia comunitaria',
      'borrador-demostracion-noticia',
      'Contenido de prueba no publicado para verificar el flujo editorial.',
      'Este registro es un borrador de demostración. Debe reemplazarse con información real validada por la comunidad antes de publicarse.',
      'borrador',
      seed_user_id
    ),
    (
      'proyecto',
      'Borrador de demostración para un proyecto comunitario',
      'borrador-demostracion-proyecto',
      'Contenido de prueba no publicado para verificar la gestión de proyectos.',
      'Este registro es un borrador de demostración. Debe completarse con objetivos, responsables y datos reales antes de publicarse.',
      'borrador',
      seed_user_id
    )
  on conflict (slug) do nothing;
end
$$;
