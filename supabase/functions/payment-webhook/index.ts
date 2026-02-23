import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const topic = url.searchParams.get("topic") || url.searchParams.get("type");
    const paymentId = url.searchParams.get("data.id") || url.searchParams.get("id");

    console.log("Webhook received - Topic:", topic, "Payment ID:", paymentId);

    // MercadoPago sends different notification types
    if (topic !== "payment" && topic !== "merchant_order") {
      console.log("Ignoring non-payment notification:", topic);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For POST requests, try to get data from body
    let body: any = {};
    try {
      body = await req.json();
      console.log("Webhook body:", JSON.stringify(body));
    } catch {
      console.log("No JSON body in request");
    }

    // Get payment ID from body if not in URL
    const finalPaymentId = paymentId || body?.data?.id;
    
    if (!finalPaymentId) {
      console.log("No payment ID found, acknowledging webhook");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MERCADOPAGO_ACCESS_TOKEN) {
      throw new Error("MercadoPago access token not configured");
    }

    // Get payment details from MercadoPago
    console.log("Fetching payment details for ID:", finalPaymentId);
    
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${finalPaymentId}`, {
      headers: {
        "Authorization": `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
      },
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error("Error fetching payment:", mpResponse.status, errorText);
      // Return 200 to acknowledge receipt even if we can't process
      return new Response(JSON.stringify({ received: true, error: "Could not fetch payment" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payment = await mpResponse.json();
    console.log("Payment status:", payment.status, "External reference:", payment.external_reference);

    // Only process approved payments
    if (payment.status !== "approved") {
      console.log("Payment not approved, status:", payment.status);
      return new Response(JSON.stringify({ received: true, status: payment.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user_id from external_reference or metadata
    const userId = payment.external_reference || payment.metadata?.user_id;
    
    if (!userId) {
      console.error("No user_id found in payment:", payment.id);
      return new Response(JSON.stringify({ received: true, error: "No user_id in payment" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Activating premium for user:", userId);

    // Use service role to update user profile
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Update user to premium
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ 
        is_premium: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating profile:", updateError);
      throw new Error("Error activating premium status");
    }

    console.log("Premium activated successfully for user:", userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Premium activated",
        user_id: userId 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    // Always return 200 to MercadoPago to prevent retries
    return new Response(
      JSON.stringify({ received: true, error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
