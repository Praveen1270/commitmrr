-- Auth must never be blocked by app-level profile sync.
-- The app can create/update profile rows after login, but a failing auth.users
-- trigger prevents OAuth from completing with "Database error updating user".
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_updated on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.handle_user_update();

-- This table is not used by CommitMRR. Creating it can conflict with custom
-- auth triggers/functions that expect a different column shape, such as user_id.
drop table if exists public.users;
