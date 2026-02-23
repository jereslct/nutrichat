import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPER_ADMIN_EMAIL = "admin@nutrichat.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is super admin (by email or role)
    const isSuperAdminByEmail = user.email === SUPER_ADMIN_EMAIL;
    
    let isSuperAdminByRole = false;
    if (!isSuperAdminByEmail) {
      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      
      isSuperAdminByRole = roleData?.role === "super_admin";
    }

    if (!isSuperAdminByEmail && !isSuperAdminByRole) {
      return new Response(
        JSON.stringify({ error: "Access denied. Super admin only." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Super admin verified:", user.email);

    // Fetch all profiles with their roles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (profilesError) {
      console.error("Profiles error:", profilesError);
      throw profilesError;
    }

    // Fetch all user roles
    const { data: userRoles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");

    if (rolesError) {
      console.error("Roles error:", rolesError);
      throw rolesError;
    }

    // Fetch auth users to get emails
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      console.error("Auth users error:", authError);
      throw authError;
    }

    // Create a map of user_id to email
    const emailMap = new Map<string, string>();
    authUsers.users.forEach((u) => {
      emailMap.set(u.id, u.email || "");
    });

    // Create a map of user_id to role
    const roleMap = new Map<string, string>();
    userRoles?.forEach((r) => {
      roleMap.set(r.user_id, r.role);
    });

    // Combine data
    const usersWithDetails = profiles?.map((profile) => ({
      ...profile,
      email: emailMap.get(profile.id) || "",
      db_role: roleMap.get(profile.id) || profile.role || "patient",
    })) || [];

    // Calculate KPIs
    const totalUsers = usersWithDetails.length;
    const premiumUsers = usersWithDetails.filter((u) => u.is_premium).length;
    const doctors = usersWithDetails.filter((u) => u.db_role === "doctor").length;
    const patients = usersWithDetails.filter((u) => u.db_role === "patient").length;
    
    const PLAN_PRICES: Record<string, number> = {
      individual: 16999,
      doctor_basic: 27999,
      doctor_pro: 43999,
    };

    const revenueBreakdown: { plan: string; count: number; unitPrice: number; subtotal: number }[] = [];
    const planCounts = new Map<string, number>();

    for (const u of usersWithDetails) {
      if (!u.is_premium || !u.plan_tier) continue;
      const price = PLAN_PRICES[u.plan_tier];
      if (!price) continue; // patient_premium (admin-granted) or unknown → no revenue
      planCounts.set(u.plan_tier, (planCounts.get(u.plan_tier) || 0) + 1);
    }

    for (const [plan, count] of planCounts.entries()) {
      const unitPrice = PLAN_PRICES[plan];
      revenueBreakdown.push({ plan, count, unitPrice, subtotal: count * unitPrice });
    }

    const monthlyRevenue = revenueBreakdown.reduce((sum, r) => sum + r.subtotal, 0);

    // Get user growth data (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentUsers = usersWithDetails.filter(
      (u) => new Date(u.created_at) >= thirtyDaysAgo
    ).length;

    console.log(`Dashboard data: ${totalUsers} users, ${premiumUsers} premium, ${doctors} doctors, revenue: ${monthlyRevenue}`);

    return new Response(
      JSON.stringify({
        kpis: {
          totalUsers,
          premiumUsers,
          doctors,
          patients,
          monthlyRevenue,
          revenueBreakdown,
          recentUsers,
        },
        users: usersWithDetails,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Admin dashboard error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
