-- Create a function to check if user is super admin (by role or specific email)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'::app_role
  )
  OR EXISTS (
    SELECT 1
    FROM auth.users
    WHERE id = _user_id
      AND email = 'admin@nutrichat.com'
  )
$$;

-- RLS policy for super admin to view all profiles
CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- RLS policy for super admin to update all profiles
CREATE POLICY "Super admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (public.is_super_admin(auth.uid()));

-- RLS policy for super admin to view all user_roles
CREATE POLICY "Super admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.is_super_admin(auth.uid()));

-- Allow super admin to insert roles (for creating new admins)
CREATE POLICY "Super admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()));