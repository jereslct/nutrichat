-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('patient', 'doctor');

-- Create user_roles table (secure role storage)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'patient',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Update handle_new_user to also insert into user_roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')
  );
  
  -- Insert into user_roles table
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')::app_role
  );
  
  RETURN NEW;
END;
$$;

-- Update doctor_patients RLS to use has_role function
DROP POLICY IF EXISTS "Doctors create relationships" ON public.doctor_patients;
DROP POLICY IF EXISTS "Doctors view own patients" ON public.doctor_patients;

CREATE POLICY "Doctors create relationships"
ON public.doctor_patients
FOR INSERT
WITH CHECK (auth.uid() = doctor_id AND public.has_role(auth.uid(), 'doctor'));

CREATE POLICY "Doctors view own patients"
ON public.doctor_patients
FOR SELECT
USING (auth.uid() = doctor_id AND public.has_role(auth.uid(), 'doctor'));

-- Update patient_summaries RLS
DROP POLICY IF EXISTS "Doctors manage summaries" ON public.patient_summaries;
DROP POLICY IF EXISTS "Doctors view patient summaries" ON public.patient_summaries;

CREATE POLICY "Doctors manage summaries"
ON public.patient_summaries
FOR ALL
USING (auth.uid() = doctor_id AND public.has_role(auth.uid(), 'doctor'));

-- Update diets RLS for doctors
DROP POLICY IF EXISTS "Doctors view patients diets" ON public.diets;

CREATE POLICY "Doctors view patients diets"
ON public.diets
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM doctor_patients
    WHERE doctor_patients.doctor_id = auth.uid()
    AND doctor_patients.patient_id = diets.user_id
  )
  AND public.has_role(auth.uid(), 'doctor')
);

-- Update profiles RLS for doctors viewing patients
DROP POLICY IF EXISTS "Doctors can view patients profiles" ON public.profiles;

CREATE POLICY "Doctors can view patients profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM doctor_patients
    WHERE doctor_patients.doctor_id = auth.uid()
    AND doctor_patients.patient_id = profiles.id
  )
  AND public.has_role(auth.uid(), 'doctor')
);

-- Delete existing users data to start fresh
DELETE FROM public.chat_messages;
DELETE FROM public.diets;
DELETE FROM public.doctor_patients;
DELETE FROM public.patient_summaries;
DELETE FROM public.profiles;