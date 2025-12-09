import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    // Get service role client for accessing all data
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar que el usuario es médico usando la tabla SEGURA user_roles (no profiles!)
    const { data: roleData } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'doctor') {
      return new Response(
        JSON.stringify({ error: 'Solo médicos pueden acceder' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener IDs de pacientes desde user_roles
    const { data: patientRoles, error: rolesError } = await serviceClient
      .from('user_roles')
      .select('user_id')
      .eq('role', 'patient');

    if (rolesError) throw rolesError;

    const patientIds = (patientRoles || []).map((r: any) => r.user_id);

    if (patientIds.length === 0) {
      return new Response(
        JSON.stringify({ patients: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener perfiles de pacientes
    const { data: allPatients, error: patientsError } = await serviceClient
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', patientIds)
      .order('full_name', { ascending: true });

    if (patientsError) throw patientsError;

    // Obtener relaciones existentes del doctor
    const { data: existingRelations } = await serviceClient
      .from('doctor_patients')
      .select('patient_id')
      .eq('doctor_id', user.id)
      .not('patient_id', 'is', null);

    const linkedPatientIds = new Set((existingRelations || []).map((r: any) => r.patient_id));

    // Obtener solicitudes pendientes
    const { data: pendingRequests } = await serviceClient
      .from('link_requests')
      .select('*')
      .or(`requester_id.eq.${user.id},target_id.eq.${user.id}`)
      .eq('status', 'pending');

    // Enriquecer datos de pacientes
    const patientsData = (allPatients || []).map((patient: any) => {
      // Check if linked
      const isLinked = linkedPatientIds.has(patient.id);

      // Check pending requests
      const pendingRequest = (pendingRequests || []).find(
        (r: any) => 
          (r.requester_id === user.id && r.target_id === patient.id) ||
          (r.target_id === user.id && r.requester_id === patient.id)
      );

      return {
        id: patient.id,
        full_name: patient.full_name,
        avatar_url: patient.avatar_url,
        is_linked: isLinked,
        pending_request: pendingRequest ? {
          id: pendingRequest.id,
          status: pendingRequest.status,
          requester_role: pendingRequest.requester_role,
          is_incoming: pendingRequest.target_id === user.id,
        } : null,
      };
    });

    return new Response(
      JSON.stringify({ patients: patientsData }),
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
