import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GeneratedFile } from "@/lib/websiteGenerator";

export interface HistoryItem {
  id: string;
  number: number;
  prompt: string;
  language: string;
  zip_data: string | null;
  files_data: GeneratedFile[] | null;
  status: string;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  ai_model: string | null;
  website_type: string | null;
  site_name: string | null;
  sale_price: number | null;
  image_source: string | null;
  geo: string | null;
}

export interface Appeal {
  id: string;
  generation_id: string;
  status: string;
}

interface CachedData {
  history: HistoryItem[];
  appeals: Appeal[];
  timestamp: number;
}

const CACHE_KEY_PREFIX = "generation_history_cache_";
const CACHE_MAX_ITEMS = 50;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Helper to get cache from localStorage
function getLocalCache(userId: string): CachedData | null {
  try {
    const key = `${CACHE_KEY_PREFIX}${userId}`;
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const data = JSON.parse(cached) as CachedData;
    // Check if cache is expired
    if (Date.now() - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

// Helper to save cache to localStorage
function setLocalCache(userId: string, history: HistoryItem[], appeals: Appeal[]) {
  try {
    const key = `${CACHE_KEY_PREFIX}${userId}`;
    // Only cache last 50 items (without zip_data to save space)
    const trimmedHistory = history.slice(0, CACHE_MAX_ITEMS).map(item => ({
      ...item,
      zip_data: null // Don't cache zip data - it's large
    }));
    const data: CachedData = {
      history: trimmedHistory,
      appeals,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to cache generation history:", e);
  }
}

interface FetchParams {
  userId: string;
  compactMode?: boolean;
}

async function fetchGenerationHistory({ userId, compactMode }: FetchParams): Promise<{ history: HistoryItem[]; appeals: Appeal[] }> {
  let query = supabase
    .from("generation_history")
    .select("id, number, prompt, language, zip_data, files_data, status, error_message, created_at, completed_at, ai_model, website_type, site_name, sale_price, image_source, geo")
    .eq("user_id", userId)
    .order("number", { ascending: false });

  // In compactMode, only fetch last 24 hours - reduces data significantly
  if (compactMode) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("created_at", twentyFourHoursAgo);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching history:", error);
    throw error;
  }

  const typedData = (data || []).map(item => ({
    ...item,
    files_data: item.files_data as unknown as GeneratedFile[] | null
  }));

  // Fetch appeals
  const { data: appealsData } = await supabase
    .from("appeals")
    .select("id, generation_id, status")
    .eq("user_id", userId);

  return {
    history: typedData,
    appeals: appealsData || []
  };
}

interface UseGenerationHistoryOptions {
  compactMode?: boolean;
}

export function useGenerationHistory({ compactMode = false }: UseGenerationHistoryOptions = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const realtimeActiveRef = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Get initial data from localStorage cache
  const [initialData] = useState<CachedData | null>(() => 
    user?.id ? getLocalCache(user.id) : null
  );

  const queryKey = compactMode 
    ? ["generationHistory", user?.id, "compact"] 
    : ["generationHistory", user?.id, "full"];

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: () => fetchGenerationHistory({ userId: user!.id, compactMode }),
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    // Use localStorage cache as placeholder while fetching
    placeholderData: initialData ? { history: initialData.history, appeals: initialData.appeals } : undefined,
  });

  // Save to localStorage when data changes
  useEffect(() => {
    if (user?.id && data && !isFetching) {
      setLocalCache(user.id, data.history, data.appeals);
    }
  }, [user?.id, data, isFetching]);

  // Update cache with new/updated item
  const updateHistoryItem = useCallback((newRecord: Record<string, unknown>) => {
    queryClient.setQueryData(queryKey, (old: { history: HistoryItem[]; appeals: Appeal[] } | undefined) => {
      if (!old) return old;
      
      const existingIndex = old.history.findIndex(item => item.id === newRecord.id);
      const newItem = {
        ...newRecord,
        files_data: newRecord.files_data as GeneratedFile[] | null
      } as HistoryItem;

      let newHistory: HistoryItem[];
      if (existingIndex >= 0) {
        // Update existing
        newHistory = old.history.map((item, idx) => 
          idx === existingIndex ? { ...item, ...newItem } : item
        );
      } else {
        // Insert new at beginning
        newHistory = [newItem, ...old.history];
      }

      return { ...old, history: newHistory };
    });
  }, [queryClient, queryKey]);

  // Remove item from cache
  const removeHistoryItem = useCallback((itemId: string) => {
    queryClient.setQueryData(queryKey, (old: { history: HistoryItem[]; appeals: Appeal[] } | undefined) => {
      if (!old) return old;
      return {
        ...old,
        history: old.history.filter(item => item.id !== itemId)
      };
    });
  }, [queryClient, queryKey]);

  // Fallback polling
  const startFallbackPolling = useCallback(() => {
    if (pollingIntervalRef.current) return;
    
    console.log("[useGenerationHistory] Starting fallback polling");
    pollingIntervalRef.current = setInterval(() => {
      const currentData = queryClient.getQueryData<{ history: HistoryItem[] }>(queryKey);
      const hasGenerating = currentData?.history?.some(item => 
        item.status === "generating" || item.status === "pending"
      );
      if (hasGenerating) {
        console.log("[useGenerationHistory] Polling for updates...");
        refetch();
      }
    }, 10_000);
  }, [queryClient, queryKey, refetch]);

  const stopFallbackPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log("[useGenerationHistory] Stopping fallback polling");
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  // Setup realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const setupChannel = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }

      channelRef.current = supabase
        .channel(`generation_history_${compactMode ? 'compact' : 'full'}_${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "generation_history",
            filter: `user_id=eq.${user.id}`,
          },
          async (payload) => {
            const newRecord = payload.new as Record<string, unknown> | undefined;
            const oldRecord = payload.old as Record<string, unknown> | undefined;
            console.log("[useGenerationHistory] Realtime update:", payload.eventType, newRecord?.id);

            if (payload.eventType === "INSERT" && newRecord) {
              updateHistoryItem(newRecord);
            } else if (payload.eventType === "UPDATE" && newRecord) {
              // For completed status, fetch full record to get zip_data
              if (newRecord.status === "completed") {
                const { data: fullRecord } = await supabase
                  .from("generation_history")
                  .select("*")
                  .eq("id", newRecord.id as string)
                  .single();
                if (fullRecord) {
                  updateHistoryItem(fullRecord);
                }
              } else {
                updateHistoryItem(newRecord);
              }
            } else if (payload.eventType === "DELETE" && oldRecord) {
              removeHistoryItem(oldRecord.id as string);
            }
          }
        )
        .subscribe((status, err) => {
          console.log("[useGenerationHistory] Realtime status:", status, err?.message);
          
          if (status === "SUBSCRIBED") {
            realtimeActiveRef.current = true;
            stopFallbackPolling();
          } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            realtimeActiveRef.current = false;
            startFallbackPolling();
            
            // Reconnect after delay
            setTimeout(() => {
              console.log("[useGenerationHistory] Reconnecting...");
              setupChannel();
            }, status === "TIMED_OUT" ? 10000 : 5000);
          }
        });
    };

    setupChannel();

    // Start polling if realtime doesn't connect within 3 seconds
    const pollTimeout = setTimeout(() => {
      if (!realtimeActiveRef.current) {
        startFallbackPolling();
      }
    }, 3000);

    return () => {
      clearTimeout(pollTimeout);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      stopFallbackPolling();
    };
  }, [user?.id, compactMode, updateHistoryItem, removeHistoryItem, startFallbackPolling, stopFallbackPolling]);

  return {
    history: data?.history || initialData?.history || [],
    appeals: data?.appeals || initialData?.appeals || [],
    isLoading: isLoading && !initialData,
    isFetching,
    refetch,
    updateHistoryItem,
    removeHistoryItem,
  };
}
