alter table public.participants
  alter column user_id drop not null;

alter table public.participants
  add column if not exists session_token_hash text;

update public.participants
set session_token_hash = encode(
  extensions.digest(gen_random_uuid()::text, 'sha256'::text),
  'hex'
)
where session_token_hash is null;

alter table public.participants
  alter column session_token_hash set not null;

do $$
begin
  alter table public.participants
    add constraint participants_session_token_hash_length
    check (char_length(session_token_hash) = 64);
exception
  when duplicate_object then null;
end $$;

create unique index if not exists participants_game_session_token_hash_idx
on public.participants(game_id, session_token_hash);
