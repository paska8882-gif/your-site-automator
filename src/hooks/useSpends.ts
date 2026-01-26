import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface GeneratedFile {
  path: string;
  content: string;
}

export interface GenerationWithSpend {
  id: string;
  number: number;
  prompt: string;
  improved_prompt: string | null;
  site_name: string | null;
  language: string;
  website_type: string | null;
  ai_model: string | null;
  specific_ai_model: string | null;
  created_at: string;
  completed_at: string | null;
  status: string;
  files_data: GeneratedFile[] | null;
  sale_price: number | null;
  spend_id: string | null;
  spend_amount: number;
  spend_notes: string | null;
  is_favorite: boolean;
}

interface SpendsCacheData {
  generations: GenerationWithSpend[];
  timestamp: number;
}

const CACHE_KEY = "spends_cache_v2_";
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getCachedSpends(userId: string): SpendsCacheData | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY + userId);
    if (!cached) return null;
    
    const data: SpendsCacheData = JSON.parse(cached);
    if (Date.now() - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY + userId);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function setCachedSpends(userId: string, generations: GenerationWithSpend[]) {
  try {
    // Store without files_data to save space
    const dataToCache = generations.map(g => ({
      ...g,
      files_data: null, // Don't cache large file data
    }));
    localStorage.setItem(CACHE_KEY + userId, JSON.stringify({
      generations: dataToCache,
      timestamp: Date.now(),
    }));
  } catch {
    // localStorage might be full, ignore
  }
}

async function fetchGenerationsWithSpends(userId: string, offset: number, limit: number): Promise<{
  generations: GenerationWithSpend[];
  hasMore: boolean;
}> {
  const { data: genData, error } = await supabase
    .from("generation_history")
    .select("id, number, prompt, improved_prompt, site_name, language, website_type, ai_model, specific_ai_model, created_at, completed_at, status, files_data, sale_price")
    .eq("user_id", userId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const genIds = genData?.map(g => g.id) || [];
  let spendsMap: Record<string, { id: string; spend_amount: number; notes: string | null; is_favorite: boolean }> = {};
  
  if (genIds.length > 0) {
    const { data: spendsData } = await supabase
      .from("generation_spends")
      .select("id, generation_id, spend_amount, notes, is_favorite")
      .in("generation_id", genIds);

    if (spendsData) {
      spendsData.forEach(s => {
        spendsMap[s.generation_id] = { 
          id: s.id, 
          spend_amount: s.spend_amount, 
          notes: s.notes,
          is_favorite: s.is_favorite 
        };
      });
    }
  }

  const combined: GenerationWithSpend[] = (genData || []).map(g => ({
    ...g,
    files_data: (Array.isArray(g.files_data) ? g.files_data as unknown as GeneratedFile[] : null),
    spend_id: spendsMap[g.id]?.id || null,
    spend_amount: spendsMap[g.id]?.spend_amount || 0,
    spend_notes: spendsMap[g.id]?.notes || null,
    is_favorite: spendsMap[g.id]?.is_favorite || false,
  }));

  return {
    generations: combined,
    hasMore: (genData?.length || 0) === limit,
  };
}

export function useSpends() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [allGenerations, setAllGenerations] = useState<GenerationWithSpend[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 50;

  // Initial load with React Query
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["spends", user?.id, "initial"],
    queryFn: async () => {
      const cached = getCachedSpends(user!.id);
      if (cached) {
        // Return cached immediately, but also fetch fresh data
        setTimeout(() => {
          fetchGenerationsWithSpends(user!.id, 0, PAGE_SIZE).then(result => {
            setAllGenerations(result.generations);
            setHasMore(result.hasMore);
            setCachedSpends(user!.id, result.generations);
          });
        }, 0);
        return cached.generations;
      }
      
      const result = await fetchGenerationsWithSpends(user!.id, 0, PAGE_SIZE);
      setCachedSpends(user!.id, result.generations);
      return result.generations;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  // Sync query data to local state
  useEffect(() => {
    if (data) {
      setAllGenerations(data);
    }
  }, [data]);

  const loadMore = useCallback(async () => {
    if (!user || loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    try {
      const result = await fetchGenerationsWithSpends(user.id, allGenerations.length, PAGE_SIZE);
      setAllGenerations(prev => {
        const newList = [...prev, ...result.generations];
        setCachedSpends(user.id, newList);
        return newList;
      });
      setHasMore(result.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [user, loadingMore, hasMore, allGenerations.length]);

  const refreshData = useCallback(async () => {
    if (!user) return;
    
    const result = await fetchGenerationsWithSpends(user.id, 0, PAGE_SIZE);
    setAllGenerations(result.generations);
    setHasMore(result.hasMore);
    setCachedSpends(user.id, result.generations);
    queryClient.setQueryData(["spends", user.id, "initial"], result.generations);
  }, [user, queryClient]);

  const updateGeneration = useCallback((id: string, updates: Partial<GenerationWithSpend>) => {
    setAllGenerations(prev => 
      prev.map(g => g.id === id ? { ...g, ...updates } : g)
    );
  }, []);

  const clearCache = useCallback(() => {
    if (user) {
      localStorage.removeItem(CACHE_KEY + user.id);
    }
  }, [user]);

  return {
    generations: allGenerations,
    isLoading,
    loadingMore,
    hasMore,
    loadMore,
    refreshData,
    updateGeneration,
    clearCache,
    refetch,
  };
}
