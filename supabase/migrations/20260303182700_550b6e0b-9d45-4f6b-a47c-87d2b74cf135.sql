
-- Weight tracking: add weight_entries table
CREATE TABLE IF NOT EXISTS public.weight_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight numeric NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, entry_date)
);

ALTER TABLE public.weight_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weight entries"
  ON public.weight_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weight entries"
  ON public.weight_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weight entries"
  ON public.weight_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own weight entries"
  ON public.weight_entries FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Doctors can view patient weight entries"
  ON public.weight_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM doctor_patients
      WHERE doctor_patients.doctor_id = auth.uid()
        AND doctor_patients.patient_id = weight_entries.user_id
    )
    AND has_role(auth.uid(), 'doctor'::app_role)
  );

-- Add weight columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height numeric,
  ADD COLUMN IF NOT EXISTS target_weight numeric,
  ADD COLUMN IF NOT EXISTS weight_unit text DEFAULT 'kg';

-- Enable realtime for weight_entries
ALTER PUBLICATION supabase_realtime ADD TABLE public.weight_entries;
