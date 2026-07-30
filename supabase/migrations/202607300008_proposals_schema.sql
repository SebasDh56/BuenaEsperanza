begin;

create type public.tipo_propuesta as enum (
  'pasantia',
  'tesis',
  'investigacion',
  'proyecto_comunitario',
  'apoyo_institucional',
  'otro'
);

create type public.estado_propuesta as enum (
  'nueva',
  'en_revision',
  'contactada',
  'aceptada',
  'cerrada'
);

create table public.propuestas (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_propuesta not null,
  nombre_responsable text not null,
  organizacion text,
  email text not null,
  telefono text,
  titulo text not null,
  duracion_estimada text,
  descripcion text,
  archivo_path text,
  archivo_nombre text,
  archivo_tamano bigint,
  archivo_tipo text,
  estado public.estado_propuesta not null default 'nueva',
  notas_internas text,
  retention_until timestamptz not null default (now() + interval '12 months'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint propuestas_nombre_responsable_valido check (
    char_length(btrim(nombre_responsable)) between 2 and 120
  ),
  constraint propuestas_organizacion_valida check (
    organizacion is null
    or char_length(btrim(organizacion)) between 2 and 180
  ),
  constraint propuestas_email_valido check (
    char_length(email) between 5 and 254
    and email = lower(email)
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  constraint propuestas_telefono_valido check (
    telefono is null
    or char_length(btrim(telefono)) between 7 and 30
  ),
  constraint propuestas_titulo_valido check (
    char_length(btrim(titulo)) between 5 and 180
  ),
  constraint propuestas_duracion_valida check (
    duracion_estimada is null
    or char_length(btrim(duracion_estimada)) between 2 and 120
  ),
  constraint propuestas_descripcion_valida check (
    descripcion is null
    or char_length(btrim(descripcion)) between 50 and 3000
  ),
  constraint propuestas_archivo_completo check (
    num_nonnulls(
      archivo_path,
      archivo_nombre,
      archivo_tamano,
      archivo_tipo
    ) = 0
    or (
      num_nonnulls(
        archivo_path,
        archivo_nombre,
        archivo_tamano,
        archivo_tipo
      ) = 4
      and archivo_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$'
      and char_length(archivo_nombre) between 1 and 180
      and archivo_tamano between 1 and 5242880
      and archivo_tipo = 'application/pdf'
    )
  ),
  constraint propuestas_contenido_requerido check (
    descripcion is not null or archivo_path is not null
  ),
  constraint propuestas_notas_validas check (
    notas_internas is null
    or char_length(btrim(notas_internas)) between 1 and 5000
  ),
  constraint propuestas_retencion_valida check (
    retention_until >= created_at
    and retention_until <= created_at + interval '12 months'
  )
);

comment on table public.propuestas is
  'Propuestas privadas recibidas desde el formulario público.';
comment on column public.propuestas.notas_internas is
  'Notas de revisión visibles únicamente para usuarios autorizados.';
comment on column public.propuestas.retention_until is
  'Fecha máxima de conservación del registro y su documento.';

create unique index propuestas_archivo_path_unico
  on public.propuestas (archivo_path)
  where archivo_path is not null;

create index propuestas_gestion_idx
  on public.propuestas (estado, tipo, created_at desc);

create index propuestas_retencion_idx
  on public.propuestas (retention_until)
  where estado = 'cerrada';

create or replace function private.prepare_proposal_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if row(
      new.id,
      new.tipo,
      new.nombre_responsable,
      new.organizacion,
      new.email,
      new.telefono,
      new.titulo,
      new.duracion_estimada,
      new.descripcion,
      new.archivo_path,
      new.archivo_nombre,
      new.archivo_tamano,
      new.archivo_tipo,
      new.retention_until,
      new.created_at
    ) is distinct from row(
      old.id,
      old.tipo,
      old.nombre_responsable,
      old.organizacion,
      old.email,
      old.telefono,
      old.titulo,
      old.duracion_estimada,
      old.descripcion,
      old.archivo_path,
      old.archivo_nombre,
      old.archivo_tamano,
      old.archivo_tipo,
      old.retention_until,
      old.created_at
    ) then
      raise exception 'Los datos originales de la propuesta no se pueden modificar.'
        using errcode = '42501';
    end if;
  end if;

  new.nombre_responsable := btrim(new.nombre_responsable);
  new.organizacion := nullif(btrim(new.organizacion), '');
  new.email := lower(btrim(new.email));
  new.telefono := nullif(btrim(new.telefono), '');
  new.titulo := btrim(new.titulo);
  new.duracion_estimada := nullif(btrim(new.duracion_estimada), '');
  new.descripcion := nullif(btrim(new.descripcion), '');
  new.archivo_path := nullif(lower(btrim(new.archivo_path)), '');
  new.archivo_nombre := nullif(btrim(new.archivo_nombre), '');
  new.archivo_tipo := nullif(lower(btrim(new.archivo_tipo)), '');
  new.notas_internas := nullif(btrim(new.notas_internas), '');
  new.updated_at := now();

  return new;
end;
$$;

revoke all on function private.prepare_proposal_row() from public;

create trigger propuestas_prepare_row
before insert or update on public.propuestas
for each row execute function private.prepare_proposal_row();

commit;
