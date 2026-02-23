import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function generateInvitationCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: authError } = await supabaseClient.auth.getClaims(token);

    if (authError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub as string;

    // Use service role client to check secure user_roles table (not modifiable by users)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify doctor role from secure user_roles table
    const { data: roleData } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (roleData?.role !== 'doctor') {
      return new Response(
        JSON.stringify({ error: 'Solo médicos pueden crear invitaciones' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get doctor's profile including licenses_count
    const { data: userData } = await serviceClient
      .from('profiles')
      .select('full_name, licenses_count, subscription_status, plan_tier')
      .eq('id', userId)
      .single();

    // Check if doctor has available licenses (only for premium plans with licenses)
    const hasPremiumPlan = userData?.subscription_status === 'active' && 
                           (userData?.plan_tier === 'doctor_basic' || userData?.plan_tier === 'doctor_pro');
    
    if (hasPremiumPlan) {
      const licensesCount = userData?.licenses_count || 0;
      
      // Count current active patients
      const { count: activePatients } = await serviceClient
        .from('doctor_patients')
        .select('*', { count: 'exact', head: true })
        .eq('doctor_id', userId)
        .not('patient_id', 'is', null);

      const usedLicenses = activePatients || 0;
      
      if (usedLicenses >= licensesCount) {
        return new Response(
          JSON.stringify({ 
            error: 'Sin licencias disponibles',
            details: `Has utilizado todas tus ${licensesCount} licencias. Actualiza tu plan para agregar más pacientes.`,
            licenses_used: usedLicenses,
            licenses_total: licensesCount,
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`Doctor ${userId} has ${licensesCount - usedLicenses} licenses available (${usedLicenses}/${licensesCount} used)`);
    }

    // Generar código único
    let invitationCode = generateInvitationCode();
    let attempts = 0;

    while (attempts < 5) {
      const { data: existing } = await supabaseClient
        .from('doctor_patients')
        .select('id')
        .eq('invitation_code', invitationCode)
        .maybeSingle();

      if (!existing) break;
      
      invitationCode = generateInvitationCode();
      attempts++;
    }

    if (attempts >= 5) {
      throw new Error('No se pudo generar un código único');
    }

    // Crear invitación pendiente
    const { data: invitation, error: invError } = await supabaseClient
      .from('doctor_patients')
      .insert({
        doctor_id: userId,
        patient_id: null,
        invitation_code: invitationCode,
        assigned_by: 'invitation',
      })
      .select()
      .single();

    if (invError) throw invError;

    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:5173';
    const invitationUrl = `${appUrl}/auth?code=${invitationCode}`;

    return new Response(
      JSON.stringify({
        success: true,
        invitation_code: invitationCode,
        invitation_url: invitationUrl,
        doctor_name: userData?.full_name ?? 'Doctor',
        message: 'Código de invitación generado. Compártelo con tu paciente.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
