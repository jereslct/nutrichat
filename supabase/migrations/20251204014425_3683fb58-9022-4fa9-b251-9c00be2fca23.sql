-- Add specialty column for doctors
ALTER TABLE public.profiles 
ADD COLUMN specialty TEXT DEFAULT NULL;