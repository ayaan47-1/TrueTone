// src/features/identity/community-profile-types.ts
// Shared user-identity seam: used immediately by Account (app/(tabs)/you.tsx) and
// later by Community. `avatarUri` is a user-scoped LOCAL file URI in this release --
// see community-profile-repository.ts for the deferred cross-device-avatar boundary.
export interface CommunityProfile {
  userId: string;
  username: string;
  avatarUri: string | null;
}

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

// Mirrors the database CHECK constraint `profiles_username_format`
// (supabase/migrations/0021_profile_identity.sql). Keep these in lockstep -- this
// check is a client-side UX nicety only; the database is the sole uniqueness
// authority (a case-insensitive unique index), never a local claim.
const USERNAME_PATTERN = /^[a-z][a-z0-9_]{2,19}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export type UsernameValidation = { valid: true } | { valid: false; reason: string };

export function validateUsername(raw: string): UsernameValidation {
  const value = normalizeUsername(raw);
  if (value.length < USERNAME_MIN_LENGTH) {
    return { valid: false, reason: `Must be at least ${USERNAME_MIN_LENGTH} characters.` };
  }
  if (value.length > USERNAME_MAX_LENGTH) {
    return { valid: false, reason: `Must be ${USERNAME_MAX_LENGTH} characters or fewer.` };
  }
  if (!USERNAME_PATTERN.test(value)) {
    return {
      valid: false,
      reason: 'Use lowercase letters, numbers, and underscores, starting with a letter.',
    };
  }
  return { valid: true };
}
