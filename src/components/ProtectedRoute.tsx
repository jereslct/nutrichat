import { useState, useEffect, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type RequiredRole = "doctor" | "admin";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: RequiredRole;
}

const SUPER_ADMIN_EMAIL = "admin@nutrichat.com";

interface AuthState {
  loading: boolean;
  authenticated: boolean;
  authorized: boolean;
}

const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
  const [state, setState] = useState<AuthState>({
    loading: true,
    authenticated: false,
    authorized: false,
  });

  useEffect(() => {
    let cancelled = false;

    const resolveAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session?.user) {
        setState({ loading: false, authenticated: false, authorized: false });
        return;
      }

      if (!requiredRole) {
        setState({ loading: false, authenticated: true, authorized: true });
        return;
      }

      if (requiredRole === "admin") {
        if (session.user.email === SUPER_ADMIN_EMAIL) {
          setState({ loading: false, authenticated: true, authorized: true });
          return;
        }

        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (cancelled) return;
        setState({
          loading: false,
          authenticated: true,
          authorized: roleData?.role === "super_admin",
        });
      } else {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (cancelled) return;
        setState({
          loading: false,
          authenticated: true,
          authorized: roleData?.role === requiredRole,
        });
      }
    };

    resolveAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setState({ loading: false, authenticated: false, authorized: false });
      } else if (session?.user) {
        setState((prev) => ({ ...prev, loading: true }));
        setTimeout(() => resolveAuth(), 0);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [requiredRole]);

  if (state.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!state.authenticated) {
    return <Navigate to="/register" replace />;
  }

  if (!state.authorized) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
