create or replace function public.is_permanent_user()
returns boolean
language sql
stable
as $$
  select auth.uid() is not null
    and coalesce((auth.jwt()->>'is_anonymous')::boolean, false) is false;
$$;

create or replace function public.is_game_host(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_permanent_user()
    and exists (
      select 1
      from public.games
      where id = target_game_id
        and host_user_id = auth.uid()
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
    where rounds.id = target_round_id
      and public.is_game_host(rounds.game_id)
  );
$$;

drop policy if exists "hosts create games" on public.games;
drop policy if exists "hosts manage games" on public.games;

create policy "hosts create games"
on public.games for insert
to authenticated
with check (host_user_id = auth.uid() and public.is_permanent_user());

create policy "hosts manage games"
on public.games for all
to authenticated
using (host_user_id = auth.uid() and public.is_permanent_user())
with check (host_user_id = auth.uid() and public.is_permanent_user());
