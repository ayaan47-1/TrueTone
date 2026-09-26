-- 0021_profile_identity.sql
-- CommunityProfile identity seam: adds `username` + `avatar_uri` to `profiles`, used
-- immediately by Account and later by Community. Global username uniqueness is
-- enforced HERE, by the database, never claimed from a client-side/local check --
-- two devices choosing the same handle at once cannot both "win".

alter table public.profiles
  add column username text,
  add column avatar_uri text;

-- Normalized format: 3-20 chars, lowercase letters/digits/underscore, must start with
-- a letter. The client (src/features/identity) validates the same shape before ever
-- calling save(), but this constraint is the actual authority.
alter table public.profiles
  add constraint profiles_username_format
    check (username is null or username ~ '^[a-z][a-z0-9_]{2,19}$');

-- avatar_uri is a user-scoped LOCAL file URI in this release (no cross-device avatar
-- media storage/bucket exists yet -- see CommunityProfileRepository's documented
-- boundary). Bounded defensively so a pathological value can't bloat the row; this is
-- not an authority on the value being a well-formed URI.
alter table public.profiles
  add constraint profiles_avatar_uri_length
    check (avatar_uri is null or char_length(avatar_uri) <= 2048);

-- Case-insensitive global uniqueness, enforced by the database.
create unique index profiles_username_unique_ci on public.profiles (lower(username));
