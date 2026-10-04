import { supabase } from './supabase';

export async function bootstrapSession(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  let userId = data.session?.user?.id;
  if (!userId) {
    const { data: anon, error } = await supabase.auth.signInAnonymously();
    if (error || !anon.user) throw new Error('auth-bootstrap-failed');
    userId = anon.user.id;
  }
  // The RPC derives the profile id from auth.uid(); clients cannot insert profiles or write
  // compliance-owned columns directly.
  const { error: profileError } = await supabase.rpc('ensure_profile');
  if (profileError) throw new Error('profile-bootstrap-failed');
  return userId;
}
