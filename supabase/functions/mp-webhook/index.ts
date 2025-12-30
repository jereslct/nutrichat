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
    const url = new URL(req.url);
    
    // MercadoPago sends topic and id as query params or in body
    let topic = url.searchParams.get("topic") || url.searchParams.get("type");
    let resourceId = url.searchParams.get("id") || url.searchParams.get("data.id");

    // Also try to get from body
    let body: any = {};
    try {
      body = await req.json();
      console.log("Webhook body:", JSON.stringify(body));
      topic = topic || body.type || body.topic;
      resourceId = resourceId || body.data?.id || body.id;
    } catch {
      console.log("No JSON body in request");
    }

    console.log("Webhook received - Topic:", topic, "Resource ID:", resourceId);

    // Handle subscription notifications
    // Topics: subscription_preapproval, subscription_authorized_payment
    if (topic !== "subscription_preapproval" && topic !== "preapproval") {
      // Also handle payment notifications for subscription payments
      if (topic === "payment" || topic === "subscription_authorized_payment") {
        console.log("Processing payment notification for subscription");
      } else {
        console.log("Ignoring notification type:", topic);
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!resourceId) {
      console.log("No resource ID found, acknowledging webhook");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MERCADOPAGO_ACCESS_TOKEN) {
      throw new Error("MercadoPago access token not configured");
    }

    // Determine which endpoint to call based on topic
    let apiUrl: string;
    if (topic === "payment" || topic === "subscription_authorized_payment") {
      apiUrl = `https://api.mercadopago.com/v1/payments/${resourceId}`;
    } else {
      apiUrl = `https://api.mercadopago.com/preapproval/${resourceId}`;
    }

    console.log("Fetching resource from:", apiUrl);

    const mpResponse = await fetch(apiUrl, {
      headers: {
        "Authorization": `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
      },
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error("Error fetching resource:", mpResponse.status, errorText);
      return new Response(JSON.stringify({ received: true, error: "Could not fetch resource" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resource = await mpResponse.json();
    console.log("Resource status:", resource.status, "External reference:", resource.external_reference);

    // Get user_id from external_reference
    const userId = resource.external_reference;
    
    if (!userId) {
      console.error("No user_id found in resource");
      return new Response(JSON.stringify({ received: true, error: "No user_id in resource" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to update user profile
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Map MercadoPago status to our subscription_status
    // Preapproval statuses: pending, authorized, paused, cancelled
    // Payment statuses: approved, pending, rejected, etc.
    let subscriptionStatus: string;
    
    if (topic === "payment" || topic === "subscription_authorized_payment") {
      // For payment notifications
      if (resource.status === "approved") {
        subscriptionStatus = "active";
      } else {
        console.log("Payment not approved:", resource.status);
        return new Response(JSON.stringify({ received: true, status: resource.status }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // For subscription (preapproval) notifications
      switch (resource.status) {
        case "authorized":
          subscriptionStatus = "active";
          break;
        case "paused":
          subscriptionStatus = "paused";
          break;
        case "cancelled":
          subscriptionStatus = "cancelled";
          break;
        case "pending":
          subscriptionStatus = "pending";
          break;
        default:
          subscriptionStatus = resource.status;
      }
    }

    console.log("Updating user:", userId, "to subscription_status:", subscriptionStatus);

    // Update user profile
    const updateData: any = {
      subscription_status: subscriptionStatus,
      updated_at: new Date().toISOString(),
    };

    // Store subscription_id if it's a preapproval
    if (topic === "subscription_preapproval" || topic === "preapproval") {
      updateData.subscription_id = resource.id;
    }

    // If subscription is active, also set is_premium for backwards compatibility
    if (subscriptionStatus === "active") {
      updateData.is_premium = true;
    } else if (subscriptionStatus === "cancelled" || subscriptionStatus === "paused") {
      updateData.is_premium = false;
    }

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating profile:", updateError);
      throw new Error("Error updating subscription status");
    }

    console.log("Subscription status updated successfully for user:", userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Subscription updated",
        user_id: userId,
        status: subscriptionStatus
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
