-- Gerenciador de RPG — esquema inicial
-- Rode no SQL Editor do Supabase (ou via `supabase db push`).
-- Todas as tabelas carregam project_id e RLS: cada usuário só enxerga os projetos que possui.
-- Biblioteca, relações e documentos já estão aqui para evitar migrações quebradas depois;
-- a interface delas entra nas etapas 7–9.

create extension if not exists "pgcrypto";

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  cover_url   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Função auxiliar usada pelas políticas: o usuário atual é dono do projeto?
create or replace function public.owns_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.projects p where p.id = pid and p.user_id = auth.uid());
$$;

-- Regras: variáveis do sistema (atributos, recursos, valores calculados…)
create table public.variables (
  id          uuid primary key,
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  type        text not null check (type in ('number','text','boolean')),
  initial     jsonb not null default '0'::jsonb,
  formula     text not null default '',
  group_name  text not null default '',
  description text not null default '',
  position    int  not null default 0,
  unique (project_id, name)
);

-- Construtor visual: cada ficha é um documento (cena em jsonb)
create table public.sheets (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  scene       jsonb not null,
  play        jsonb not null default '{"vars":{},"nodes":{}}'::jsonb,
  version     int  not null default 1,
  updated_at  timestamptz not null default now()
);

-- Biblioteca (etapa 7): tipos definidos pelo usuário e seus registros
create table public.library_types (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  name        text not null,
  icon        text,
  fields      jsonb not null default '[]'::jsonb,   -- esquema de campos
  position    int  not null default 0
);
create table public.library_records (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  type_id     uuid not null references public.library_types(id) on delete cascade,
  name        text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Relações entre registros (etapa 8)
create table public.relations (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  source_id   uuid not null references public.library_records(id) on delete cascade,
  target_id   uuid not null references public.library_records(id) on delete cascade,
  label       text not null default '',
  unique (source_id, target_id, label)
);

-- Documentação (etapa 9): árvore de pastas e páginas
create table public.doc_pages (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  parent_id   uuid references public.doc_pages(id) on delete cascade,
  is_folder   boolean not null default false,
  title       text not null default 'Sem título',
  content     jsonb,
  position    int not null default 0,
  updated_at  timestamptz not null default now()
);

create index on public.variables(project_id);
create index on public.sheets(project_id);
create index on public.library_types(project_id);
create index on public.library_records(project_id, type_id);
create index on public.relations(project_id);
create index on public.doc_pages(project_id, parent_id);

-- RLS
alter table public.projects        enable row level security;
alter table public.variables       enable row level security;
alter table public.sheets          enable row level security;
alter table public.library_types   enable row level security;
alter table public.library_records enable row level security;
alter table public.relations       enable row level security;
alter table public.doc_pages       enable row level security;

create policy "projects: dono" on public.projects
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "variables: dono do projeto"       on public.variables       for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "sheets: dono do projeto"          on public.sheets          for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "library_types: dono do projeto"   on public.library_types   for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "library_records: dono do projeto" on public.library_records for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "relations: dono do projeto"       on public.relations       for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
create policy "doc_pages: dono do projeto"       on public.doc_pages       for all using (public.owns_project(project_id)) with check (public.owns_project(project_id));
