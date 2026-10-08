-- Huemen database schema.
-- Already applied to the live project (migration "initial_schema"). Safe to re-run: it only creates what is missing.
-- To set up a fresh project: Dashboard → SQL Editor → paste all of this → Run.
-- Every table is locked with row-level security: a signed-in user can only see and change their own rows.

create extension if not exists pgcrypto;

-- Business profile, payment details and numbering preferences (one row per user)
create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  company text,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  client_id uuid references public.clients on delete set null,
  title text not null,
  currency text not null default 'INR' check (currency in ('INR', 'USD')),
  status text not null default 'active' check (status in ('active', 'on_hold', 'completed')),
  rates jsonb not null default '[]'::jsonb,          -- [{ "name": "Design", "amount": 2000 }]
  start_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.deliverables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  title text not null,
  kind text not null default 'fixed' check (kind in ('fixed', 'hourly')),
  hours numeric,
  rate numeric,
  amount numeric not null default 0,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  is_additional boolean not null default false,
  due_date date,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  number text not null,
  type text not null check (type in ('advance', 'milestone', 'additional', 'final', 'custom')),
  issue_date date not null default current_date,
  due_date date,
  items jsonb not null default '[]'::jsonb,           -- [{ title, detail, hours, rate, amount, deliverable_id }]
  discount numeric not null default 0,
  total numeric not null default 0,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'void')),
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  invoice_id uuid not null references public.invoices on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  number text not null,                                -- receipt number
  date date not null default current_date,
  amount numeric not null,
  method text not null default 'upi',
  reference text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid references public.projects on delete cascade,
  kind text not null,
  title text not null,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists deliverables_project_idx on public.deliverables (project_id);
create index if not exists invoices_project_idx on public.invoices (project_id);
create index if not exists payments_invoice_idx on public.payments (invoice_id);
create index if not exists activity_project_idx on public.activity (project_id);
create index if not exists projects_client_idx on public.projects (client_id);
create index if not exists payments_project_idx on public.payments (project_id);
create index if not exists clients_user_idx on public.clients (user_id);
create index if not exists projects_user_idx on public.projects (user_id);
create index if not exists deliverables_user_idx on public.deliverables (user_id);
create index if not exists invoices_user_idx on public.invoices (user_id);
create index if not exists payments_user_idx on public.payments (user_id);
create index if not exists activity_user_idx on public.activity (user_id);

-- Row-level security: owner only
do $$
declare t text;
begin
  foreach t in array array['settings', 'clients', 'projects', 'deliverables', 'invoices', 'payments', 'activity'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner only" on public.%I', t);
    execute format(
      'create policy "owner only" on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
