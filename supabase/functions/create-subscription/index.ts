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
    // 1. Extract and validate Authorization header
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";

    console.log("=== CREATE-SUBSCRIPTION START ===");
    console.log("Auth header present:", !!authHeader, "| Token present:", !!token);

    if (!token) {
      console.error("No token provided");
      return new Response(
        JSON.stringify({ error: "Usuario no autenticado", details: "No se proporcionó token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Create Supabase client and authenticate user
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: `Bearer ${token.trim()}` },
        },
        auth: {
          persistSession: false,
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token.trim());

    if (authError || !user) {
      console.error("Auth error:", authError?.message || "User not found");
      return new Response(
        JSON.stringify({ error: "Usuario no autenticado", details: authError?.message }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Validate user has email
    console.log("User authenticated:", user.id);
    console.log("User email:", user.email);

    if (!user.email) {
      console.error("User has no email");
      return new Response(
        JSON.stringify({ error: "El usuario no tiene email registrado", details: "Se requiere un email para crear la suscripción" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Validate MercadoPago token
    const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MERCADOPAGO_ACCESS_TOKEN) {
      console.error("MERCADOPAGO_ACCESS_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "Error de configuración", details: "Token de MercadoPago no configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Debug: Check MercadoPago account info
    try {
      const meRes = await fetch("https://api.mercadopago.com/users/me", {
        headers: { Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}` },
      });

      if (meRes.ok) {
        const me = await meRes.json();
        console.log("MercadoPago account:", {
          id: me?.id,
          site_id: me?.site_id,
          country_id: me?.country_id,
        });
      } else {
        console.warn("MercadoPago /users/me failed:", meRes.status);
      }
    } catch (e) {
      console.warn("MercadoPago /users/me error:", e);
    }

    // 6. Build subscription payload
    const origin = req.headers.get("origin") || "https://coghazfvffthyrjsifrm.lovableproject.com";

    const subscriptionPayload = {
      payer_email: user.email, // REQUIRED by MercadoPago
      reason: "NutriChat PRO - Suscripción Mensual",
      external_reference: user.id,
      back_url: `${origin}/chat?subscription=success`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: 16999,
        currency_id: "ARS",
      },
      status: "pending",
    };

    console.log("=== MERCADOPAGO PAYLOAD ===");
    console.log(JSON.stringify(subscriptionPayload, null, 2));

    // 7. Create MercadoPago subscription
    console.log("Sending request to MercadoPago...");
    const mpResponse = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscriptionPayload),
    });

    const mpResponseText = await mpResponse.text();
    console.log("MercadoPago response status:", mpResponse.status);
    console.log("MercadoPago response body:", mpResponseText);

    if (!mpResponse.ok) {
      let errorData;
      try {
        errorData = JSON.parse(mpResponseText);
      } catch {
        errorData = { raw: mpResponseText };
      }

      console.error("=== MERCADOPAGO ERROR ===");
      console.error("Status:", mpResponse.status);
      console.error("Error data:", JSON.stringify(errorData, null, 2));

      return new Response(
        JSON.stringify({ 
          error: `Error de MercadoPago: ${errorData?.message || mpResponse.status}`,
          details: errorData,
          status: mpResponse.status
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Parse successful response
    const subscription = JSON.parse(mpResponseText);
    console.log("=== SUBSCRIPTION CREATED ===");
    console.log("ID:", subscription.id);
    console.log("Status:", subscription.status);
    console.log("Init point:", subscription.init_point);

    return new Response(
      JSON.stringify({
        success: true,
        subscription_id: subscription.id,
        init_point: subscription.init_point,
        status: subscription.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("=== UNEXPECTED ERROR ===");
    console.error("Error:", error);
    console.error("Message:", error instanceof Error ? error.message : "Unknown error");
    console.error("Stack:", error instanceof Error ? error.stack : "No stack");

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Error inesperado al crear suscripción",
        details: error instanceof Error ? error.stack : null
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
