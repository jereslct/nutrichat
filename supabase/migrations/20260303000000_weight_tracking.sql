-- Add weight-tracking columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height numeric,
  ADD COLUMN IF NOT EXISTS target_weight numeric,
  ADD COLUMN IF NOT EXISTS weight_unit text NOT NULL DEFAULT 'kg';

-- Create weight_entries table
CREATE TABLE public.weight_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weight numeric NOT NULL,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- One entry per user per day
CREATE UNIQUE INDEX idx_weight_entries_user_date ON public.weight_entries(user_id, entry_date);
CREATE INDEX idx_weight_entries_user_id ON public.weight_entries(user_id);

-- Enable RLS
ALTER TABLE public.weight_entries ENABLE ROW LEVEL SECURITY;

-- Patients can CRUD their own entries
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

-- Doctors can view weight entries for their linked patients
CREATE POLICY "Doctors can view patient weight entries"
ON public.weight_entries FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.doctor_patients dp
    WHERE dp.doctor_id = auth.uid()
      AND dp.patient_id = weight_entries.user_id
  )
);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_weight_entries_updated_at
BEFORE UPDATE ON public.weight_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
