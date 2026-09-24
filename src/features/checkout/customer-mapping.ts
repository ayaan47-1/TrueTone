// src/features/checkout/customer-mapping.ts
// Mirrored copy of supabase/functions/_shared/checkout/customer-mapping.ts (Jest-importable;
// the Deno copy uses explicit `.ts` import extensions and cannot be imported by Jest directly).
// Keep both copies in sync -- same convention as pricing.ts in this directory.

export interface MaybeSingleResult<T> {
  data: T | null;
}

export interface UpsertResult {
  error: { message: string } | null;
}

export interface AuthedSupabaseLike {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<MaybeSingleResult<{ stripe_customer_id?: string | null }>>;
      };
    };
  };
}

export interface ServiceSupabaseLike {
  from(table: string): {
    upsert(row: { id: string; stripe_customer_id: string }): Promise<UpsertResult>;
  };
}

export interface CustomerMappingDeps {
  authedSupabase: AuthedSupabaseLike;
  /** null when SUPABASE_SERVICE_ROLE_KEY / SERVICE_ROLE_KEY is not configured. */
  serviceSupabase: ServiceSupabaseLike | null;
  createStripeCustomer: (args: { email?: string }) => Promise<{ id: string }>;
}

export type CustomerMappingResult =
  | { ok: true; customerId: string }
  | { ok: false; status: number; message: string };

/**
 * Resolves the Stripe customer id for a user, creating and persisting a new mapping when none
 * exists yet. Fails closed (does not call Stripe, does not proceed) when there is no service-role
 * client to persist the mapping with, and fails closed when the persist itself errors -- an
 * unpersisted mapping would silently create a duplicate Stripe customer on every future checkout.
 */
export async function resolveStripeCustomer(
  deps: CustomerMappingDeps,
  userId: string,
  email: string | undefined,
): Promise<CustomerMappingResult> {
  const { data: customerData } = await deps.authedSupabase
    .from('user_entitlements')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (customerData?.stripe_customer_id) {
    return { ok: true, customerId: customerData.stripe_customer_id };
  }

  if (!deps.serviceSupabase) {
    return {
      ok: false,
      status: 500,
      message: 'payment service not configured (missing service role key)',
    };
  }

  const customer = await deps.createStripeCustomer({ email });
  const { error } = await deps.serviceSupabase.from('user_entitlements').upsert({
    id: userId,
    stripe_customer_id: customer.id,
  });

  if (error) {
    return { ok: false, status: 500, message: 'failed to persist Stripe customer mapping' };
  }

  return { ok: true, customerId: customer.id };
}
