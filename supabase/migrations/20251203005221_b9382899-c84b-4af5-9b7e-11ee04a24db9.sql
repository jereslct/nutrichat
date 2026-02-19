-- Create link_requests table for doctor-patient linking requests
CREATE TABLE public.link_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL,
  target_id UUID NOT NULL,
  requester_role TEXT NOT NULL CHECK (requester_role IN ('doctor', 'patient')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  invitation_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(requester_id, target_id)
);

-- Enable RLS
ALTER TABLE public.link_requests ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view requests where they are requester or target
CREATE POLICY "Users can view own requests"
ON public.link_requests
FOR SELECT
USING (auth.uid() = requester_id OR auth.uid() = target_id);

-- Policy: Users can create requests
CREATE POLICY "Users can create requests"
ON public.link_requests
FOR INSERT
WITH CHECK (auth.uid() = requester_id);

-- Policy: Target users can update request status
CREATE POLICY "Target can update request status"
ON public.link_requests
FOR UPDATE
USING (auth.uid() = target_id);

-- Policy: Requesters can delete their pending requests
CREATE POLICY "Requesters can delete pending requests"
ON public.link_requests
FOR DELETE
USING (auth.uid() = requester_id AND status = 'pending');

-- Trigger for updated_at
CREATE TRIGGER update_link_requests_updated_at
BEFORE UPDATE ON public.link_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add UPDATE policy for doctor_patients to allow accepting invitations
CREATE POLICY "Patients can accept invitations"
ON public.doctor_patients
FOR UPDATE
USING (invitation_code IS NOT NULL AND patient_id IS NULL)
WITH CHECK (auth.uid() = patient_id);