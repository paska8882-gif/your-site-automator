import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { GeneratedFile } from "@/lib/websiteGenerator";
import { useRealtimeTable } from "@/contexts/RealtimeContext";

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
  admin_note: string | null;
  color_scheme: string | null;
  layout_style: string | null;
  improved_prompt: string | null;
  vip_prompt: string | null;
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
  version?: number; // Cache version for invalidation
}

const CACHE_KEY_PREFIX = "generation_history_cache_";
const CACHE_MAX_ITEMS = 100;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes - reduced to prevent stale status display
const CACHE_VERSION = 3; // Increment to invalidate old caches - v3: fix manual_completed status display
const PAGE_SIZE = 10; // Load 10 items per page

// Helper to get cache from localStorage
function getLocalCache(userId: string): CachedData | null {
  try {
    const key = `${CACHE_KEY_PREFIX}${userId}`;
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    
    const data = JSON.parse(cached) as CachedData;
    // Check if cache is expired or version mismatch
    if (Date.now() - data.timestamp > CACHE_TTL || data.version !== CACHE_VERSION) {
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
    // Only cache last items (without zip_data to save space)
    const trimmedHistory = history.slice(0, CACHE_MAX_ITEMS).map(item => ({
      ...item,
      zip_data: null // Don't cache zip data - it's large
    }));
    const data: CachedData = {
      history: trimmedHistory,
      appeals,
      timestamp: Date.now(),
      version: CACHE_VERSION
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn("Failed to cache generation history:", e);
  }
}

interface FetchParams {
  userId: string;
  compactMode?: boolean;
  offset?: number;
  limit?: number;
}

async function fetchGenerationHistory({ userId, compactMode, offset = 0, limit = PAGE_SIZE }: FetchParams): Promise<{ history: HistoryItem[]; appeals: Appeal[]; hasMore: boolean }> {
  let query = supabase
    .from("generation_history")
    .select("id, number, prompt, language, zip_data, files_data, status, error_message, created_at, completed_at, ai_model, website_type, site_name, sale_price, image_source, geo, admin_note, color_scheme, layout_style, improved_prompt, vip_prompt")
    .eq("user_id", userId)
    .order("number", { ascending: false })
    .range(offset, offset + limit - 1);

  // In compactMode (Generator tab), only fetch active generations (pending/generating)
  if (compactMode) {
    query = query.in("status", ["pending", "generating"]);
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

  // Fetch appeals only on first page
  let appealsData: Appeal[] = [];
  if (offset === 0) {
    const { data: appeals } = await supabase
      .from("appeals")
      .select("id, generation_id, status")
      .eq("user_id", userId);
    appealsData = appeals || [];
  }

  return {
    history: typedData,
    appeals: appealsData,
    hasMore: typedData.length === limit
  };
}

interface UseGenerationHistoryOptions {
  compactMode?: boolean;
}

export function useGenerationHistory({ compactMode = false }: UseGenerationHistoryOptions = {}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Pagination state
  const [allHistory, setAllHistory] = useState<HistoryItem[]>([]);
  const [allAppeals, setAllAppeals] = useState<Appeal[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);

  // Get initial data from localStorage cache (only for full mode - compact mode needs fresh data)
  const [initialData] = useState<CachedData | null>(() => 
    user?.id && !compactMode ? getLocalCache(user.id) : null
  );

  const queryKey = compactMode 
    ? ["generationHistory", user?.id, "compact"] 
    : ["generationHistory", user?.id, "full"];

  // Initial fetch - first page only
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey,
    queryFn: () => fetchGenerationHistory({ userId: user!.id, compactMode, offset: 0, limit: PAGE_SIZE }),
    enabled: !!user?.id,
    staleTime: compactMode ? 2 * 60 * 1000 : 30 * 1000, // 2 min for compact, 30s for full
    gcTime: 10 * 60 * 1000, // 10 minutes cache
    refetchOnWindowFocus: false,
    refetchOnMount: !compactMode, // Always refetch on mount for full mode
    placeholderData: initialData ? { 
      history: initialData.history, 
      appeals: initialData.appeals,
      hasMore: true 
    } : undefined,
  });

  // Update local state when initial data loads
  useEffect(() => {
    if (data) {
      setAllHistory(data.history);
      if (data.appeals.length > 0) {
        setAllAppeals(data.appeals);
      }
      setHasMore(data.hasMore);
      setOffset(data.history.length);
    }
  }, [data]);

  // Save to localStorage when data changes
  useEffect(() => {
    if (user?.id && allHistory.length > 0 && !isFetching) {
      setLocalCache(user.id, allHistory, allAppeals);
    }
  }, [user?.id, allHistory, allAppeals, isFetching]);

  // Load more function
  const loadMore = useCallback(async () => {
    if (!user?.id || isLoadingMore || !hasMore) return;
    
    setIsLoadingMore(true);
    try {
      const result = await fetchGenerationHistory({ 
        userId: user.id, 
        compactMode, 
        offset, 
        limit: PAGE_SIZE 
      });
      
      setAllHistory(prev => {
        // Deduplicate by id
        const existingIds = new Set(prev.map(item => item.id));
        const newItems = result.history.filter(item => !existingIds.has(item.id));
        return [...prev, ...newItems];
      });
      setHasMore(result.hasMore);
      setOffset(prev => prev + result.history.length);
    } catch (error) {
      console.error("Error loading more history:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [user?.id, compactMode, offset, isLoadingMore, hasMore]);

  // Update cache with new/updated item
  const updateHistoryItem = useCallback((newRecord: Record<string, unknown>) => {
    const newItem = {
      ...newRecord,
      files_data: newRecord.files_data as GeneratedFile[] | null
    } as HistoryItem;

    setAllHistory(prev => {
      const existingIndex = prev.findIndex(item => item.id === newRecord.id);
      if (existingIndex >= 0) {
        // Update existing
        return prev.map((item, idx) => 
          idx === existingIndex ? { ...item, ...newItem } : item
        );
      } else {
        // Insert new at beginning, but first remove any matching optimistic items
        // Optimistic items have IDs starting with "optimistic-"
        const withoutMatchingOptimistic = prev.filter(item => {
          if (!item.id.startsWith("optimistic-")) return true;
          // Match by site_name, language, and website_type
          return !(
            item.site_name === newItem.site_name &&
            item.language === newItem.language &&
            item.website_type === newItem.website_type
          );
        });
        return [newItem, ...withoutMatchingOptimistic];
      }
    });

    // Also update React Query cache
    queryClient.setQueryData(queryKey, (old: { history: HistoryItem[]; appeals: Appeal[]; hasMore: boolean } | undefined) => {
      if (!old) return old;
      
      const existingIndex = old.history.findIndex(item => item.id === newRecord.id);
      let newHistory: HistoryItem[];
      if (existingIndex >= 0) {
        newHistory = old.history.map((item, idx) => 
          idx === existingIndex ? { ...item, ...newItem } : item
        );
      } else {
        // Remove matching optimistic items
        const withoutMatchingOptimistic = old.history.filter(item => {
          if (!item.id.startsWith("optimistic-")) return true;
          return !(
            item.site_name === newItem.site_name &&
            item.language === newItem.language &&
            item.website_type === newItem.website_type
          );
        });
        newHistory = [newItem, ...withoutMatchingOptimistic];
      }
      return { ...old, history: newHistory };
    });
  }, [queryClient, queryKey]);

  // Remove item from cache
  const removeHistoryItem = useCallback((itemId: string) => {
    setAllHistory(prev => prev.filter(item => item.id !== itemId));
    
    queryClient.setQueryData(queryKey, (old: { history: HistoryItem[]; appeals: Appeal[]; hasMore: boolean } | undefined) => {
      if (!old) return old;
      return {
        ...old,
        history: old.history.filter(item => item.id !== itemId)
      };
    });
  }, [queryClient, queryKey]);

  // Use centralized RealtimeContext instead of own channel + polling
  const handleRealtimeEvent = useCallback(async (event: { 
    table: string; 
    eventType: string; 
    new: Record<string, unknown> | null; 
    old: Record<string, unknown> | null 
  }) => {
    const newRecord = event.new;
    const oldRecord = event.old;

    if (event.eventType === "INSERT" && newRecord) {
      const isActive = newRecord.status === "pending" || newRecord.status === "generating";
      if (!compactMode || isActive) {
        updateHistoryItem(newRecord);
      }
    } else if (event.eventType === "UPDATE" && newRecord) {
      const isActive = newRecord.status === "pending" || newRecord.status === "generating";
      const isCompleted = newRecord.status === "completed";
      const isFailed = newRecord.status === "failed";

      if (compactMode && !isActive && !isCompleted && !isFailed) {
        removeHistoryItem(newRecord.id as string);
      } else if (isCompleted) {
        // Fetch full record once (no retry) to get zip_data
        const { data: fullRecord } = await supabase
          .from("generation_history")
          .select("*")
          .eq("id", newRecord.id as string)
          .single();

        if (fullRecord) {
          updateHistoryItem(fullRecord);
          if (compactMode) {
            queryClient.invalidateQueries({ queryKey: ["generationHistory", user?.id, "full"] });
          }
        } else {
          updateHistoryItem(newRecord);
        }
      } else {
        updateHistoryItem(newRecord);
      }
    } else if (event.eventType === "DELETE" && oldRecord) {
      removeHistoryItem(oldRecord.id as string);
    }
  }, [compactMode, updateHistoryItem, removeHistoryItem, queryClient, user?.id]);

  useRealtimeTable("generation_history", handleRealtimeEvent, [handleRealtimeEvent]);


  // Add optimistic item (for immediate UI feedback before DB insert)
  const addOptimisticItem = useCallback((item: Partial<HistoryItem> & { id: string }) => {
    const optimisticItem: HistoryItem = {
      id: item.id,
      number: item.number ?? 0,
      prompt: item.prompt ?? "",
      language: item.language ?? "en",
      zip_data: null,
      files_data: null,
      status: item.status ?? "pending",
      error_message: null,
      created_at: item.created_at ?? new Date().toISOString(),
      completed_at: null,
      ai_model: item.ai_model ?? null,
      website_type: item.website_type ?? null,
      site_name: item.site_name ?? null,
      sale_price: item.sale_price ?? null,
      image_source: item.image_source ?? null,
      geo: item.geo ?? null,
      admin_note: item.admin_note ?? null,
      color_scheme: item.color_scheme ?? null,
      layout_style: item.layout_style ?? null,
      improved_prompt: item.improved_prompt ?? null,
      vip_prompt: item.vip_prompt ?? null,
    };

    setAllHistory(prev => {
      // Check if already exists
      if (prev.some(h => h.id === item.id)) {
        return prev;
      }
      return [optimisticItem, ...prev];
    });
  }, []);

  return {
    history: allHistory.length > 0 ? allHistory : (initialData?.history || []),
    appeals: allAppeals.length > 0 ? allAppeals : (initialData?.appeals || []),
    isLoading: isLoading && !initialData && allHistory.length === 0,
    isFetching,
    refetch,
    updateHistoryItem,
    removeHistoryItem,
    addOptimisticItem,
    // Pagination
    hasMore,
    loadMore,
    isLoadingMore,
  };
}
