import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'No autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get service role client
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get pending requests where user is the target (incoming)
    const { data: incomingRequests, error: incomingError } = await serviceClient
      .from('link_requests')
      .select('*')
      .eq('target_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (incomingError) throw incomingError;

    // Get pending requests where user is the requester (outgoing)
    const { data: outgoingRequests, error: outgoingError } = await serviceClient
      .from('link_requests')
      .select('*')
      .eq('requester_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (outgoingError) throw outgoingError;

    // Enrich with profile data
    const enrichRequests = async (requests: any[], isIncoming: boolean) => {
      return Promise.all(
        (requests || []).map(async (req: any) => {
          const profileId = isIncoming ? req.requester_id : req.target_id;
          
          const { data: profile } = await serviceClient
            .from('profiles')
            .select('full_name, avatar_url, role')
            .eq('id', profileId)
            .single();

          return {
            id: req.id,
            requester_id: req.requester_id,
            target_id: req.target_id,
            requester_role: req.requester_role,
            created_at: req.created_at,
            is_incoming: isIncoming,
            other_user: {
              id: profileId,
              full_name: profile?.full_name || 'Usuario',
              avatar_url: profile?.avatar_url,
              role: profile?.role,
            },
          };
        })
      );
    };

    const enrichedIncoming = await enrichRequests(incomingRequests || [], true);
    const enrichedOutgoing = await enrichRequests(outgoingRequests || [], false);

    return new Response(
      JSON.stringify({
        incoming: enrichedIncoming,
        outgoing: enrichedOutgoing,
        total_incoming: enrichedIncoming.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
