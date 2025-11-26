import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error("Usuario no autenticado");
    }

    const { message, dietId } = await req.json();

    if (!message || !dietId) {
      throw new Error("Mensaje y dietId son requeridos");
    }

    console.log("Procesando mensaje:", message, "para dieta:", dietId);

    // Obtener la dieta del usuario
    const { data: diet, error: dietError } = await supabaseClient
      .from("diets")
      .select("*")
      .eq("id", dietId)
      .eq("user_id", user.id)
      .single();

    if (dietError || !diet) {
      throw new Error("Dieta no encontrada");
    }

    // Obtener historial reciente de mensajes
    const { data: recentMessages } = await supabaseClient
      .from("chat_messages")
      .select("role, content")
      .eq("diet_id", dietId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Construir el contexto para la IA
    const systemPrompt = `Eres un asistente nutricional experto y amigable. Tu rol es ayudar al usuario a entender su plan nutricional y responder preguntas sobre él.

PLAN NUTRICIONAL DEL USUARIO:
${diet.content}

Instrucciones:
- Responde de forma clara, concisa y profesional
- Basa tus respuestas en el contenido del plan nutricional proporcionado
- Si la pregunta no se relaciona con nutrición, redirige amablemente al tema
- Sé empático y motivador
- Si algo no está claro en el plan, indícalo honestamente
- Usa formato legible con saltos de línea cuando sea apropiado`;

    const messages = [
      { role: "system", content: systemPrompt },
    ];

    // Agregar historial reciente (invertido para orden cronológico)
    if (recentMessages) {
      recentMessages.reverse().forEach(msg => {
        messages.push({ role: msg.role, content: msg.content });
      });
    }

    // Agregar mensaje actual del usuario
    messages.push({ role: "user", content: message });

    // Llamar a Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY no configurada");
    }

    console.log("Llamando a Lovable AI...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Error de Lovable AI:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error("Límite de uso excedido. Por favor intenta de nuevo más tarde.");
      }
      if (aiResponse.status === 402) {
        throw new Error("Se requiere agregar créditos a tu workspace de Lovable AI.");
      }
      throw new Error("Error llamando a la IA");
    }

    const aiData = await aiResponse.json();
    const assistantResponse = aiData.choices[0].message.content;

    console.log("Respuesta de IA obtenida, longitud:", assistantResponse.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        response: assistantResponse 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error en chat:", error);
    const errorMessage = error instanceof Error ? error.message : "Error procesando chat";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});