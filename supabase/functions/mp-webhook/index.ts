import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseExternalReference(ref: string): { userId: string; planTier: string | null; licenses: number } {
  const parts = ref.split("|");
  return {
    userId: parts[0],
    planTier: parts[1] || null,
    licenses: parseInt(parts[2] || "0", 10),
  };
}

async function verifyWebhookSignature(
  req: Request,
  dataId: string | null
): Promise<boolean> {
  const secret = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
  if (!secret) {
    console.warn("MERCADOPAGO_WEBHOOK_SECRET not configured — skipping signature verification");
    return true;
  }

  const xSignature = req.headers.get("x-signature");
  const xRequestId = req.headers.get("x-request-id");

  if (!xSignature) {
    console.error("Missing x-signature header");
    return false;
  }

  let ts: string | null = null;
  let hash: string | null = null;

  for (const part of xSignature.split(",")) {
    const [key, ...rest] = part.split("=");
    const value = rest.join("=");
    if (!key || !value) continue;
    const k = key.trim();
    const v = value.trim();
    if (k === "ts") ts = v;
    else if (k === "v1") hash = v;
  }

  if (!hash) {
    console.error("Missing v1 hash in x-signature header");
    return false;
  }

  // Build manifest — omit sections whose value is absent (per MP docs)
  let manifest = "";
  if (dataId) manifest += `id:${dataId};`;
  if (xRequestId) manifest += `request-id:${xRequestId};`;
  if (ts) manifest += `ts:${ts};`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computed !== hash) {
    console.error("Webhook signature mismatch");
    return false;
  }

  // Warn (but don't reject) if the timestamp is older than 5 minutes
  if (ts) {
    const tsMs = ts.length <= 12 ? parseInt(ts, 10) * 1000 : parseInt(ts, 10);
    const drift = Math.abs(Date.now() - tsMs);
    if (drift > 5 * 60 * 1000) {
      console.warn("Webhook timestamp drift:", drift, "ms");
    }
  }

  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);

    // data.id from query params is used both for routing and signature verification
    const dataIdFromQuery = url.searchParams.get("data.id");

    // Verify HMAC signature before processing
    const signatureValid = await verifyWebhookSignature(req, dataIdFromQuery);
    if (!signatureValid) {
      console.error("Webhook signature verification failed — rejecting request");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // MercadoPago sends topic and id as query params or in body
    let topic = url.searchParams.get("topic") || url.searchParams.get("type");
    let resourceId = url.searchParams.get("id") || dataIdFromQuery;

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

    // Parse external_reference to get userId and plan info
    const externalRef = resource.external_reference || "";
    const { userId, planTier, licenses } = parseExternalReference(externalRef);
    
    console.log("Parsed external reference - userId:", userId, "planTier:", planTier, "licenses:", licenses);

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
    let shouldUpdateLicenses = false;
    
    if (topic === "payment" || topic === "subscription_authorized_payment") {
      // For payment notifications
      if (resource.status === "approved") {
        subscriptionStatus = "active";
        shouldUpdateLicenses = true; // Renew licenses on payment approval
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
          shouldUpdateLicenses = true;
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

    // Build update data
    const updateData: Record<string, any> = {
      subscription_status: subscriptionStatus,
      updated_at: new Date().toISOString(),
    };

    // Store subscription_id if it's a preapproval
    if (topic === "subscription_preapproval" || topic === "preapproval") {
      updateData.subscription_id = resource.id;
    }

    // Update plan tier if provided
    if (planTier) {
      updateData.plan_tier = planTier;
    }

    // Update licenses count if subscription is active/authorized and we have license info
    if (shouldUpdateLicenses && licenses > 0) {
      updateData.licenses_count = licenses;
      console.log("Setting licenses_count to:", licenses);
    }

    // If subscription is active, also set is_premium for backwards compatibility
    if (subscriptionStatus === "active") {
      updateData.is_premium = true;
    } else if (subscriptionStatus === "cancelled" || subscriptionStatus === "paused") {
      updateData.is_premium = false;
      // Reset licenses on cancellation
      if (subscriptionStatus === "cancelled") {
        updateData.licenses_count = 0;
      }
    }

    console.log("Update data:", JSON.stringify(updateData));

    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update(updateData)
      .eq("id", userId);

    if (updateError) {
      console.error("Error updating profile:", updateError);
      throw new Error("Error updating subscription status");
    }

    console.log("Subscription status updated successfully for user:", userId);
    console.log("Plan tier:", planTier, "Licenses:", licenses);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Subscription updated",
        user_id: userId,
        status: subscriptionStatus,
        plan_tier: planTier,
        licenses_count: shouldUpdateLicenses ? licenses : undefined,
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