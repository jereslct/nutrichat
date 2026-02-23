import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    // Verificar que el usuario es paciente usando la tabla SEGURA user_roles (no profiles!)
    const { data: roleData } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'patient') {
      return new Response(
        JSON.stringify({ error: 'Solo pacientes pueden acceder' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener IDs de doctores desde user_roles (excluyendo super_admin)
    const { data: doctorRoles, error: rolesError } = await serviceClient
      .from('user_roles')
      .select('user_id')
      .eq('role', 'doctor');

    if (rolesError) throw rolesError;

    // Obtener IDs de super_admins para excluirlos
    const { data: superAdminRoles } = await serviceClient
      .from('user_roles')
      .select('user_id')
      .eq('role', 'super_admin');

    const superAdminIds = new Set((superAdminRoles || []).map((r: any) => r.user_id));

    // Filtrar doctores que no sean super_admin
    const doctorIds = (doctorRoles || [])
      .map((r: any) => r.user_id)
      .filter((id: string) => !superAdminIds.has(id));

    if (doctorIds.length === 0) {
      return new Response(
        JSON.stringify({ doctors: [], current_doctor_id: null }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener perfiles de doctores
    const { data: allDoctors, error: doctorsError } = await serviceClient
      .from('profiles')
      .select('id, full_name, avatar_url, specialty')
      .in('id', doctorIds)
      .order('full_name', { ascending: true });

    if (doctorsError) throw doctorsError;

    // Obtener todas las relaciones del paciente (puede tener múltiples médicos)
    const { data: existingRelations } = await serviceClient
      .from('doctor_patients')
      .select('doctor_id')
      .eq('patient_id', user.id);
    
    const linkedDoctorIds = (existingRelations || []).map((r: any) => r.doctor_id);

    // Obtener solicitudes pendientes
    const { data: pendingRequests } = await serviceClient
      .from('link_requests')
      .select('*')
      .or(`requester_id.eq.${user.id},target_id.eq.${user.id}`)
      .eq('status', 'pending');

    // Enriquecer datos de doctores
    const doctorsData = (allDoctors || []).map((doctor: any) => {
      const isLinked = linkedDoctorIds.includes(doctor.id);

      const pendingRequest = (pendingRequests || []).find(
        (r: any) => 
          (r.requester_id === user.id && r.target_id === doctor.id) ||
          (r.target_id === user.id && r.requester_id === doctor.id)
      );

      return {
        id: doctor.id,
        full_name: doctor.full_name,
        avatar_url: doctor.avatar_url,
        specialty: doctor.specialty || 'Médico',
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
      JSON.stringify({ 
        doctors: doctorsData,
        current_doctor_id: linkedDoctorIds.length > 0 ? linkedDoctorIds[0] : null,
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
