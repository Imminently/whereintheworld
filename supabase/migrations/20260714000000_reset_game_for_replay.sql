create or replace function public.reset_game_for_replay(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.round_scores where game_id = p_game_id;
  delete from public.round_reveals where game_id = p_game_id;
  delete from public.guesses where game_id = p_game_id;

  update public.games
  set phase = 'lobby', current_round_id = null
  where id = p_game_id;

  if not found then
    raise exception 'Game not found.';
  end if;
end;
$$;

revoke all on function public.reset_game_for_replay(uuid) from public;
revoke all on function public.reset_game_for_replay(uuid) from anon;
revoke all on function public.reset_game_for_replay(uuid) from authenticated;
grant execute on function public.reset_game_for_replay(uuid) to service_role;
