-- 0022_user_entitlements.sql
-- Create user_entitlements table for TrueTone Plus subscriptions and Stripe customer mapping

CREATE TABLE public.user_entitlements (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    is_plus_subscriber boolean NOT NULL DEFAULT false,
    subscription_tier text NOT NULL DEFAULT 'none' CHECK (subscription_tier IN ('yearly', 'monthly', 'trial', 'none')),
    subscription_status text NOT NULL DEFAULT 'none' CHECK (subscription_status IN ('active', 'trial', 'past_due', 'canceled', 'expired', 'none')),
    stripe_customer_id text UNIQUE,
    expires_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_entitlements TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_entitlements TO service_role;

-- RLS
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own entitlements"
    ON public.user_entitlements FOR SELECT
    USING (auth.uid() = id);

-- Trigger for updated_at
CREATE TRIGGER set_user_entitlements_updated_at
    BEFORE UPDATE ON public.user_entitlements
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();
