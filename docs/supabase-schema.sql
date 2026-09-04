-- AksesKota — Supabase schema for shared community audits
-- Run this once in Supabase Studio -> SQL Editor -> New query -> Run.

create table if not exists public.audits (
    id              text primary key,
    location_id     text not null,
    location_name   text not null,
    rating          smallint not null check (rating between 1 and 5),
    features        jsonb default '[]'::jsonb,
    explanation     text default '',
    status          text default 'pending' check (status in ('pending','approved','rejected')),
    moderation_note text default '',
    moderated_at    timestamptz,
    created_at      timestamptz default now()
);

create index if not exists audits_created_at_idx on public.audits (created_at desc);
create index if not exists audits_status_idx     on public.audits (status);
create index if not exists audits_location_idx   on public.audits (location_id);

-- Row Level Security: the anon key is public, so permissions must be explicit.
alter table public.audits enable row level security;

-- Anyone may read audits. Accessibility data is meant to be public.
drop policy if exists "audits are publicly readable" on public.audits;
create policy "audits are publicly readable"
    on public.audits for select
    using (true);

-- Anyone may submit an audit, but only as 'pending'. Nobody can self-approve.
drop policy if exists "anyone may submit a pending audit" on public.audits;
create policy "anyone may submit a pending audit"
    on public.audits for insert
    with check (status = 'pending');

-- Moderation (approve/reject) is intentionally NOT granted to anon.
-- Options, in order of preference:
--   1. Supabase Auth + a policy restricted to your moderator user id.
--   2. An Edge Function holding the service_role key server-side.
--   3. Temporary demo policy below — enable ONLY while presenting.
--
-- drop policy if exists "demo moderation" on public.audits;
-- create policy "demo moderation"
--     on public.audits for update
--     using (true)
--     with check (status in ('pending','approved','rejected'));

-- Guardrail: submissions are capped so a bot cannot flood the table.
create or replace function public.audits_reject_oversized()
returns trigger
language plpgsql
as $$
begin
    if length(coalesce(new.explanation, '')) > 500 then
        raise exception 'explanation exceeds 500 characters';
    end if;
    if jsonb_array_length(coalesce(new.features, '[]'::jsonb)) > 10 then
        raise exception 'too many features';
    end if;
    return new;
end;
$$;

drop trigger if exists audits_size_guard on public.audits;
create trigger audits_size_guard
    before insert or update on public.audits
    for each row execute function public.audits_reject_oversized();
