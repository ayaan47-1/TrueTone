import { z } from 'zod';
import { bootstrapSession } from './auth';
import { cameraDemoState } from './camera-demo-profile';
import { CAMERA_DEMO, DEMO_MODE, supabase } from './supabase';
import type { FeedbackConsent } from '../features/shade-feedback/cleanup';

const flags = z.object({ is_18_plus: z.boolean(), consent_active: z.boolean() });

/** Reconfirm current consent without trusting the route cache or the cleanup marker. */
export async function readFeedbackConsent(): Promise<FeedbackConsent> {
  if (DEMO_MODE) return 'inactive';
  if (CAMERA_DEMO) {
    const current = cameraDemoState();
    return current.is18 && current.consentActive ? 'active' : 'inactive';
  }
  try {
    const owner = await bootstrapSession();
    const { data, error } = await supabase.from('profiles')
      .select('is_18_plus, consent_active').eq('id', owner).single();
    const parsed = flags.safeParse(data);
    if (error || !parsed.success) return 'unknown';
    return parsed.data.is_18_plus && parsed.data.consent_active ? 'active' : 'inactive';
  } catch {
    return 'unknown';
  }
}
