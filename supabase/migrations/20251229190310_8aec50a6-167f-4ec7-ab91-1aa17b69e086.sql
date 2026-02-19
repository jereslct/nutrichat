-- Make the avatars bucket private to prevent public enumeration
UPDATE storage.buckets 
SET public = false 
WHERE id = 'avatars';

-- Add SELECT policy for authenticated users to view any avatar
-- (needed for doctor-patient viewing functionality)
CREATE POLICY "Authenticated users can view avatars"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'avatars' 
  AND auth.role() = 'authenticated'
);