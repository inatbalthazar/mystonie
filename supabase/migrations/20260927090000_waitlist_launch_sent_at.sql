-- Stage 1 email: remember who already got the launch email, so batched sends never repeat (ADR 0019).
alter table public.waitlist add column launch_sent_at timestamptz;

comment on column public.waitlist.launch_sent_at is 'When the launch email was sent to this address (null = not yet).';
