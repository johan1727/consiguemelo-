-- 001_subscriptions.sql
-- Tabla para registrar pagos y gestionar suscripciones de Stripe

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_payment_intent_id text,
  status text NOT NULL DEFAULT 'active',
  plan text NOT NULL DEFAULT 'vip',
  amount_paid integer,
  currency text DEFAULT 'mxn',
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Solo los dueños de su subscripción pueden leerla, pero solo el server la modifica.
CREATE POLICY "Users can view their own subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);
