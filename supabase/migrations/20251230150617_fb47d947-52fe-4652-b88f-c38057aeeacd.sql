-- Update profiles table for subscription model
-- Change is_premium to subscription_status for more granular control
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'free',
ADD COLUMN IF NOT EXISTS subscription_id text;

-- Migrate existing premium users
UPDATE public.profiles 
SET subscription_status = 'active' 
WHERE is_premium = true;

-- Create index for subscription queries
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles(subscription_status);