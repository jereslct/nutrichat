import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Plan configurations
const PLAN_CONFIGS: Record<string, { price: number; title: string; licenses: number }> = {
  individual: {
    price: 16999,
    title: "NutriChat PRO - Suscripción Personal",
    licenses: 0,
  },
  doctor_basic: {
    price: 27999,
    title: "NutriChat Médico - 10 Licencias",
    licenses: 10,
  },
  doctor_pro: {
    price: 43999,
    title: "NutriChat Médico Plus - 25 Licencias",
    licenses: 25,
  },
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

    // 2. Parse request body to get plan_tier
    let planTier = "individual"; // Default plan
    try {
      const body = await req.json();
      if (body.plan_tier && PLAN_CONFIGS[body.plan_tier]) {
        planTier = body.plan_tier;
      }
      console.log("Plan tier requested:", planTier);
    } catch {
      console.log("No body or invalid JSON, using default plan: individual");
    }

    const planConfig = PLAN_CONFIGS[planTier];
    if (!planConfig) {
      return new Response(
        JSON.stringify({ error: "Plan inválido", details: `Plan '${planTier}' no existe` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Create Supabase client and authenticate user
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

    // 4. Validate user has email
    console.log("User authenticated:", user.id);
    console.log("User email:", user.email);

    if (!user.email) {
      console.error("User has no email");
      return new Response(
        JSON.stringify({ error: "El usuario no tiene email registrado", details: "Se requiere un email para crear la suscripción" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Validate MercadoPago token
    const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MERCADOPAGO_ACCESS_TOKEN) {
      console.error("MERCADOPAGO_ACCESS_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "Error de configuración", details: "Token de MercadoPago no configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Debug: Check MercadoPago account info
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

    // 7. Build subscription payload with plan metadata
    const origin = req.headers.get("origin") || "https://coghazfvffthyrjsifrm.lovableproject.com";

    // Use external_reference to encode both user_id and plan info
    // Format: userId|planTier|licenses
    const externalReference = `${user.id}|${planTier}|${planConfig.licenses}`;

    const subscriptionPayload = {
      payer_email: user.email,
      reason: planConfig.title,
      external_reference: externalReference,
      back_url: `${origin}/chat?subscription=success`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: planConfig.price,
        currency_id: "ARS",
      },
      status: "pending",
    };

    console.log("=== MERCADOPAGO PAYLOAD ===");
    console.log("Plan:", planTier);
    console.log("Price:", planConfig.price);
    console.log("Licenses:", planConfig.licenses);
    console.log(JSON.stringify(subscriptionPayload, null, 2));

    // 8. Create MercadoPago subscription
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

    // 9. Parse successful response
    const subscription = JSON.parse(mpResponseText);
    console.log("=== SUBSCRIPTION CREATED ===");
    console.log("ID:", subscription.id);
    console.log("Status:", subscription.status);
    console.log("Init point:", subscription.init_point);
    console.log("Plan tier:", planTier);

    return new Response(
      JSON.stringify({
        success: true,
        subscription_id: subscription.id,
        init_point: subscription.init_point,
        status: subscription.status,
        plan_tier: planTier,
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