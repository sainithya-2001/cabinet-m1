-- Cabinet Lite room storage used by the cabinet-rooms Edge Function.
-- The function accesses these tables with the Supabase service-role client only.
create table if not exists public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  room_code text not null unique check (room_code ~ '^[A-Z0-9]{6}$'),
  host_name text not null,
  host_token_hash text not null,
  game_state jsonb not null default '{}'::jsonb,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  created_at timestamptz not null default now()
);

create table if not exists public.game_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  player_name text not null check (char_length(player_name) between 1 and 30),
  player_token_hash text not null unique,
  joined_at timestamptz not null default now()
);

create index if not exists game_players_room_joined_idx
  on public.game_players (room_id, joined_at);

create unique index if not exists game_players_room_name_ci_idx
  on public.game_players (room_id, lower(player_name));

alter table public.game_rooms enable row level security;
alter table public.game_players enable row level security;

revoke all on table public.game_rooms from anon, authenticated;
revoke all on table public.game_players from anon, authenticated;
