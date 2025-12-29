-- Prevent users from inserting roles (only system/triggers can)
CREATE POLICY "Only system can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (false);

-- Prevent users from updating roles  
CREATE POLICY "Only system can update roles"
ON public.user_roles FOR UPDATE
USING (false);

-- Prevent users from deleting roles
CREATE POLICY "Only system can delete roles"
ON public.user_roles FOR DELETE
USING (false);