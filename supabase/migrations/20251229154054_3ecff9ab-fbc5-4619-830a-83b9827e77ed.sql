-- Create user_usage table for tracking daily query limits
CREATE TABLE public.user_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  daily_query_count integer NOT NULL DEFAULT 0,
  last_query_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_usage ENABLE ROW LEVEL SECURITY;

-- Users can only view their own usage
CREATE POLICY "Users can view own usage"
ON public.user_usage
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own usage record
CREATE POLICY "Users can insert own usage"
ON public.user_usage
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own usage record
CREATE POLICY "Users can update own usage"
ON public.user_usage
FOR UPDATE
USING (auth.uid() = user_id);

-- Create trigger to update updated_at
CREATE TRIGGER update_user_usage_updated_at
BEFORE UPDATE ON public.user_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_user_usage_user_id ON public.user_usage(user_id);