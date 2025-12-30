-- Add freemium columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS chat_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false;

-- Add index for premium status queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_premium ON public.profiles(is_premium);