// src/features/allergens/health-consent.ts
// Client side of the wa_health consent receipts (design §2.4; migration 0022). The RPCs take no
// arguments: only the receipt goes to the server, never the flags.
import { supabase } from '../../lib/supabase';
import { clearAllergenProfile } from './allergen-store';

export async function recordHealthDataConsent(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('record_health_data_consent');
    return !error;
  } catch {
    return false;
  }
}

/** Withdrawal purges the on-device profile first, so it is gone even when offline. */
export async function withdrawHealthDataConsent(userId: string): Promise<{ cleared: boolean; logged: boolean }> {
  await clearAllergenProfile(userId);
  try {
    const { error } = await supabase.rpc('withdraw_health_data_consent');
    return { cleared: true, logged: !error };
  } catch {
    return { cleared: true, logged: false };
  }
}
