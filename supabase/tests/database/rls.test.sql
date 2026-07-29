begin;

create extension if not exists pgtap with schema extensions;

insert into auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'editor-uno@example.test',
    '',
    now(),
    '{"nombre":"Editor Uno"}'::jsonb,
    now(),
    now()
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'editor-dos@example.test',
    '',
    now(),
    '{"nombre":"Editor Dos"}'::jsonb,
    now(),
    now()
  ),
  (
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    'administrador@example.test',
    '',
    now(),
    '{"nombre":"Administrador"}'::jsonb,
    now(),
    now()
  );

update public.profiles
set rol = 'administrador'
where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

insert into public.publicaciones (
  id,
  tipo,
  titulo,
  slug,
  resumen,
  contenido,
  imagen_url,
  imagen_path,
  imagen_alt,
  estado,
  fecha_publicacion,
  creado_por
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'noticia',
    'Borrador perteneciente al editor uno',
    'prueba-editor-uno-borrador',
    'Resumen suficientemente extenso para probar el borrador del editor uno.',
    'Contenido suficientemente extenso para probar el acceso al borrador que pertenece al primer editor de la prueba.',
    null,
    null,
    null,
    'borrador',
    null,
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'noticia',
    'Publicación vigente perteneciente al editor uno',
    'prueba-editor-uno-publicada',
    'Resumen suficientemente extenso para probar una publicación que ya está vigente.',
    'Contenido suficientemente extenso para probar la lectura pública de una noticia vigente creada por el primer editor.',
    'https://example.test/storage/editor-uno-publicada.webp',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/11111111-1111-4111-8111-111111111111.webp',
    'Imagen de prueba de la publicación vigente',
    'publicado',
    now() - interval '1 minute',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'proyecto',
    'Publicación programada perteneciente al editor uno',
    'prueba-editor-uno-programada',
    'Resumen suficientemente extenso para probar una publicación futura programada.',
    'Contenido suficientemente extenso para comprobar que una publicación programada todavía no sea visible para visitantes.',
    'https://example.test/storage/editor-uno-programada.webp',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/22222222-2222-4222-8222-222222222222.webp',
    'Imagen de prueba de la publicación programada',
    'publicado',
    now() + interval '1 day',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'proyecto',
    'Borrador perteneciente al editor dos',
    'prueba-editor-dos-borrador',
    'Resumen suficientemente extenso para probar el borrador del segundo editor.',
    'Contenido suficientemente extenso para probar el aislamiento de un borrador perteneciente al segundo editor de la prueba.',
    null,
    null,
    null,
    'borrador',
    null,
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
  );

select plan(15);

select is(
  (select count(*) from public.profiles),
  3::bigint,
  'El trigger de Auth creó los tres perfiles.'
);

select is(
  (
    select count(*)
    from public.profiles
    where rol = 'editor'
  ),
  2::bigint,
  'Las cuentas nuevas reciben el rol editor por defecto.'
);

set local role anon;

select is(
  (select count(*) from public.publicaciones),
  1::bigint,
  'Anon sólo ve publicaciones vigentes.'
);

select is(
  (
    select count(*)
    from public.publicaciones
    where slug = 'prueba-editor-uno-programada'
  ),
  0::bigint,
  'Anon no ve una publicación programada para el futuro.'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.publicaciones),
  3::bigint,
  'El editor uno ve sus tres registros.'
);

select is(
  (
    with changed as (
      update public.publicaciones
      set titulo = 'Intento no autorizado'
      where id = '10000000-0000-4000-8000-000000000004'
      returning id
    )
    select count(*) from changed
  ),
  0::bigint,
  'Un editor no modifica publicaciones ajenas.'
);

select is(
  (
    with removed as (
      delete from public.publicaciones
      where id = '10000000-0000-4000-8000-000000000004'
      returning id
    )
    select count(*) from removed
  ),
  0::bigint,
  'Un editor no elimina publicaciones ajenas.'
);

select throws_ok(
  $statement$
    update public.profiles
    set rol = 'administrador'
    where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $statement$,
  '42501',
  'Sólo un administrador puede cambiar roles.',
  'Un editor no puede ascender su propio rol.'
);

select throws_ok(
  $statement$
    insert into public.publicaciones (
      tipo,
      titulo,
      slug,
      resumen,
      contenido,
      estado,
      creado_por
    )
    values (
      'noticia',
      'Intento de autoría perteneciente a otra cuenta',
      'intento-autoria-ajena',
      'Resumen suficientemente extenso para intentar una autoría ajena.',
      'Contenido suficientemente extenso para intentar insertar una publicación atribuida a otra cuenta.',
      'borrador',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    )
  $statement$,
  '42501',
  null,
  'Un editor no crea publicaciones a nombre de otro usuario.'
);

select is(
  (
    with published as (
      update public.publicaciones
      set
        imagen_url = 'https://example.test/storage/editor-uno-borrador.webp',
        imagen_path = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/33333333-3333-4333-8333-333333333333.webp',
        imagen_alt = 'Imagen de prueba para publicación directa',
        estado = 'publicado',
        fecha_publicacion = null
      where id = '10000000-0000-4000-8000-000000000001'
      returning fecha_publicacion
    )
    select count(*)
    from published
    where fecha_publicacion is not null
  ),
  1::bigint,
  'El editor puede publicar directamente y recibe una fecha inmediata.'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.publicaciones),
  3::bigint,
  'El editor dos ve su borrador y las dos publicaciones vigentes.'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.publicaciones),
  4::bigint,
  'El administrador ve todas las publicaciones.'
);

select is(
  (
    with changed as (
      update public.publicaciones
      set titulo = 'Publicación editada por el administrador'
      where id = '10000000-0000-4000-8000-000000000004'
      returning id
    )
    select count(*) from changed
  ),
  1::bigint,
  'El administrador puede editar publicaciones ajenas.'
);

select is(
  (
    with removed as (
      delete from public.publicaciones
      where id = '10000000-0000-4000-8000-000000000004'
      returning id
    )
    select count(*) from removed
  ),
  1::bigint,
  'El administrador puede eliminar publicaciones ajenas.'
);

reset role;
set local role anon;

select is(
  (select count(*) from public.publicaciones),
  2::bigint,
  'Anon ve las dos publicaciones inmediatas después del cambio.'
);

select * from finish();

rollback;
