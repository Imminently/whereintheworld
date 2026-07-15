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

grant execute on function public.broadcast_game_event(uuid, text, jsonb) to authenticated;
