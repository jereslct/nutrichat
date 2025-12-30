import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

const SUPER_ADMIN_EMAIL = 'admin@nutrichat.com';

interface SuperAdminState {
  user: User | null;
  isSuperAdmin: boolean;
  loading: boolean;
}

export const useSuperAdmin = () => {
  const [state, setState] = useState<SuperAdminState>({
    user: null,
    isSuperAdmin: false,
    loading: true,
  });

  useEffect(() => {
    const checkSuperAdmin = async (user: User | null) => {
      if (!user) {
        setState({ user: null, isSuperAdmin: false, loading: false });
        return;
      }

      // Check by email first
      if (user.email === SUPER_ADMIN_EMAIL) {
        setState({ user, isSuperAdmin: true, loading: false });
        return;
      }

      // Check by role in user_roles table
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      const isSuperAdmin = roleData?.role === 'super_admin';
      setState({ user, isSuperAdmin, loading: false });
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          setState({ user: null, isSuperAdmin: false, loading: false });
        } else if (session?.user) {
          setTimeout(() => checkSuperAdmin(session.user), 0);
        }
      }
    );

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      checkSuperAdmin(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
};
