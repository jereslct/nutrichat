import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUUID = (id: string): boolean => UUID_REGEX.test(id);

const VALID_ACTIONS = ['send_request', 'accept_request', 'reject_request', 'cancel_request'] as const;

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

    const body = await req.json();
    const { action, target_id, request_id } = body;

    // Input validation
    if (!action || !VALID_ACTIONS.includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Acción no válida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'send_request' && (!target_id || !isValidUUID(target_id))) {
      return new Response(
        JSON.stringify({ error: 'target_id inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (['accept_request', 'reject_request', 'cancel_request'].includes(action) && (!request_id || !isValidUUID(request_id))) {
      return new Response(
        JSON.stringify({ error: 'request_id inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get service role client
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user's role from SECURE user_roles table (not profiles!)
    const { data: roleData } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    const userRole = roleData?.role;

    // Handle different actions
    switch (action) {
      case 'send_request': {
        // Create a new link request
        const { error: insertError } = await serviceClient
          .from('link_requests')
          .insert({
            requester_id: userId,
            target_id: target_id,
            requester_role: userRole,
            status: 'pending',
          });

        if (insertError) {
          if (insertError.code === '23505') {
            return new Response(
              JSON.stringify({ error: 'Ya existe una solicitud pendiente' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          throw insertError;
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Solicitud enviada correctamente' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'accept_request': {
        // Get the request
        const { data: request, error: reqError } = await serviceClient
          .from('link_requests')
          .select('*')
          .eq('id', request_id)
          .eq('target_id', userId)
          .eq('status', 'pending')
          .single();

        if (reqError || !request) {
          return new Response(
            JSON.stringify({ error: 'Solicitud no encontrada' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Determine doctor and patient IDs
        const doctorId = request.requester_role === 'doctor' ? request.requester_id : userId;
        const patientId = request.requester_role === 'patient' ? request.requester_id : userId;

        // Check doctor's license availability
        const { data: doctorProfile } = await serviceClient
          .from('profiles')
          .select('subscription_status, plan_tier, licenses_count')
          .eq('id', doctorId)
          .single();

        let premiumGranted = false;
        let licensesAvailable = 0;

        if (doctorProfile &&
            doctorProfile.subscription_status === 'active' &&
            (doctorProfile.plan_tier === 'doctor_basic' || doctorProfile.plan_tier === 'doctor_pro') &&
            doctorProfile.licenses_count > 0) {
          const { count: currentPatients } = await serviceClient
            .from('doctor_patients')
            .select('*', { count: 'exact', head: true })
            .eq('doctor_id', doctorId)
            .not('patient_id', 'is', null);

          licensesAvailable = doctorProfile.licenses_count - (currentPatients ?? 0);
          premiumGranted = licensesAvailable > 0;
        }

        // Create doctor-patient relationship
        const { error: relError } = await serviceClient
          .from('doctor_patients')
          .insert({
            doctor_id: doctorId,
            patient_id: patientId,
            assigned_by: 'invitation',
          });

        if (relError && relError.code !== '23505') throw relError;

        // Update request status
        await serviceClient
          .from('link_requests')
          .update({ status: 'accepted' })
          .eq('id', request_id);

        const message = premiumGranted
          ? 'Solicitud aceptada. El paciente tiene acceso premium a través de tu licencia.'
          : 'Solicitud aceptada';

        return new Response(
          JSON.stringify({
            success: true,
            message,
            premium_granted: premiumGranted,
            licenses_available: Math.max(0, licensesAvailable - 1),
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'reject_request': {
        await serviceClient
          .from('link_requests')
          .update({ status: 'rejected' })
          .eq('id', request_id)
          .eq('target_id', userId);

        return new Response(
          JSON.stringify({ success: true, message: 'Solicitud rechazada' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'cancel_request': {
        await serviceClient
          .from('link_requests')
          .delete()
          .eq('id', request_id)
          .eq('requester_id', userId)
          .eq('status', 'pending');

        return new Response(
          JSON.stringify({ success: true, message: 'Solicitud cancelada' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Acción no válida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
