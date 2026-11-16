-- Personagens: instâncias preenchidas de um modelo de ficha (layout fica no modelo, valores aqui).
create table public.characters (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  sheet_id    uuid not null references public.sheets(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  play        jsonb not null default '{"vars":{},"nodes":{}}'::jsonb,
  version     int  not null default 1,
  updated_at  timestamptz not null default now()
);
create index on public.characters(project_id);
create index on public.characters(sheet_id);
alter table public.characters enable row level security;
create policy "characters: dono do projeto" on public.characters
  for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
