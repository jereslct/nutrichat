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

    const { data: relationships } = await serviceClient
      .from('doctor_patients')
      .select('patient_id, assigned_at')
      .eq('doctor_id', userId)
      .not('patient_id', 'is', null);

    const patientIds = (relationships || []).map((r: any) => r.patient_id).filter(Boolean);

    const emptyResponse = {
      daily_messages: [],
      weekly_comparison: { current: 0, previous: 0 },
      patient_stats: [],
      summary: {
        total_patients: 0,
        active_patients: 0,
        moderate_patients: 0,
        inactive_patients: 0,
        total_messages_30d: 0,
        patients_with_diet: 0,
        avg_messages_per_patient: 0,
      },
    };

    if (patientIds.length === 0) {
      return new Response(
        JSON.stringify(emptyResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: messages } = await serviceClient
      .from('chat_messages')
      .select('user_id, created_at')
      .in('user_id', patientIds)
      .eq('role', 'user')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true });

    const dailyMap: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      dailyMap[d.toISOString().split('T')[0]] = 0;
    }

    let currentWeekCount = 0;
    let previousWeekCount = 0;

    (messages || []).forEach((m: any) => {
      const date = m.created_at.split('T')[0];
      if (dailyMap[date] !== undefined) {
        dailyMap[date]++;
      }
      const msgTime = new Date(m.created_at).getTime();
      if (msgTime >= sevenDaysAgo.getTime()) {
        currentWeekCount++;
      } else if (msgTime >= fourteenDaysAgo.getTime()) {
        previousWeekCount++;
      }
    });

    const daily_messages = Object.entries(dailyMap).map(([date, count]) => ({
      date,
      count,
    }));

    const perPatientMessages: Record<string, number> = {};
    (messages || []).forEach((m: any) => {
      perPatientMessages[m.user_id] = (perPatientMessages[m.user_id] || 0) + 1;
    });

    const patientStatsPromises = patientIds.map(async (patientId: string) => {
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('id, full_name')
        .eq('id', patientId)
        .single();

      const { count: totalMessages } = await serviceClient
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', patientId)
        .eq('role', 'user');

      const { data: lastMsg } = await serviceClient
        .from('chat_messages')
        .select('created_at')
        .eq('user_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: diet } = await serviceClient
        .from('diets')
        .select('id')
        .eq('user_id', patientId)
        .limit(1)
        .maybeSingle();

      const rel = (relationships || []).find((r: any) => r.patient_id === patientId);

      return {
        id: patientId,
        full_name: profile?.full_name || 'Sin nombre',
        total_messages: totalMessages || 0,
        messages_30d: perPatientMessages[patientId] || 0,
        last_activity: lastMsg?.created_at || null,
        has_diet: !!diet,
        assigned_at: rel?.assigned_at || null,
      };
    });

    const patient_stats = await Promise.all(patientStatsPromises);

    const nowMs = now.getTime();
    let active = 0, moderate = 0, inactive = 0;
    patient_stats.forEach((p) => {
      if (!p.last_activity) {
        inactive++;
        return;
      }
      const days = Math.floor((nowMs - new Date(p.last_activity).getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 3) active++;
      else if (days <= 7) moderate++;
      else inactive++;
    });

    const totalMsg30d = (messages || []).length;

    return new Response(
      JSON.stringify({
        daily_messages,
        weekly_comparison: {
          current: currentWeekCount,
          previous: previousWeekCount,
        },
        patient_stats: patient_stats.sort((a, b) => b.total_messages - a.total_messages),
        summary: {
          total_patients: patientIds.length,
          active_patients: active,
          moderate_patients: moderate,
          inactive_patients: inactive,
          total_messages_30d: totalMsg30d,
          patients_with_diet: patient_stats.filter((p) => p.has_diet).length,
          avg_messages_per_patient: patientIds.length > 0
            ? Math.round((totalMsg30d / patientIds.length) * 10) / 10
            : 0,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
