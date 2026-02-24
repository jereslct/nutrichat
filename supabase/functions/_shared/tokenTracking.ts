import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface AIResponseWithUsage {
  usage?: TokenUsage;
}

export async function logTokenUsage(
  supabaseAdmin: SupabaseClient,
  userId: string,
  functionName: string,
  aiData: AIResponseWithUsage,
): Promise<void> {
  if (!aiData.usage) {
    console.warn(`[tokenTracking] No usage data in response for ${functionName}`);
    return;
  }

  try {
    const { error } = await supabaseAdmin.from("token_usage").insert({
      user_id: userId,
      function_name: functionName,
      prompt_tokens: aiData.usage.prompt_tokens ?? null,
      completion_tokens: aiData.usage.completion_tokens ?? null,
      total_tokens: aiData.usage.total_tokens ?? null,
    });

    if (error) {
      console.error(`[tokenTracking] Insert error for ${functionName}:`, error.message);
    } else {
      console.log(
        `[tokenTracking] ${functionName} — prompt: ${aiData.usage.prompt_tokens}, completion: ${aiData.usage.completion_tokens}, total: ${aiData.usage.total_tokens}`
      );
    }
  } catch (e) {
    // Never throw — tracking is non-critical
    console.error(`[tokenTracking] Unexpected error for ${functionName}:`, e);
  }
}
