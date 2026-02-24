-- Token usage tracking table
CREATE TABLE token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  function_name TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_token_usage_user_date ON token_usage (user_id, created_at);
CREATE INDEX idx_token_usage_function ON token_usage (function_name, created_at);

ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage
CREATE POLICY "Users can read own token usage"
  ON token_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role can insert (edge functions use service role key)
CREATE POLICY "Service role can insert token usage"
  ON token_usage FOR INSERT
  WITH CHECK (true);
