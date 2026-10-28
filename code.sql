-- STUDY SPACE: run this once in Supabase > SQL Editor > New query > Run.

-- ============ Tables ============
create table if not exists public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('student','instructor')),
  pet text not null default 'plant' check (pet in ('plant','pet')),
  created_at timestamptz default now());

-- Optional: add emails here to limit who can become an Instructor.
-- While this table is empty, anyone can choose Instructor when signing up.
create table if not exists public.instructor_emails(email text primary key);

create table if not exists public.tasks(
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  type text not null check (type in ('quiz','assignment','activity','personal')),
  course text default '',
  descr text default '',
  due timestamptz not null,
  files jsonb not null default '[]',
  created_at timestamptz default now());

create table if not exists public.subs(
  task_id uuid references public.tasks(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('done','submitted')),
  note text default '',
  files jsonb not null default '[]',
  at timestamptz not null default now(),
  primary key (task_id, student_id));

alter table public.profiles enable row level security;
alter table public.instructor_emails enable row level security;
alter table public.tasks enable row level security;
alter table public.subs enable row level security;

-- ============ Helper functions ============
create or replace function public.my_role() returns text
  language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.can_be_instructor() returns boolean
  language sql stable security definer set search_path = public as
$$ select not exists (select 1 from public.instructor_emails)
       or exists (select 1 from public.instructor_emails where lower(email) = lower(auth.jwt() ->> 'email')) $$;

-- ============ Profiles ============
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles create own" on public.profiles;
create policy "profiles create own" on public.profiles for insert to authenticated
  with check (id = auth.uid() and (role = 'student' or public.can_be_instructor()));
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = public.my_role());

-- ============ Tasks ============
drop policy if exists "tasks read" on public.tasks;
create policy "tasks read" on public.tasks for select to authenticated
  using (type <> 'personal' or owner = auth.uid());
drop policy if exists "tasks create" on public.tasks;
create policy "tasks create" on public.tasks for insert to authenticated
  with check (owner = auth.uid() and ((type = 'personal') = (public.my_role() = 'student')));
drop policy if exists "tasks update own" on public.tasks;
create policy "tasks update own" on public.tasks for update to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid() and ((type = 'personal') = (public.my_role() = 'student')));
drop policy if exists "tasks delete own" on public.tasks;
create policy "tasks delete own" on public.tasks for delete to authenticated using (owner = auth.uid());

-- ============ Submissions ============
-- A student sees their own; an instructor sees submissions to their own tasks.
drop policy if exists "subs read" on public.subs;
create policy "subs read" on public.subs for select to authenticated
  using (student_id = auth.uid()
         or exists (select 1 from public.tasks t where t.id = task_id and t.owner = auth.uid()));
drop policy if exists "subs create" on public.subs;
create policy "subs create" on public.subs for insert to authenticated
  with check (student_id = auth.uid() and public.my_role() = 'student'
         and exists (select 1 from public.tasks t where t.id = task_id and (t.type <> 'personal' or t.owner = auth.uid())));
drop policy if exists "subs update own" on public.subs;
create policy "subs update own" on public.subs for update to authenticated
  using (student_id = auth.uid()) with check (student_id = auth.uid());
drop policy if exists "subs delete own" on public.subs;
create policy "subs delete own" on public.subs for delete to authenticated using (student_id = auth.uid());

-- Leaderboard view: who finished which assigned task and when. No notes, no files.
create or replace view public.progress as
  select s.task_id, s.student_id, s.kind, s.at
  from public.subs s join public.tasks t on t.id = s.task_id
  where t.type <> 'personal';
revoke all on public.progress from anon;
grant select on public.progress to authenticated;

-- ============ File storage (private bucket, 50 MB per file) ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('uploads', 'uploads', false, 52428800, array[
  'image/jpeg','image/png','image/gif','image/webp','image/heic',
  'video/mp4','video/webm','video/quicktime',
  'audio/mpeg','audio/wav','audio/mp4',
  'application/pdf','text/plain','application/zip','application/x-zip-compressed',
  'application/msword','application/vnd.ms-powerpoint','application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types, public = false;

drop policy if exists "uploads insert own folder" on storage.objects;
create policy "uploads insert own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "uploads delete own folder" on storage.objects;
create policy "uploads delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

-- You can open a file if it is yours, attached to an assigned task,
-- or submitted to a task you own.
drop policy if exists "uploads read allowed" on storage.objects;
create policy "uploads read allowed" on storage.objects for select to authenticated
  using (bucket_id = 'uploads' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or exists (select 1 from public.tasks t
               where t.type <> 'personal' and t.files @> jsonb_build_array(jsonb_build_object('path', name)))
    or exists (select 1 from public.subs s join public.tasks t on t.id = s.task_id
               where t.owner = auth.uid() and s.files @> jsonb_build_array(jsonb_build_object('path', name)))));
