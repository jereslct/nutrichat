-- Add unique constraint for patient_summaries upsert
ALTER TABLE public.patient_summaries 
ADD CONSTRAINT patient_summaries_patient_doctor_unique 
UNIQUE (patient_id, doctor_id);