-- FORJA · una tabla y sus permisos. Pégalo entero en Supabase -> SQL Editor -> Run.
--
-- Cada usuario tiene una sola fila con todo su estado en JSON: perfil, rutinas,
-- sesiones, chequeos, comida. La app ya trabajaba con un único objeto, así que
-- sincronizar es traer y mandar esa fila.

create table if not exists public.estados (
  user_id     uuid primary key references auth.users on delete cascade,
  estado      jsonb       not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);

-- Sin esto, cualquiera con la clave pública leería los datos de todos.
alter table public.estados enable row level security;

drop policy if exists "leer lo propio"      on public.estados;
drop policy if exists "crear lo propio"     on public.estados;
drop policy if exists "actualizar lo propio" on public.estados;

create policy "leer lo propio"
  on public.estados for select
  using (auth.uid() = user_id);

create policy "crear lo propio"
  on public.estados for insert
  with check (auth.uid() = user_id);

create policy "actualizar lo propio"
  on public.estados for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
