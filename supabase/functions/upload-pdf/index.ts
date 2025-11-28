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

    // Extraer el user_id del JWT que ya fue verificado por Supabase
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No se proporcionó token de autorización");
    }

    // Decodificar el JWT para obtener el user_id
    const token = authHeader.replace("Bearer ", "");
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Token inválido");
    }
    
    const payload = JSON.parse(atob(parts[1]));
    const userId = payload.sub;

    if (!userId) {
      throw new Error("Usuario no autenticado");
    }

    console.log("Usuario autenticado:", userId);

    const { pdf, fileName } = await req.json();

    if (!pdf || !fileName) {
      throw new Error("PDF y nombre de archivo son requeridos");
    }

    console.log("Procesando PDF:", fileName);

    // Usar Lovable AI para extraer el contenido del PDF de manera confiable
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("API key de Lovable AI no configurada");
    }

    console.log("Extrayendo contenido del PDF con Lovable AI...");

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
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extrae TODO el texto completo de este PDF de plan nutricional. Incluye todos los detalles, tablas, listas de alimentos, porciones, y cualquier información relevante. Mantén la estructura y formato original tanto como sea posible. Responde SOLO con el texto extraído, sin agregar comentarios adicionales."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:application/pdf;base64,${pdf}`
                  }
                }
              ]
            }
          ],
          max_tokens: 16000,
        }),
      }
    );

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Error de Lovable AI:", aiResponse.status, errorText);
      throw new Error("Error extrayendo contenido del PDF");
    }

    const aiData = await aiResponse.json();
    let extractedText = aiData.choices?.[0]?.message?.content;

    if (!extractedText || extractedText.length < 50) {
      throw new Error("No se pudo extraer contenido válido del PDF");
    }

    // Limpiar el texto: remover null bytes y otros caracteres problemáticos para PostgreSQL
    extractedText = extractedText
      .replace(/\u0000/g, '') // Remover null bytes
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remover otros caracteres de control
      .trim();

    console.log("Texto extraído y limpiado, longitud:", extractedText.length);

    // Guardar en la base de datos
    const { data: diet, error: insertError } = await supabaseClient
      .from("diets")
      .insert({
        user_id: userId,
        file_name: fileName,
        content: extractedText,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error insertando dieta:", insertError);
      throw insertError;
    }

    console.log("Dieta guardada exitosamente, ID:", diet.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        dietId: diet.id,
        message: "PDF procesado exitosamente" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error en upload-pdf:", error);
    const errorMessage = error instanceof Error ? error.message : "Error procesando PDF";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});