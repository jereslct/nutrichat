import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

type AppRole = "patient" | "doctor" | null;

interface UserRoleState {
  user: User | null;
  role: AppRole;
  loading: boolean;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
    licenses_count: number;
    plan_tier: string | null;
  } | null;
}

export const useUserRole = () => {
  const [state, setState] = useState<UserRoleState>({
    user: null,
    role: null,
    loading: true,
    profile: null,
  });

  useEffect(() => {
    const fetchUserAndRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          setState({ user: null, role: null, loading: false, profile: null });
          return;
        }

        // Get role from user_roles table
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();

        // Get profile data
        const { data: profileData } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, licenses_count, plan_tier")
          .eq("id", session.user.id)
          .single();

        setState({
          user: session.user,
          role: (roleData?.role as AppRole) || null,
          loading: false,
          profile: profileData,
        });
      } catch (error) {
        console.error("Error fetching user role:", error);
        setState({ user: null, role: null, loading: false, profile: null });
      }
    };

    fetchUserAndRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setState({ user: null, role: null, loading: false, profile: null });
      } else if (session?.user) {
        // Defer Supabase calls with setTimeout to avoid deadlock
        setTimeout(async () => {
          try {
            const { data: roleData } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", session.user.id)
              .single();

            const { data: profileData } = await supabase
              .from("profiles")
              .select("full_name, avatar_url, licenses_count, plan_tier")
              .eq("id", session.user.id)
              .single();

            setState({
              user: session.user,
              role: (roleData?.role as AppRole) || null,
              loading: false,
              profile: profileData,
            });
          } catch (error) {
            console.error("Error fetching user role on auth change:", error);
            setState({ user: session.user, role: null, loading: false, profile: null });
          }
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
};
