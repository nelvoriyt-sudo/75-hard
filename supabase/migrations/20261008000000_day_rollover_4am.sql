-- 75 Hard says to finish the day's tasks before you go to bed, not by midnight.
-- A challenge day now stays open until 4 AM the next morning in the challenge's timezone.
-- Every rule that asks "what day is it" (check-offs, missed-day settling, start dates) uses this.
create or replace function public.local_today(p_timezone text)
returns date
language sql
stable
set search_path = ''
as $$ select ((now() at time zone p_timezone) - interval '4 hours')::date $$;

revoke execute on function public.local_today(text) from public, anon, authenticated;
