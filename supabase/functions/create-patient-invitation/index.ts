import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client to check secure user_roles table (not modifiable by users)
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify doctor role from secure user_roles table
    const { data: roleData } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'doctor') {
      return new Response(
        JSON.stringify({ error: 'Solo médicos pueden crear invitaciones' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get doctor's name from profiles (only for display purposes)
    const { data: userData } = await supabaseClient
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

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
        doctor_id: user.id,
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
