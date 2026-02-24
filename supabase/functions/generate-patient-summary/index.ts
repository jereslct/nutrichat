import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithTimeout } from "../_shared/fetchWithTimeout.ts";
import { logTokenUsage } from "../_shared/tokenTracking.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isValidUUID = (id: string): boolean => UUID_REGEX.test(id);

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
        JSON.stringify({ error: 'Solo médicos pueden generar resúmenes' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { patient_id } = await req.json();

    // Input validation
    if (!patient_id || !isValidUUID(patient_id)) {
      return new Response(
        JSON.stringify({ error: 'patient_id inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar que el paciente está asignado a este médico
    const { data: relationship } = await serviceClient
      .from('doctor_patients')
      .select('id')
      .eq('doctor_id', userId)
      .eq('patient_id', patient_id)
      .maybeSingle();

    if (!relationship) {
      return new Response(
        JSON.stringify({ error: 'Este paciente no está asignado a ti' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== FETCH EXISTING SUMMARY ==========
    const { data: existingSummary } = await serviceClient
      .from('patient_summaries')
      .select('id, summary_text, last_summarized_at')
      .eq('patient_id', patient_id)
      .eq('doctor_id', userId)
      .maybeSingle();

    const isIncremental = !!existingSummary?.last_summarized_at;

    // ========== FETCH MESSAGES ==========
    // Incremental: only messages newer than last_summarized_at
    // Full: last 50 messages
    let messagesQuery = serviceClient
      .from('chat_messages')
      .select('content, role, created_at')
      .eq('user_id', patient_id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (isIncremental) {
      messagesQuery = messagesQuery.gt('created_at', existingSummary.last_summarized_at);
    }

    const { data: messages, error: messagesError } = await messagesQuery;

    if (messagesError) throw messagesError;

    // No new messages since last summary — return cached result
    if (isIncremental && (!messages || messages.length === 0)) {
      console.log(`No hay mensajes nuevos para ${patient_id} desde ${existingSummary.last_summarized_at}`);
      const cached = JSON.parse(existingSummary.summary_text);
      return new Response(
        JSON.stringify({
          success: true,
          cached: true,
          summary: { ...cached, id: existingSummary.id },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ success: true, no_messages: true, message: 'No hay mensajes para analizar' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filtrar mensajes triviales antes de enviar a la IA
    const TRIVIAL_PATTERNS = /^(ok|okay|gracias|thanks|hola|hi|hello|sí|si|no|bien|perfecto|dale|genial|claro|entendido|bueno)\s*[!.]*$/i;
    const meaningfulMessages = messages.filter(m =>
      m.content.trim().length > 20 && !TRIVIAL_PATTERNS.test(m.content.trim())
    );

    // Preparar historial para la IA
    const chatHistory = meaningfulMessages.reverse().map(m =>
      `${m.role === 'user' ? 'Paciente' : 'Asistente'}: ${m.content}`
    ).join('\n');

    // ========== BUILD PROMPT ==========
    const JSON_SCHEMA = `{
  "resumen_general": "string - Resumen ejecutivo de 2-3 líneas",
  "temas_principales": ["string", ...] - Array de 3-5 temas principales discutidos,
  "preocupaciones_clave": ["string", ...] - Array de 2-4 preocupaciones o problemas identificados,
  "patrones_detectados": "string - Descripción de patrones de comportamiento o consultas recurrentes",
  "recomendaciones_medicas": "string - Sugerencias para el médico sobre seguimiento o áreas de atención"
}`;

    const systemContent = isIncremental
      ? `Eres un asistente médico. Ya existe un resumen previo del paciente. Tu tarea es ACTUALIZARLO incorporando solo los mensajes nuevos que se te envían.

RESUMEN PREVIO:
${existingSummary.summary_text}

Devolvé un objeto JSON con la misma estructura, fusionando la información anterior con la nueva. No elimines datos relevantes del resumen previo.
Estructura: ${JSON_SCHEMA}

NO agregues texto adicional, solo el JSON.`
      : `Eres un asistente médico especializado en análisis de conversaciones nutricionales.
Tu tarea es analizar el historial de chat y generar un resumen médico estructurado en formato JSON.

Estructura: ${JSON_SCHEMA}

NO agregues texto adicional, solo el JSON.`;

    const userContent = isIncremental
      ? `Mensajes nuevos a incorporar al resumen:\n\n${chatHistory}`
      : `Analiza el siguiente historial de conversaciones del paciente:\n\n${chatHistory}`;

    // Llamar a Lovable AI para generar el resumen
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY no configurada');
    }

    const aiResponse = await fetchWithTimeout('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent },
        ],
      }),
      timeout: 30_000,
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Error de IA:', errorText);
      throw new Error('Error al generar resumen con IA');
    }

    const aiData = await aiResponse.json();
    await logTokenUsage(serviceClient, userId, "generate-patient-summary", aiData);

    const summaryText = aiData.choices[0].message.content;

    // response_format: json_object garantiza JSON válido — parse directo
    let parsedSummary;
    try {
      parsedSummary = JSON.parse(summaryText);
    } catch (e) {
      console.error('Error parseando JSON de IA:', summaryText);
      throw new Error('La IA no devolvió un JSON válido');
    }

    // ========== SAVE ==========
    const lastMessageDate = messages[messages.length - 1]?.created_at;
    const patientMessagesCount = meaningfulMessages.filter(m => m.role === 'user').length;
    const now = new Date().toISOString();

    const { data: savedSummary, error: saveError } = await serviceClient
      .from('patient_summaries')
      .upsert({
        patient_id,
        doctor_id: userId,
        summary_text: JSON.stringify(parsedSummary),
        topics: parsedSummary.temas_principales || [],
        key_concerns: parsedSummary.preocupaciones_clave || [],
        chat_messages_analyzed: patientMessagesCount,
        last_chat_date: lastMessageDate,
        last_summarized_at: now,
      }, {
        onConflict: 'patient_id,doctor_id'
      })
      .select()
      .single();

    if (saveError) throw saveError;

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          ...parsedSummary,
          id: savedSummary.id,
          generated_at: savedSummary.generated_at,
          messages_analyzed: patientMessagesCount,
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
