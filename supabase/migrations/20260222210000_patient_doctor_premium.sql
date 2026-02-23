-- Check whether a patient is covered by a doctor's premium license.
-- Returns TRUE if the patient is linked (via doctor_patients) to at least one
-- doctor whose subscription is active, whose plan is a doctor plan, and who
-- still has capacity (number of linked patients <= licenses_count).
-- Patients are ranked by assigned_at so that the earliest-linked patients are
-- covered first when a doctor exceeds their license limit.

CREATE OR REPLACE FUNCTION public.patient_has_doctor_premium(p_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM doctor_patients dp
    JOIN profiles doc ON doc.id = dp.doctor_id
    WHERE dp.patient_id = p_patient_id
      AND doc.subscription_status = 'active'
      AND doc.plan_tier IN ('doctor_basic', 'doctor_pro')
      AND doc.licenses_count > 0
      AND (
        SELECT COUNT(*)
        FROM doctor_patients dp2
        WHERE dp2.doctor_id = dp.doctor_id
          AND dp2.patient_id IS NOT NULL
          AND dp2.assigned_at <= dp.assigned_at
      ) <= doc.licenses_count
  );
$$;
