-- 0020_orders.sql
-- Create orders table for Stripe checkout integration

CREATE TABLE public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_payment_intent_id text UNIQUE NOT NULL,
    amount integer NOT NULL, -- in cents
    status text NOT NULL DEFAULT 'pending',
    items jsonb NOT NULL,
    shipping_address jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.orders TO authenticated;

-- RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own orders"
    ON public.orders FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own orders"
    ON public.orders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- System can update orders via webhook
-- Edge functions will use service role key, bypassing RLS for updates.

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- Include in retention/deletion job (optional based on compliance, but we should probably retain orders for legal/accounting, or anonymize them. For now, since BIPA applies to face images, orders might be exempt or under a different schedule, but we'll leave it simple).
