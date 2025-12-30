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
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";

    console.log("Auth header present:", !!authHeader, "token present:", !!token);

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Usuario no autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate user (avoid session storage in Edge runtime)
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
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Usuario no autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Creating subscription for user:", user.id);

    const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MERCADOPAGO_ACCESS_TOKEN) {
      throw new Error("MercadoPago access token not configured");
    }

    // Debug: verify that the MercadoPago account/token matches Argentina (MLA)
    try {
      const meRes = await fetch("https://api.mercadopago.com/users/me", {
        headers: { Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}` },
      });

      if (meRes.ok) {
        const me = await meRes.json();
        console.log("MercadoPago account context:", {
          id: me?.id,
          site_id: me?.site_id,
          country_id: me?.country_id,
        });
      } else {
        console.warn(
          "MercadoPago /users/me failed:",
          meRes.status,
          await meRes.text(),
        );
      }
    } catch (e) {
      console.warn("MercadoPago /users/me error:", e);
    }

    // Get the origin from the request
    const origin = req.headers.get("origin") || "https://coghazfvffthyrjsifrm.lovableproject.com";

    // Create MercadoPago preapproval (subscription)
    // API Docs: https://www.mercadopago.com.ar/developers/en/reference/subscriptions/_preapproval/post
    const subscriptionData = {
      reason: "FoodTalk PRO - Suscripción Mensual",
      external_reference: user.id, // Store user_id for webhook identification
      // IMPORTANT: Do NOT send payer_email if the user email is not registered in MercadoPago
      // or if it's registered in a different country than the Access Token's site_id (MLA = Argentina).
      // Instead, let the user enter their email during checkout or omit payer_email entirely.
      // payer_email: user.email, // <- REMOVED to avoid "Cannot operate between different countries"
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: 2999, // Price in ARS
        currency_id: "ARS",
      },
      back_url: `${origin}/chat?subscription=success`,
      status: "pending", // Will be authorized when user completes checkout
    };

    console.log("Creating MercadoPago subscription...");
    console.log("MercadoPago payload:", JSON.stringify(subscriptionData));

    const mpResponse = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscriptionData),
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error("MercadoPago error:", mpResponse.status, errorText);
      throw new Error(`Error creating subscription: ${mpResponse.status} - ${errorText}`);
    }

    const subscription = await mpResponse.json();
    console.log("Subscription created:", subscription.id, "Status:", subscription.status);

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
    console.error("Error creating subscription:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Error creating subscription" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
