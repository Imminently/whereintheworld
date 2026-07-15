create extension if not exists pgcrypto;

do $$
begin
  create type public.game_phase as enum ('setup', 'lobby', 'guessing', 'revealed', 'finished');
exception
  when duplicate_object then null;
end $$;

create table public.games (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  code_hash text not null,
  code_salt text not null,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  phase public.game_phase not null default 'setup',
  current_round_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 100),
  sort_order integer not null check (sort_order > 0),
  created_at timestamptz not null default now(),
  unique (game_id, display_name),
  unique (game_id, sort_order)
);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  subject_member_id uuid not null references public.team_members(id) on delete cascade,
  photo_object_key text,
  display_order integer not null check (display_order > 0),
  created_at timestamptz not null default now(),
  unique (game_id, subject_member_id),
  unique (game_id, display_order)
);

alter table public.games
  add constraint games_current_round_fk
  foreign key (current_round_id)
  references public.rounds(id)
  on delete set null;

create table public.round_answers (
  round_id uuid primary key references public.rounds(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location_label text not null check (char_length(trim(location_label)) between 1 and 160),
  created_at timestamptz not null default now()
);

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 100),
  joined_at timestamptz not null default now(),
  unique (game_id, user_id),
  unique (game_id, team_member_id)
);

create table public.guesses (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  submitted_at timestamptz not null default now(),
  unique (game_id, round_id, participant_id)
);

create table public.round_reveals (
  game_id uuid not null references public.games(id) on delete cascade,
  round_id uuid primary key references public.rounds(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  location_label text not null,
  revealed_at timestamptz not null default now()
);

create table public.round_scores (
  game_id uuid not null references public.games(id) on delete cascade,
  round_id uuid not null references public.rounds(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  distance_km double precision check (distance_km is null or distance_km >= 0),
  scored boolean not null,
  created_at timestamptz not null default now(),
  primary key (round_id, participant_id)
);

create index games_host_user_id_idx on public.games(host_user_id);
create index team_members_game_id_idx on public.team_members(game_id);
create index rounds_game_id_idx on public.rounds(game_id);
create index participants_game_user_idx on public.participants(game_id, user_id);
create index guesses_round_id_idx on public.guesses(round_id);
create index round_scores_game_id_idx on public.round_scores(game_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger games_set_updated_at
before update on public.games
for each row
execute function public.set_updated_at();

create or replace function public.try_uuid(value text)
returns uuid
language plpgsql
immutable
as $$
begin
  return value::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

create or replace function public.is_game_host(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.games
    where id = target_game_id
      and host_user_id = auth.uid()
  );
$$;

create or replace function public.is_game_participant(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.participants
    where game_id = target_game_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_participant_owner(target_participant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.participants
    where id = target_participant_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_round_host(target_round_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rounds
    join public.games on games.id = rounds.game_id
    where rounds.id = target_round_id
      and games.host_user_id = auth.uid()
  );
$$;

create or replace function public.can_submit_guess(
  target_game_id uuid,
  target_round_id uuid,
  target_participant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.games
    join public.rounds on rounds.id = target_round_id and rounds.game_id = games.id
    join public.participants on participants.id = target_participant_id
      and participants.game_id = games.id
      and participants.user_id = auth.uid()
    where games.id = target_game_id
      and games.phase = 'guessing'
      and games.current_round_id = target_round_id
      and rounds.subject_member_id <> participants.team_member_id
      and not exists (
        select 1
        from public.round_reveals
        where round_reveals.round_id = target_round_id
      )
  );
$$;

create or replace function public.calculate_distance_km(
  first_latitude double precision,
  first_longitude double precision,
  second_latitude double precision,
  second_longitude double precision
)
returns double precision
language sql
immutable
as $$
  select 2 * 6371.0088 * asin(
    sqrt(
      power(sin(radians(second_latitude - first_latitude) / 2), 2) +
      cos(radians(first_latitude)) *
      cos(radians(second_latitude)) *
      power(sin(radians(second_longitude - first_longitude) / 2), 2)
    )
  );
$$;

create or replace function public.broadcast_game_event(
  p_game_id uuid,
  p_event text,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, realtime
as $$
begin
  perform realtime.send(
    jsonb_build_object('gameId', p_game_id, 'event', p_event, 'payload', p_payload),
    p_event,
    'game:' || p_game_id::text,
    false
  );
end;
$$;

alter table public.games enable row level security;
alter table public.team_members enable row level security;
alter table public.rounds enable row level security;
alter table public.round_answers enable row level security;
alter table public.participants enable row level security;
alter table public.guesses enable row level security;
alter table public.round_reveals enable row level security;
alter table public.round_scores enable row level security;

create policy "hosts create games"
on public.games for insert
to authenticated
with check (host_user_id = auth.uid());

create policy "hosts manage games"
on public.games for all
to authenticated
using (host_user_id = auth.uid())
with check (host_user_id = auth.uid());

create policy "participants read joined games"
on public.games for select
to authenticated
using (public.is_game_participant(id));

create policy "hosts manage team members"
on public.team_members for all
to authenticated
using (public.is_game_host(game_id))
with check (public.is_game_host(game_id));

create policy "participants read team members"
on public.team_members for select
to authenticated
using (public.is_game_participant(game_id));

create policy "hosts manage rounds"
on public.rounds for all
to authenticated
using (public.is_game_host(game_id))
with check (public.is_game_host(game_id));

create policy "participants read rounds"
on public.rounds for select
to authenticated
using (public.is_game_participant(game_id));

create policy "hosts manage answers"
on public.round_answers for all
to authenticated
using (public.is_round_host(round_id))
with check (public.is_round_host(round_id));

create policy "players read visible participants"
on public.participants for select
to authenticated
using (public.is_game_host(game_id) or public.is_game_participant(game_id));

create policy "players read own guesses"
on public.guesses for select
to authenticated
using (public.is_game_host(game_id) or public.is_participant_owner(participant_id));

create policy "players insert guesses"
on public.guesses for insert
to authenticated
with check (public.can_submit_guess(game_id, round_id, participant_id));

create policy "players update own active guesses"
on public.guesses for update
to authenticated
using (public.can_submit_guess(game_id, round_id, participant_id))
with check (public.can_submit_guess(game_id, round_id, participant_id));

create policy "players read reveals"
on public.round_reveals for select
to authenticated
using (public.is_game_host(game_id) or public.is_game_participant(game_id));

create policy "players read scores"
on public.round_scores for select
to authenticated
using (public.is_game_host(game_id) or public.is_game_participant(game_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'game-photos',
  'game-photos',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "hosts upload game photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'game-photos'
  and (storage.foldername(name))[1] = 'games'
  and public.is_game_host(public.try_uuid((storage.foldername(name))[2]))
);

create policy "hosts manage game photos"
on storage.objects for all
to authenticated
using (
  bucket_id = 'game-photos'
  and (storage.foldername(name))[1] = 'games'
  and public.is_game_host(public.try_uuid((storage.foldername(name))[2]))
)
with check (
  bucket_id = 'game-photos'
  and (storage.foldername(name))[1] = 'games'
  and public.is_game_host(public.try_uuid((storage.foldername(name))[2]))
);

grant execute on function public.broadcast_game_event(uuid, text, jsonb) to service_role;

alter table realtime.messages enable row level security;

create policy "game channels for joined users"
on realtime.messages for select
to authenticated
using (
  split_part(realtime.topic(), ':', 1) = 'game'
  and (
    public.is_game_host(public.try_uuid(split_part(realtime.topic(), ':', 2)))
    or public.is_game_participant(public.try_uuid(split_part(realtime.topic(), ':', 2)))
  )
);

do $$
begin
  alter publication supabase_realtime add table public.games;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.participants;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.guesses;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.round_reveals;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.round_scores;
exception
  when duplicate_object then null;
end $$;
