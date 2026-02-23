import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
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

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100); // Max 100
    const search = url.searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    // Validate pagination params
    if (page < 1 || limit < 1) {
      return new Response(
        JSON.stringify({ error: 'Parámetros de paginación inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener pacientes del médico
    const { data: relationships, error: relError } = await serviceClient
      .from('doctor_patients')
      .select('id, assigned_at, patient_id')
      .eq('doctor_id', user.id)
      .not('patient_id', 'is', null)
      .order('assigned_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (relError) throw relError;

    const { count } = await serviceClient
      .from('doctor_patients')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', user.id)
      .not('patient_id', 'is', null);

    // Enriquecer datos de cada paciente
    const patientsData = await Promise.all(
      (relationships || []).map(async (rel: any) => {
        const patientId = rel.patient_id;

        // Get patient profile
        const { data: profile } = await serviceClient
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', patientId)
          .single();

        // Última actividad en chat
        const { data: lastMessage } = await serviceClient
          .from('chat_messages')
          .select('created_at')
          .eq('user_id', patientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Total de mensajes (solo del paciente, no del asistente)
        const { count: messageCount } = await serviceClient
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', patientId)
          .eq('role', 'user');

        // Verificar si tiene dieta
        const { data: diet } = await serviceClient
          .from('diets')
          .select('id')
          .eq('user_id', patientId)
          .limit(1)
          .maybeSingle();

        return {
          id: profile?.id || patientId,
          full_name: profile?.full_name || null,
          avatar_url: profile?.avatar_url || null,
          last_activity: lastMessage?.created_at || null,
          total_messages: messageCount || 0,
          has_diet: !!diet,
          assigned_at: rel.assigned_at,
        };
      })
    );

    return new Response(
      JSON.stringify({
        patients: patientsData,
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
        },
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
