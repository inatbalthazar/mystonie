-- Stage 3 offline-first (S3 offline, ADR 0042). Changes made offline reach the server late and out of order, so an
-- entry keeps when it was last edited: the device's time of the change (clamped to now). The route handlers only
-- apply a change made at or after it, so the later edit wins, not the later arrival.
-- Existing rows get the time this migration runs (a constant default, so no rewrite and no update triggers fire).

alter table public.entries add column edited_at timestamptz not null default now();

comment on column public.entries.edited_at is
  'When status, finish date, rating, review or deleted_at last changed, by the clock of the device that changed it (clamped to now). Writes older than it are not applied (ADR 0042).';

-- A change that carries no device time (imports, a log moving "want" on, the service role) happened now. A time
-- ahead of the server's clock is clamped, so a fast device clock can't block later edits.
create function private.stamp_edited_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.edited_at is not distinct from old.edited_at
     and (new.status, new.finished_at, new.rating, new.review, new.deleted_at)
         is distinct from (old.status, old.finished_at, old.rating, old.review, old.deleted_at) then
    new.edited_at := now();
  end if;
  if new.edited_at > now() then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function private.stamp_edited_at() from public, anon, authenticated;

create trigger entries_stamp_edited_at
  before insert or update on public.entries
  for each row execute function private.stamp_edited_at();

-- Clients send it with the change (the route handlers do, as the user).
grant insert (edited_at), update (edited_at) on public.entries to authenticated;
