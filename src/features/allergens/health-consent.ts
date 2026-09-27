// src/features/allergens/health-consent.ts
// Client side of the wa_health consent receipts (design §2.4; migration 0022). The RPCs take no
// arguments: only the receipt goes to the server, never the flags.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { clearAllergenProfile } from './allergen-store';

// A withdrawal the server has not logged yet (offline). Holds no health data, only the user id in
// the key, so AsyncStorage is fine. Retried before any new consent so the audit log stays right (M2).
const pendingKey = (userId: string) => `truetone.allergens.pendingWithdrawal.${userId}`;

async function sendWithdrawal(): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('withdraw_health_data_consent');
    return !error;
  } catch {
    return false;
  }
}

/** Logs a pending offline withdrawal, if any. True when nothing is left pending. */
export async function flushPendingWithdrawal(userId: string): Promise<boolean> {
  try {
    if (!(await AsyncStorage.getItem(pendingKey(userId)))) return true;
    if (!(await sendWithdrawal())) return false;
    await AsyncStorage.removeItem(pendingKey(userId));
    return true;
  } catch {
    return false;
  }
}

/** With a userId, a pending withdrawal is logged first; if it can't be, no consent is recorded. */
export async function recordHealthDataConsent(userId?: string | null): Promise<boolean> {
  if (userId && !(await flushPendingWithdrawal(userId))) return false;
  try {
    const { error } = await supabase.rpc('record_health_data_consent');
    return !error;
  } catch {
    return false;
  }
}

/**
 * Withdrawal purges the on-device profile first, so it is gone even when offline. Never rejects:
 * the purge and the receipt are each attempted on their own, and the result says which worked
 * (code review H2). The user's intent is clear, so the withdrawal is logged even if the purge fails.
 */
export async function withdrawHealthDataConsent(userId: string): Promise<{ cleared: boolean; logged: boolean }> {
  let cleared = true;
  try {
    await clearAllergenProfile(userId);
  } catch {
    cleared = false;
  }
  const logged = await sendWithdrawal();
  if (!logged) await AsyncStorage.setItem(pendingKey(userId), '1').catch(() => undefined);
  return { cleared, logged };
}
