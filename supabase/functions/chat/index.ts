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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Usuario no autenticado: falta header de autorización");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error("Error de autenticación:", authError);
      throw new Error("Usuario no autenticado: " + (authError?.message || "Auth session missing!"));
    }

    console.log("Usuario autenticado:", user.id);

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

    // Construir el contexto para la IA con el sistema prompt y el historial
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

    // Construir el contenido para Google Gemini API
    const contents = [];
    
    // Primero agregamos el contexto del sistema como parte del primer mensaje del usuario
    let firstUserMessage = systemPrompt + "\n\n";
    
    // Agregar historial reciente (invertido para orden cronológico)
    if (recentMessages && recentMessages.length > 0) {
      recentMessages.reverse().forEach(msg => {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }]
        });
      });
      // Si hay historial, el mensaje actual va separado
      contents.push({
        role: "user",
        parts: [{ text: message }]
      });
    } else {
      // Si no hay historial, combinamos el system prompt con el mensaje
      firstUserMessage += message;
      contents.push({
        role: "user",
        parts: [{ text: firstUserMessage }]
      });
    }

    // Obtener la API key de Google AI Studio
    const GOOGLE_API_KEY = Deno.env.get("FoodTalkKey");
    if (!GOOGLE_API_KEY) {
      throw new Error("API key de Google AI Studio no configurada");
    }

    console.log("Llamando a Google Gemini API...");

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GOOGLE_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1000,
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Error de Google Gemini API:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error("Límite de uso excedido. Por favor intenta de nuevo más tarde.");
      }
      throw new Error("Error llamando a Google Gemini API");
    }

    const aiData = await aiResponse.json();
    
    // Extraer la respuesta de la estructura de Gemini
    const assistantResponse = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!assistantResponse) {
      console.error("Respuesta inesperada de Gemini:", JSON.stringify(aiData));
      throw new Error("Respuesta inválida de la IA");
    }

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