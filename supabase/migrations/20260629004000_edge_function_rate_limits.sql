create table if not exists public.edge_function_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.edge_function_rate_limits enable row level security;

create or replace function public.check_edge_function_rate_limit(
  p_rate_key text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  next_request_count integer;
begin
  if p_rate_key is null
    or char_length(p_rate_key) < 16
    or p_max_requests < 1
    or p_window_seconds < 1 then
    return false;
  end if;

  insert into public.edge_function_rate_limits (
    rate_key,
    window_started_at,
    request_count,
    updated_at
  )
  values (p_rate_key, now(), 1, now())
  on conflict (rate_key) do update
  set
    window_started_at = case
      when edge_function_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds)
      then now()
      else edge_function_rate_limits.window_started_at
    end,
    request_count = case
      when edge_function_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds)
      then 1
      else edge_function_rate_limits.request_count + 1
    end,
    updated_at = now()
  returning request_count into next_request_count;

  return next_request_count <= p_max_requests;
end;
$$;

grant execute on function public.check_edge_function_rate_limit(text, integer, integer) to service_role;
