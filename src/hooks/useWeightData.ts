import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { WeightUnit } from "@/lib/weightConversion";

// Local type — weight_entries exists in DB but types.ts may lag behind
export interface WeightEntry {
  id: string;
  user_id: string;
  weight: number;
  entry_date: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface WeightProfile {
  height: number | null;
  target_weight: number | null;
  weight_unit: WeightUnit;
}

export function useWeightData(userId: string | undefined) {
  const queryClient = useQueryClient();

  const entriesQuery = useQuery({
    queryKey: ["weight_entries", userId],
    queryFn: async (): Promise<WeightEntry[]> => {
      if (!userId) return [];
      const { data, error } = await (supabase as any)
        .from("weight_entries")
        .select("*")
        .eq("user_id", userId)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WeightEntry[];
    },
    enabled: !!userId,
  });

  const profileQuery = useQuery({
    queryKey: ["weight_profile", userId],
    queryFn: async (): Promise<WeightProfile> => {
      if (!userId) return { height: null, target_weight: null, weight_unit: "kg" };
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("height, target_weight, weight_unit")
        .eq("id", userId)
        .single();
      if (error) throw error;
      return {
        height: data.height,
        target_weight: data.target_weight,
        weight_unit: (data.weight_unit as WeightUnit) || "kg",
      };
    },
    enabled: !!userId,
  });

  const addEntry = useMutation({
    mutationFn: async (entry: { weight: number; entry_date: string; notes?: string }) => {
      if (!userId) throw new Error("No user");
      const { data, error } = await (supabase as any)
        .from("weight_entries")
        .insert({ user_id: userId, ...entry })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weight_entries", userId] });
    },
  });

  const updateEntry = useMutation({
    mutationFn: async (params: { id: string; weight: number; notes?: string | null }) => {
      const { id, ...rest } = params;
      const { data, error } = await (supabase as any)
        .from("weight_entries")
        .update(rest)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weight_entries", userId] });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("weight_entries")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weight_entries", userId] });
    },
  });

  const updateWeightSettings = useMutation({
    mutationFn: async (settings: Partial<WeightProfile>) => {
      if (!userId) throw new Error("No user");
      const { error } = await (supabase as any)
        .from("profiles")
        .update(settings)
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weight_profile", userId] });
    },
  });

  // Realtime subscription for weight_entries changes
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`weight_entries:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "weight_entries",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["weight_entries", userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return {
    entries: entriesQuery.data ?? [],
    weightProfile: profileQuery.data ?? { height: null, target_weight: null, weight_unit: "kg" as WeightUnit },
    loading: entriesQuery.isLoading || profileQuery.isLoading,
    error: entriesQuery.error || profileQuery.error,
    addEntry,
    updateEntry,
    deleteEntry,
    updateWeightSettings,
  };
}

/**
 * Read-only hook for doctors viewing a patient's weight data.
 */
export function usePatientWeightData(patientId: string | undefined) {
  const query = useQuery({
    queryKey: ["patient_weight_entries", patientId],
    queryFn: async (): Promise<WeightEntry[]> => {
      if (!patientId) return [];
      const { data, error } = await (supabase as any)
        .from("weight_entries")
        .select("*")
        .eq("user_id", patientId)
        .order("entry_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as WeightEntry[];
    },
    enabled: !!patientId,
  });

  const profileQuery = useQuery({
    queryKey: ["patient_weight_profile", patientId],
    queryFn: async (): Promise<WeightProfile> => {
      if (!patientId) return { height: null, target_weight: null, weight_unit: "kg" };
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("height, target_weight, weight_unit")
        .eq("id", patientId)
        .single();
      if (error) throw error;
      return {
        height: data.height,
        target_weight: data.target_weight,
        weight_unit: (data.weight_unit as WeightUnit) || "kg",
      };
    },
    enabled: !!patientId,
  });

  return {
    entries: query.data ?? [],
    weightProfile: profileQuery.data ?? { height: null, target_weight: null, weight_unit: "kg" as WeightUnit },
    loading: query.isLoading || profileQuery.isLoading,
  };
}
