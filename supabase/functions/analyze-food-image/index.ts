import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DAILY_IMAGE_LIMIT = 3;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Properly authenticate user with Supabase auth (verifies JWT signature)
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
      console.error("Auth error:", authError);
      throw new Error("Usuario no autenticado");
    }

    const userId = user.id;
    console.log("Usuario autenticado para análisis de imagen:", userId);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ========== RATE LIMITING FOR IMAGES ==========
    const today = new Date().toISOString().split('T')[0];
    
    const { data: usageData, error: usageError } = await supabaseAdmin
      .from("user_usage")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (usageError && usageError.code !== "PGRST116") {
      console.error("Error fetching usage:", usageError);
      throw new Error("Error al verificar límites de uso");
    }

    let currentImageCount = 0;
    let lastDate = today;

    if (usageData) {
      lastDate = usageData.last_query_date;
      currentImageCount = usageData.daily_image_count || 0;

      if (lastDate !== today) {
        currentImageCount = 0;
        lastDate = today;
      }
    }

    if (currentImageCount >= DAILY_IMAGE_LIMIT) {
      console.log(`Usuario ${userId} ha alcanzado el límite diario de imágenes: ${currentImageCount}/${DAILY_IMAGE_LIMIT}`);
      return new Response(
        JSON.stringify({ 
          error: `Límite diario de fotos alcanzado. Has analizado ${DAILY_IMAGE_LIMIT} fotos hoy. Vuelve mañana para continuar.` 
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ========== GET IMAGE AND DIET ==========
    const { imageBase64, dietId, userComment } = await req.json();

    if (!imageBase64 || !dietId) {
      throw new Error("Imagen y dietId son requeridos");
    }

    // Validate base64 image
    if (!imageBase64.startsWith("data:image/")) {
      throw new Error("Formato de imagen inválido");
    }

    console.log("Procesando imagen para dieta:", dietId, "comentario:", userComment || "(ninguno)");

    // Get user's diet
    const { data: diet, error: dietError } = await supabaseClient
      .from("diets")
      .select("*")
      .eq("id", dietId)
      .eq("user_id", userId)
      .single();

    if (dietError || !diet) {
      throw new Error("Dieta no encontrada");
    }

    // ========== ANALYZE IMAGE WITH AI ==========
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("API key de Lovable AI no configurada");
    }

    const systemPrompt = `Eres un asistente nutricional amigable y empático. Tu tarea es analizar fotos de comida que el usuario te envía.

PLAN NUTRICIONAL DEL USUARIO:
${diet.pdf_text}

INSTRUCCIONES IMPORTANTES:
1. Primero, verifica si la imagen es de comida. Si NO es comida, responde amablemente indicando que solo puedes analizar fotos de alimentos.

2. Si ES comida, analiza la imagen y compara con el plan nutricional del usuario.

3. NUNCA regañes ni critiques al usuario. Sé siempre positivo y constructivo.

4. Si la comida no está del todo alineada con el plan:
   - Reconoce el esfuerzo del usuario
   - Menciona qué aspectos están bien
   - Sugiere pequeños ajustes de forma amable (ej: "Podrías agregar...", "Una opción sería...")
   - Ofrece alternativas específicas basadas en su plan

5. Si la comida está alineada con el plan, felicita al usuario.

6. Sé conciso pero informativo. No uses más de 200 palabras.

7. Usa un tono cálido y motivador. El objetivo es ayudar, no juzgar.`;

    console.log("Llamando a Lovable AI para análisis de imagen...");

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: userComment 
                    ? `Por favor analiza esta foto de mi comida. ${userComment}` 
                    : "Por favor analiza esta foto de mi comida y dime si está alineada con mi plan nutricional."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageBase64
                  }
                }
              ]
            }
          ],
          max_tokens: 1000,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Error de Lovable AI:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error("Límite de uso excedido. Por favor intenta de nuevo más tarde.");
      }
      if (aiResponse.status === 402) {
        throw new Error("Fondos insuficientes en el servicio de IA.");
      }
      throw new Error("Error analizando la imagen");
    }

    const aiData = await aiResponse.json();
    const assistantResponse = aiData.choices?.[0]?.message?.content;
    
    if (!assistantResponse) {
      console.error("Respuesta inesperada de Lovable AI:", JSON.stringify(aiData));
      throw new Error("No se pudo analizar la imagen");
    }

    console.log("Análisis de imagen completado, longitud:", assistantResponse.length);

    // ========== UPDATE IMAGE USAGE COUNTER ==========
    if (usageData) {
      const { error: updateError } = await supabaseAdmin
        .from("user_usage")
        .update({
          daily_image_count: currentImageCount + 1,
          last_query_date: today
        })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Error updating image usage:", updateError);
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from("user_usage")
        .insert({
          user_id: userId,
          daily_query_count: 0,
          daily_image_count: 1,
          last_query_date: today
        });

      if (insertError) {
        console.error("Error inserting usage:", insertError);
      }
    }

    console.log(`Usuario ${userId} - Imagen ${currentImageCount + 1}/${DAILY_IMAGE_LIMIT}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        response: assistantResponse,
        usage: {
          imagesUsed: currentImageCount + 1,
          imagesRemaining: DAILY_IMAGE_LIMIT - (currentImageCount + 1),
          limit: DAILY_IMAGE_LIMIT
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error en analyze-food-image:", error);
    const errorMessage = error instanceof Error ? error.message : "Error procesando imagen";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
