import { supabase } from './supabase';

export async function bootstrapSession(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  let userId = data.session?.user?.id;
  if (!userId) {
    const { data: anon, error } = await supabase.auth.signInAnonymously();
    if (error || !anon.user) throw new Error('auth-bootstrap-failed');
    userId = anon.user.id;
  }
  // ensure a profile row exists + bump last_interaction_at
  await supabase.from('profiles').upsert(
    { id: userId, last_interaction_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
  return userId;
}
