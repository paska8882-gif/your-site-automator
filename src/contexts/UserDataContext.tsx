import { createContext, useContext, ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface UserData {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isTeamOwner: boolean;
  teamId: string | null;
  maxConcurrentGenerations: number;
  loading: boolean;
  refetch: () => Promise<void>;
}

const UserDataContext = createContext<UserData | undefined>(undefined);

async function fetchUserDataFromDB(userId: string) {
  const [rolesResult, teamOwnerResult, profileResult] = await Promise.all([
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId),
    
    supabase
      .from("team_members")
      .select("team_id")
      .eq("user_id", userId)
      .eq("role", "owner")
      .eq("status", "approved")
      .maybeSingle(),
    
    supabase
      .from("profiles")
      .select("max_concurrent_generations")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const roles = rolesResult.data?.map(r => r.role) || [];
  
  return {
    isAdmin: roles.includes("admin") || roles.includes("super_admin"),
    isSuperAdmin: roles.includes("super_admin"),
    isTeamOwner: !!teamOwnerResult.data,
    teamId: teamOwnerResult.data?.team_id || null,
    maxConcurrentGenerations: profileResult.data?.max_concurrent_generations || 5,
  };
}

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["userData", user?.id],
    queryFn: () => fetchUserDataFromDB(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const value: UserData = {
    isAdmin: data?.isAdmin ?? false,
    isSuperAdmin: data?.isSuperAdmin ?? false,
    isTeamOwner: data?.isTeamOwner ?? false,
    teamId: data?.teamId ?? null,
    maxConcurrentGenerations: data?.maxConcurrentGenerations ?? 5,
    loading: isLoading,
    refetch: async () => {
      await refetch();
    },
  };

  return (
    <UserDataContext.Provider value={value}>
      {children}
    </UserDataContext.Provider>
  );
}

export function useUserData() {
  const context = useContext(UserDataContext);
  if (context === undefined) {
    throw new Error("useUserData must be used within a UserDataProvider");
  }
  return context;
}
