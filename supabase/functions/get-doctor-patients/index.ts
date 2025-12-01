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

    // Verificar que el usuario es médico
    const { data: userData } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'doctor') {
      return new Response(
        JSON.stringify({ error: 'Solo médicos pueden acceder' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    // Obtener pacientes del médico
    const { data: relationships, error: relError } = await supabaseClient
      .from('doctor_patients')
      .select(`
        id,
        assigned_at,
        patient_id,
        profiles!doctor_patients_patient_id_fkey (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('doctor_id', user.id)
      .order('assigned_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (relError) throw relError;

    const { count } = await supabaseClient
      .from('doctor_patients')
      .select('*', { count: 'exact', head: true })
      .eq('doctor_id', user.id);

    // Enriquecer datos de cada paciente
    const patientsData = await Promise.all(
      (relationships || []).map(async (rel: any) => {
        const patientId = rel.patient_id;

        // Última actividad en chat
        const { data: lastMessage } = await supabaseClient
          .from('chat_messages')
          .select('created_at')
          .eq('user_id', patientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        // Total de mensajes
        const { count: messageCount } = await supabaseClient
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', patientId);

        // Verificar si tiene dieta
        const { data: diet } = await supabaseClient
          .from('diets')
          .select('id')
          .eq('user_id', patientId)
          .limit(1)
          .maybeSingle();

        return {
          id: rel.profiles.id,
          full_name: rel.profiles.full_name,
          avatar_url: rel.profiles.avatar_url,
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
