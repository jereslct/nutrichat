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
        JSON.stringify({ error: 'Solo médicos pueden generar resúmenes' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { patient_id } = await req.json();

    if (!patient_id) {
      return new Response(
        JSON.stringify({ error: 'patient_id es requerido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get service role client for accessing all data
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verificar que el paciente está asignado a este médico
    const { data: relationship } = await serviceClient
      .from('doctor_patients')
      .select('id')
      .eq('doctor_id', user.id)
      .eq('patient_id', patient_id)
      .maybeSingle();

    if (!relationship) {
      return new Response(
        JSON.stringify({ error: 'Este paciente no está asignado a ti' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener mensajes del chat del paciente (últimos 100) usando service role
    const { data: messages, error: messagesError } = await serviceClient
      .from('chat_messages')
      .select('content, role, created_at')
      .eq('user_id', patient_id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (messagesError) throw messagesError;

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ success: true, no_messages: true, message: 'No hay mensajes para analizar' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar historial para la IA
    const chatHistory = messages.reverse().map(m => 
      `${m.role === 'user' ? 'Paciente' : 'Asistente'}: ${m.content}`
    ).join('\n\n');

    // Llamar a Lovable AI para generar el resumen
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY no configurada');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Eres un asistente médico especializado en análisis de conversaciones nutricionales. 
Tu tarea es analizar el historial de chat entre un paciente y su asistente nutricional, y generar un resumen médico estructurado en formato JSON.

Debes devolver SOLO un objeto JSON válido con esta estructura exacta:
{
  "resumen_general": "string - Resumen ejecutivo de 2-3 líneas",
  "temas_principales": ["string", "string", ...] - Array de 3-5 temas principales discutidos,
  "preocupaciones_clave": ["string", "string", ...] - Array de 2-4 preocupaciones o problemas identificados,
  "patrones_detectados": "string - Descripción de patrones de comportamiento o consultas recurrentes",
  "recomendaciones_medicas": "string - Sugerencias para el médico sobre seguimiento o áreas de atención"
}

NO agregues texto adicional, solo el JSON.`
          },
          {
            role: 'user',
            content: `Analiza el siguiente historial de conversaciones del paciente:\n\n${chatHistory}`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Error de IA:', errorText);
      throw new Error('Error al generar resumen con IA');
    }

    const aiData = await aiResponse.json();
    const summaryText = aiData.choices[0].message.content;

    // Parsear el JSON del resumen (manejar respuestas con markdown)
    let parsedSummary;
    try {
      let jsonText = summaryText.trim();
      
      // Remover bloques de código markdown si existen
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.slice(7);
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.slice(3);
      }
      if (jsonText.endsWith('```')) {
        jsonText = jsonText.slice(0, -3);
      }
      jsonText = jsonText.trim();
      
      parsedSummary = JSON.parse(jsonText);
    } catch (e) {
      console.error('Error parseando JSON de IA:', summaryText);
      throw new Error('La IA no devolvió un JSON válido');
    }

    // Guardar en la base de datos
    const lastMessageDate = messages[messages.length - 1]?.created_at;
    const patientMessagesCount = messages.filter(m => m.role === 'user').length;

    const { data: savedSummary, error: saveError } = await serviceClient
      .from('patient_summaries')
      .upsert({
        patient_id,
        doctor_id: user.id,
        summary_text: JSON.stringify(parsedSummary),
        topics: parsedSummary.temas_principales || [],
        key_concerns: parsedSummary.preocupaciones_clave || [],
        chat_messages_analyzed: patientMessagesCount,
        last_chat_date: lastMessageDate,
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
