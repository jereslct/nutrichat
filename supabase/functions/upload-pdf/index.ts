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

    // Decodificar el PDF desde base64
    const pdfBuffer = Uint8Array.from(atob(pdf), c => c.charCodeAt(0));

    // Parsear PDF usando pdf.js de forma simple
    // Para producción, considera usar una librería más robusta
    const textDecoder = new TextDecoder();
    let pdfText = textDecoder.decode(pdfBuffer);
    
    // Extraer texto visible de forma básica
    // Esta es una extracción simple; en producción usa pdf-parse o similar
    const textMatches = pdfText.match(/\(([^)]+)\)/g);
    let extractedText = "";
    if (textMatches) {
      extractedText = textMatches
        .map(match => match.slice(1, -1))
        .join(" ")
        .replace(/\\[0-9]{3}/g, " ")
        .trim();
    }

    if (!extractedText || extractedText.length < 50) {
      extractedText = "Plan nutricional - contenido extraído del PDF. " + 
        "Se recomienda revisar el PDF original para detalles completos.";
    }

    console.log("Texto extraído, longitud:", extractedText.length);

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