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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;

    // Verificar que el usuario es médico usando la tabla SEGURA user_roles (no profiles!)
    const { data: roleData } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .single();

    if (roleData?.role !== 'doctor') {
      return new Response(
        JSON.stringify({ error: 'Solo médicos pueden acceder' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100);
    const search = url.searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    if (page < 1 || limit < 1) {
      return new Response(
        JSON.stringify({ error: 'Parámetros de paginación inválidos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all patient IDs for this doctor in one query (no pagination here —
    // search filtering happens later, so pagination must be applied after)
    const { data: allRelationships, error: relError } = await serviceClient
      .from('doctor_patients')
      .select('assigned_at, patient_id')
      .eq('doctor_id', userId)
      .not('patient_id', 'is', null)
      .order('assigned_at', { ascending: false });

    if (relError) throw relError;

    if (!allRelationships || allRelationships.length === 0) {
      return new Response(
        JSON.stringify({ patients: [], pagination: { page, limit, total: 0, total_pages: 0 } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allPatientIds = allRelationships.map((r: any) => r.patient_id as string);

    // BATCH 1: profiles — search filter applied at DB level
    let profilesQuery = serviceClient
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', allPatientIds);

    if (search) {
      profilesQuery = profilesQuery.ilike('full_name', `%${search}%`);
    }

    // BATCH 2: messages (last activity + user count aggregated in JS)
    // BATCH 3: diet existence
    // All 3 run in parallel
    const [
      { data: profiles },
      { data: allMessages },
      { data: diets },
    ] = await Promise.all([
      profilesQuery,
      serviceClient
        .from('chat_messages')
        .select('user_id, created_at, role')
        .in('user_id', allPatientIds)
        .order('created_at', { ascending: false }),
      serviceClient
        .from('diets')
        .select('user_id')
        .in('user_id', allPatientIds),
    ]);

    // Aggregate messages in a single pass
    const lastActivityMap = new Map<string, string>();
    const messageCountMap = new Map<string, number>();
    for (const msg of (allMessages || [])) {
      if (!lastActivityMap.has(msg.user_id)) {
        lastActivityMap.set(msg.user_id, msg.created_at);
      }
      if (msg.role === 'user') {
        messageCountMap.set(msg.user_id, (messageCountMap.get(msg.user_id) || 0) + 1);
      }
    }

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
    const dietSet = new Set((diets || []).map((d: any) => d.user_id as string));
    const matchedIds = new Set((profiles || []).map((p: any) => p.id as string));

    // Build full list filtered by search, maintaining assigned_at order
    const fullList = allRelationships
      .filter((r: any) => matchedIds.has(r.patient_id))
      .map((r: any) => {
        const profile = profileMap.get(r.patient_id);
        return {
          id: r.patient_id,
          full_name: profile?.full_name || null,
          avatar_url: profile?.avatar_url || null,
          last_activity: lastActivityMap.get(r.patient_id) || null,
          total_messages: messageCountMap.get(r.patient_id) || 0,
          has_diet: dietSet.has(r.patient_id),
          assigned_at: r.assigned_at,
        };
      });

    const total = fullList.length;
    const paginatedList = fullList.slice(offset, offset + limit);

    return new Response(
      JSON.stringify({
        patients: paginatedList,
        pagination: {
          page,
          limit,
          total,
          total_pages: Math.ceil(total / limit),
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
