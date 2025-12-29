-- Add daily_image_count column to user_usage table
ALTER TABLE public.user_usage 
ADD COLUMN IF NOT EXISTS daily_image_count integer NOT NULL DEFAULT 0;