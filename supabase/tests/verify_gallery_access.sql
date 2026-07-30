-- Verificación transaccional de acceso a galería.
-- Falla con una excepción ante cualquier permiso incorrecto y revierte todo.

begin;

create or replace function pg_temp.assert_gallery_count(
  actual bigint,
  expected bigint,
  check_name text
)
returns void
language plpgsql
as $$
begin
  if actual is distinct from expected then
    raise exception 'Gallery access check failed: % (expected %, received %)',
      check_name,
      expected,
      actual;
  end if;
end;
$$;

create or replace function pg_temp.assert_gallery_dml(
  command text,
  expected bigint,
  check_name text
)
returns void
language plpgsql
as $$
declare
  affected_rows bigint;
begin
  execute command;
  get diagnostics affected_rows = row_count;

  if affected_rows is distinct from expected then
    raise exception 'Gallery access check failed: % (expected %, received %)',
      check_name,
      expected,
      affected_rows;
  end if;
end;
$$;

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
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    'gallery-editor-one@example.test',
    '',
    now(),
    '{"nombre":"Gallery Editor One"}'::jsonb,
    now(),
    now()
  ),
  (
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    'gallery-editor-two@example.test',
    '',
    now(),
    '{"nombre":"Gallery Editor Two"}'::jsonb,
    now(),
    now()
  ),
  (
    'ffffffff-ffff-4fff-8fff-ffffffffffff',
    'gallery-administrator@example.test',
    '',
    now(),
    '{"nombre":"Gallery Administrator"}'::jsonb,
    now(),
    now()
  );

update public.profiles
set rol = 'administrador'
where id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';

insert into public.galeria_items (
  id,
  titulo,
  descripcion,
  imagen_url,
  imagen_path,
  imagen_alt,
  estado,
  orden,
  creado_por
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    'Fotografía publicada de verificación',
    'Descripción confirmada para verificar la lectura pública de galería.',
    'https://example.test/gallery/published.webp',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd/77777777-7777-4777-8777-777777777777.webp',
    'Fotografía publicada usada en la verificación',
    'publicado',
    10,
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'Fotografía borrador del primer editor',
    'Descripción confirmada para verificar el borrador del primer editor.',
    'https://example.test/gallery/editor-one-draft.webp',
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd/88888888-8888-4888-8888-888888888888.webp',
    'Fotografía en borrador usada en la verificación',
    'borrador',
    20,
    'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    'Fotografía borrador del segundo editor',
    'Descripción confirmada para verificar el aislamiento entre editores.',
    'https://example.test/gallery/editor-two-draft.webp',
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee/99999999-9999-4999-8999-999999999999.webp',
    'Fotografía ajena usada en la verificación',
    'borrador',
    30,
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
  );

set local role anon;

select pg_temp.assert_gallery_count(
  (
    select count(*)
    from public.galeria_items
    where id::text like '30000000-%'
  ),
  1,
  'anon reads only published rows'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  true
);
set local role authenticated;

select pg_temp.assert_gallery_count(
  (
    select count(*)
    from public.galeria_items
    where id::text like '30000000-%'
  ),
  2,
  'editor reads public and owned rows'
);

select pg_temp.assert_gallery_dml(
  $command$
    update public.galeria_items
    set titulo = 'Intento no autorizado'
    where id = '30000000-0000-4000-8000-000000000003'
  $command$,
  0,
  'editor cannot update another author'
);

select pg_temp.assert_gallery_dml(
  $command$
    delete from public.galeria_items
    where id = '30000000-0000-4000-8000-000000000003'
  $command$,
  0,
  'editor cannot delete another author'
);

select pg_temp.assert_gallery_dml(
  $command$
    update public.galeria_items
    set estado = 'publicado'
    where id = '30000000-0000-4000-8000-000000000002'
  $command$,
  1,
  'editor publishes an owned row directly'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  true
);
set local role authenticated;

select pg_temp.assert_gallery_count(
  (
    select count(*)
    from public.galeria_items
    where id::text like '30000000-%'
  ),
  3,
  'second editor reads public and owned rows'
);

reset role;
select set_config(
  'request.jwt.claim.sub',
  'ffffffff-ffff-4fff-8fff-ffffffffffff',
  true
);
set local role authenticated;

select pg_temp.assert_gallery_count(
  (
    select count(*)
    from public.galeria_items
    where id::text like '30000000-%'
  ),
  3,
  'administrator reads every row'
);

select pg_temp.assert_gallery_dml(
  $command$
    update public.galeria_items
    set titulo = 'Fotografía actualizada por administración'
    where id = '30000000-0000-4000-8000-000000000003'
  $command$,
  1,
  'administrator updates another author'
);

reset role;
set local role anon;

select pg_temp.assert_gallery_count(
  (
    select count(*)
    from public.galeria_items
    where id::text like '30000000-%'
  ),
  2,
  'anon sees both published rows after direct publishing'
);

reset role;

rollback;

select '9/9 controles de acceso de galería correctos' as resultado;
