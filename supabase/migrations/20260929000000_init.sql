-- 75 Hard tracker schema.
-- Security model: every table has RLS and is read-only to signed-in users (own rows only).
-- All writes go through SECURITY DEFINER functions that check auth.uid() and enforce the rules:
-- one active challenge per user, challenges are immutable after creation, and tasks can only be
-- checked off for "today" in the challenge's own timezone.

-- ─── Profiles ────────────────────────────────────────────────────────────────────────────────
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  morning_enabled boolean not null default true,
  morning_time time not null default '08:00' check (morning_time between '05:00' and '22:30'),
  evening_enabled boolean not null default true,
  evening_time time not null default '20:00' check (evening_time between '05:00' and '22:30'),
  last_test_push_at timestamptz,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (
    new.id,
    coalesce(nullif(btrim(left(new.raw_user_meta_data ->> 'display_name', 40)), ''), 'Athlete')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Challenges ──────────────────────────────────────────────────────────────────────────────
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  start_date date not null,
  end_date date generated always as (start_date + 74) stored,
  timezone text not null check (char_length(timezone) between 1 and 64),
  status text not null default 'active' check (status in ('active', 'failed', 'completed')),
  end_reason text check (end_reason in ('gave_up', 'missed_day', 'finished')),
  missed_day date,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'active') = (ended_at is null))
);

-- The "one active challenge" rule, enforced by the database.
create unique index challenges_one_active_per_user on public.challenges (user_id) where status = 'active';
create index challenges_user_created on public.challenges (user_id, created_at desc);

create table public.challenge_tasks (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  position smallint not null check (position between 0 and 11),
  title text not null check (char_length(title) between 1 and 60),
  detail text check (char_length(detail) <= 120),
  unique (challenge_id, position)
);
create index challenge_tasks_user on public.challenge_tasks (user_id);

create table public.task_completions (
  task_id uuid not null references public.challenge_tasks (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  completed_at timestamptz not null default now(),
  primary key (task_id, day)
);
create index task_completions_challenge_day on public.task_completions (challenge_id, day);
create index task_completions_user on public.task_completions (user_id);

-- ─── Push notifications ──────────────────────────────────────────────────────────────────────
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 1 and 200),
  auth text not null check (char_length(auth) between 1 and 100),
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);

-- One row per reminder actually claimed, so a reminder is never sent twice in a day.
create table public.reminder_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('morning', 'evening')),
  day date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, day)
);

-- ─── Row level security: read own rows only; no direct writes ────────────────────────────────
alter table public.profiles enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_tasks enable row level security;
alter table public.task_completions enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_log enable row level security;

create policy "Read own profile" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Read own challenges" on public.challenges
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Read own tasks" on public.challenge_tasks
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Read own completions" on public.task_completions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Read own push subscriptions" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));
-- reminder_log: no policies (server only).

revoke all on public.profiles, public.challenges, public.challenge_tasks, public.task_completions,
  public.push_subscriptions, public.reminder_log from anon, authenticated;
grant select on public.profiles, public.challenges, public.challenge_tasks, public.task_completions,
  public.push_subscriptions to authenticated;

-- ─── Helpers ─────────────────────────────────────────────────────────────────────────────────
create function public.local_today(p_timezone text)
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone p_timezone)::date $$;

-- Closes a challenge that has ended: a past day not fully checked off fails it (75 Hard rules),
-- and passing the last day with every day complete finishes it. Caller must hold the row lock.
create function public.settle_challenge(p_challenge_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.challenges;
  v_today date;
  v_task_count int;
  v_missed date;
begin
  select * into c from public.challenges where id = p_challenge_id;
  if not found or c.status <> 'active' then
    return coalesce(c.status, 'missing');
  end if;

  v_today := public.local_today(c.timezone);
  if v_today <= c.start_date then
    return c.status;
  end if;

  select count(*) into v_task_count from public.challenge_tasks where challenge_id = c.id;

  select d::date into v_missed
  from generate_series(c.start_date, least(v_today - 1, c.end_date), interval '1 day') as d
  where (
    select count(*) from public.task_completions tc
    where tc.challenge_id = c.id and tc.day = d::date
  ) < v_task_count
  order by d
  limit 1;

  if v_missed is not null then
    update public.challenges
      set status = 'failed', end_reason = 'missed_day', missed_day = v_missed, ended_at = now()
      where id = c.id;
    return 'failed';
  end if;

  if v_today > c.end_date then
    update public.challenges
      set status = 'completed', end_reason = 'finished', ended_at = now()
      where id = c.id;
    return 'completed';
  end if;

  return c.status;
end;
$$;

-- ─── Client RPCs ─────────────────────────────────────────────────────────────────────────────

-- Settles the caller's active challenge (called when the app opens). Returns its status or null.
create function public.sync_my_challenge()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select id into v_id from public.challenges
    where user_id = v_uid and status = 'active'
    for update;
  if v_id is null then return null; end if;
  return public.settle_challenge(v_id);
end;
$$;

create function public.create_challenge(
  p_name text,
  p_start_date date,
  p_timezone text,
  p_tasks jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_today date;
  v_id uuid;
  v_task jsonb;
  v_title text;
  v_detail text;
  v_pos int := 0;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if char_length(v_name) not between 1 and 40 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if p_timezone is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;
  v_today := public.local_today(p_timezone);
  if p_start_date is null or p_start_date < v_today or p_start_date > v_today + 30 then
    raise exception 'invalid_start_date' using errcode = '22023';
  end if;
  if jsonb_typeof(p_tasks) <> 'array' or jsonb_array_length(p_tasks) not between 1 and 12 then
    raise exception 'invalid_tasks' using errcode = '22023';
  end if;

  for v_task in select value from jsonb_array_elements(p_tasks) loop
    if jsonb_typeof(v_task) <> 'object'
       or char_length(btrim(coalesce(v_task ->> 'title', ''))) not between 1 and 60
       or char_length(btrim(coalesce(v_task ->> 'detail', ''))) > 120 then
      raise exception 'invalid_tasks' using errcode = '22023';
    end if;
  end loop;

  -- Close out an ended challenge first so it doesn't block a new one.
  perform public.sync_my_challenge();

  begin
    insert into public.challenges (user_id, name, start_date, timezone)
      values (v_uid, v_name, p_start_date, p_timezone)
      returning id into v_id;
  exception when unique_violation then
    raise exception 'active_challenge_exists' using errcode = '23505';
  end;

  for v_task in select value from jsonb_array_elements(p_tasks) loop
    v_title := btrim(v_task ->> 'title');
    v_detail := nullif(btrim(coalesce(v_task ->> 'detail', '')), '');
    insert into public.challenge_tasks (challenge_id, user_id, position, title, detail)
      values (v_id, v_uid, v_pos, v_title, v_detail);
    v_pos := v_pos + 1;
  end loop;

  return v_id;
end;
$$;

-- Checks a task on or off for today. Returns the challenge status afterwards.
create function public.set_task_done(p_task_id uuid, p_done boolean)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  c public.challenges;
  v_today date;
  v_status text;
  v_task_count int;
  v_done_count int;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_task_id is null or p_done is null then raise exception 'invalid_input' using errcode = '22023'; end if;

  select ch.* into c
  from public.challenges ch
  join public.challenge_tasks t on t.challenge_id = ch.id
  where t.id = p_task_id and t.user_id = v_uid and ch.user_id = v_uid
  for update of ch;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;

  v_status := public.settle_challenge(c.id);
  if v_status <> 'active' then raise exception 'challenge_not_active' using errcode = '55000'; end if;

  v_today := public.local_today(c.timezone);
  if v_today < c.start_date or v_today > c.end_date then
    raise exception 'outside_challenge_dates' using errcode = '55000';
  end if;

  if p_done then
    insert into public.task_completions (task_id, challenge_id, user_id, day)
      values (p_task_id, c.id, v_uid, v_today)
      on conflict (task_id, day) do nothing;
  else
    delete from public.task_completions where task_id = p_task_id and day = v_today and user_id = v_uid;
  end if;

  -- Last day fully complete: the challenge is finished.
  if p_done and v_today = c.end_date then
    select count(*) into v_task_count from public.challenge_tasks where challenge_id = c.id;
    select count(*) into v_done_count from public.task_completions where challenge_id = c.id and day = v_today;
    if v_done_count >= v_task_count then
      update public.challenges
        set status = 'completed', end_reason = 'finished', ended_at = now()
        where id = c.id;
      return 'completed';
    end if;
  end if;

  return 'active';
end;
$$;

create function public.fail_challenge(p_challenge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update public.challenges
    set status = 'failed', end_reason = 'gave_up', ended_at = now()
    where id = p_challenge_id and user_id = v_uid and status = 'active';
  return found;
end;
$$;

create function public.update_profile(
  p_display_name text,
  p_morning_enabled boolean,
  p_morning_time time,
  p_evening_enabled boolean,
  p_evening_time time
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if char_length(v_name) not between 1 and 40 then raise exception 'invalid_name' using errcode = '22023'; end if;
  if p_morning_enabled is null or p_evening_enabled is null
     or p_morning_time is null or p_morning_time not between '05:00' and '22:30'
     or p_evening_time is null or p_evening_time not between '05:00' and '22:30' then
    raise exception 'invalid_input' using errcode = '22023';
  end if;
  update public.profiles
    set display_name = v_name,
        morning_enabled = p_morning_enabled, morning_time = p_morning_time,
        evening_enabled = p_evening_enabled, evening_time = p_evening_time
    where user_id = v_uid;
end;
$$;

-- A device's push subscription belongs to whoever signed up on it most recently.
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or char_length(p_endpoint) > 1000
     or char_length(coalesce(p_p256dh, '')) not between 1 and 200
     or char_length(coalesce(p_auth, '')) not between 1 and 100 then
    raise exception 'invalid_subscription' using errcode = '22023';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
    values (v_uid, p_endpoint, p_p256dh, p_auth)
    on conflict (endpoint) do update
      set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end;
$$;

create function public.delete_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
end;
$$;

-- ─── Server-only functions (edge functions, service role) ────────────────────────────────────

-- Claims every reminder that is due now and returns one row per device to notify.
create function public.claim_due_reminders()
returns table (
  user_id uuid, kind text, day_number int, tasks_total int, tasks_left int,
  endpoint text, p256dh text, auth text
)
language sql
security definer
set search_path = ''
as $$
  with active as (
    select c.id, c.user_id, c.start_date, c.end_date, c.timezone,
           (now() at time zone c.timezone) as local_now
    from public.challenges c
    where c.status = 'active'
      and exists (select 1 from public.push_subscriptions s where s.user_id = c.user_id)
  ),
  due as (
    select a.user_id, k.kind, a.local_now::date as local_day,
           (a.local_now::date - a.start_date + 1)::int as day_number,
           (select count(*) from public.challenge_tasks t where t.challenge_id = a.id)::int as tasks_total,
           (select count(*) from public.task_completions tc where tc.challenge_id = a.id and tc.day = a.local_now::date)::int as tasks_done
    from active a
    join public.profiles p on p.user_id = a.user_id
    cross join lateral (values
      ('morning', p.morning_enabled, p.morning_time),
      ('evening', p.evening_enabled, p.evening_time)
    ) as k (kind, enabled, at)
    where k.enabled
      and a.local_now::date between a.start_date and a.end_date
      and a.local_now::time >= k.at
      and a.local_now::time < k.at + interval '1 hour'
  ),
  wanted as (
    select * from due
    where kind = 'morning' or tasks_done < tasks_total
  ),
  claimed as (
    insert into public.reminder_log (user_id, kind, day)
    select w.user_id, w.kind, w.local_day from wanted w
    on conflict do nothing
    returning reminder_log.user_id, reminder_log.kind
  )
  select w.user_id, w.kind, w.day_number, w.tasks_total, w.tasks_total - w.tasks_done,
         s.endpoint, s.p256dh, s.auth
  from claimed cl
  join wanted w on w.user_id = cl.user_id and w.kind = cl.kind
  join public.push_subscriptions s on s.user_id = w.user_id;
$$;

-- Test notification for the signed-in user, limited to one every 30 seconds.
create function public.claim_test_push(p_user_id uuid)
returns table (endpoint text, p256dh text, auth text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
    set last_test_push_at = now()
    where profiles.user_id = p_user_id
      and (last_test_push_at is null or last_test_push_at < now() - interval '30 seconds');
  if not found then raise exception 'rate_limited' using errcode = '54000'; end if;
  return query
    select s.endpoint, s.p256dh, s.auth from public.push_subscriptions s where s.user_id = p_user_id;
end;
$$;

-- Push keys and the cron secret live in Vault (created at deploy time, never in source).
create function public.get_push_config()
returns table (vapid_public text, vapid_private text, cron_secret text)
language sql
security definer
set search_path = ''
as $$
  select
    (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_public_key'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'vapid_private_key'),
    (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret')
$$;

-- Run by pg_cron so a challenge with a missed day is closed even if its owner never opens the app.
create function public.settle_all_challenges()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  for v_id in select id from public.challenges where status = 'active' for update skip locked loop
    perform public.settle_challenge(v_id);
  end loop;
end;
$$;

create function public.remove_dead_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$ delete from public.push_subscriptions where endpoint = p_endpoint $$;

-- ─── Function privileges ─────────────────────────────────────────────────────────────────────
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function
  public.sync_my_challenge(),
  public.create_challenge(text, date, text, jsonb),
  public.set_task_done(uuid, boolean),
  public.fail_challenge(uuid),
  public.update_profile(text, boolean, time, boolean, time),
  public.save_push_subscription(text, text, text),
  public.delete_push_subscription(text)
to authenticated;

grant execute on function
  public.claim_due_reminders(),
  public.claim_test_push(uuid),
  public.settle_all_challenges(),
  public.get_push_config(),
  public.remove_dead_subscription(text)
to service_role;

-- New functions in this schema should not be callable by default.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
