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
    // Authenticate user
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
      return new Response(
        JSON.stringify({ error: "Usuario no autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Creating preference for user:", user.id);

    const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MERCADOPAGO_ACCESS_TOKEN) {
      throw new Error("MercadoPago access token not configured");
    }

    // Get the origin from the request or use a default
    const origin = req.headers.get("origin") || "https://coghazfvffthyrjsifrm.lovableproject.com";

    // Create MercadoPago preference
    const preferenceData = {
      items: [
        {
          title: "FoodTalk PRO - Plan Mensual",
          description: "Acceso ilimitado a tu asistente nutricional",
          quantity: 1,
          currency_id: "ARS",
          unit_price: 2999, // Price in ARS - adjust as needed
        }
      ],
      payer: {
        email: user.email,
      },
      back_urls: {
        success: `${origin}/chat?status=success`,
        failure: `${origin}/chat?status=failure`,
        pending: `${origin}/chat?status=pending`,
      },
      auto_return: "approved",
      external_reference: user.id, // Store user_id for webhook
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-webhook`,
      metadata: {
        user_id: user.id,
        plan_type: "monthly",
      },
    };

    console.log("Creating MercadoPago preference...");

    const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferenceData),
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error("MercadoPago error:", mpResponse.status, errorText);
      throw new Error(`Error creating MercadoPago preference: ${mpResponse.status}`);
    }

    const preference = await mpResponse.json();
    console.log("Preference created:", preference.id);

    return new Response(
      JSON.stringify({
        success: true,
        preference_id: preference.id,
        init_point: preference.init_point,
        sandbox_init_point: preference.sandbox_init_point,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating preference:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error creating preference" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
