-- Per-user accent colour theme.
alter table public.profiles
  add column accent text not null default 'volt'
  check (accent in ('volt', 'blaze', 'ice', 'violet', 'gold', 'rose'));

create function public.set_accent(p_accent text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_accent is null or p_accent not in ('volt', 'blaze', 'ice', 'violet', 'gold', 'rose') then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  update public.profiles set accent = p_accent where user_id = auth.uid();
end;
$$;

revoke execute on function public.set_accent(text) from public, anon;
grant execute on function public.set_accent(text) to authenticated;
