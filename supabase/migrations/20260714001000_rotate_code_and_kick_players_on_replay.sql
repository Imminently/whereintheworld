create or replace function public.reset_game_for_replay(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reserved_code constant text := '5635';
  old_code_hash text;
  old_code_salt text;
  random_bytes bytea;
  code_search_start integer;
  code_search_offset integer;
  candidate_code text;
  new_code text := null;
  new_code_salt text;
  new_code_hash text;
begin
  select code_hash, code_salt
  into old_code_hash, old_code_salt
  from public.games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'Game not found.';
  end if;

  random_bytes := extensions.gen_random_bytes(2);
  code_search_start := (
    get_byte(random_bytes, 0) * 256 + get_byte(random_bytes, 1)
  ) % 10000;

  for code_search_offset in 0..9999 loop
    candidate_code := lpad(
      ((code_search_start + code_search_offset) % 10000)::text,
      4,
      '0'
    );

    if candidate_code = reserved_code then
      continue;
    end if;

    if encode(
      extensions.digest(old_code_salt || ':' || candidate_code, 'sha256'::text),
      'hex'
    ) = old_code_hash then
      continue;
    end if;

    if not exists (
      select 1
      from public.games as open_game
      where open_game.id <> p_game_id
        and open_game.phase = 'lobby'
        and encode(
          extensions.digest(
            open_game.code_salt || ':' || candidate_code,
            'sha256'::text
          ),
          'hex'
        ) = open_game.code_hash
    ) then
      new_code := candidate_code;
      exit;
    end if;
  end loop;

  if new_code is null then
    raise exception 'No game codes are currently available.';
  end if;

  new_code_salt := encode(extensions.gen_random_bytes(16), 'hex');
  new_code_hash := encode(
    extensions.digest(new_code_salt || ':' || new_code, 'sha256'::text),
    'hex'
  );

  delete from public.round_scores where game_id = p_game_id;
  delete from public.round_reveals where game_id = p_game_id;
  delete from public.guesses where game_id = p_game_id;
  delete from public.participants where game_id = p_game_id;

  update public.games
  set
    phase = 'lobby',
    current_round_id = null,
    code_hash = new_code_hash,
    code_salt = new_code_salt
  where id = p_game_id;
end;
$$;

revoke all on function public.reset_game_for_replay(uuid) from public;
revoke all on function public.reset_game_for_replay(uuid) from anon;
revoke all on function public.reset_game_for_replay(uuid) from authenticated;
grant execute on function public.reset_game_for_replay(uuid) to service_role;
