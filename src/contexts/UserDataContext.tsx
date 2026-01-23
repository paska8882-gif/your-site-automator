import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
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

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isTeamOwner, setIsTeamOwner] = useState(false);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [maxConcurrentGenerations, setMaxConcurrentGenerations] = useState(5);
  const [loading, setLoading] = useState(true);
  
  // Track if we've already fetched for this user to avoid duplicate requests
  const lastFetchedUserId = useRef<string | null>(null);
  const isFetching = useRef(false);

  const fetchUserData = useCallback(async () => {
    if (!user) {
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setIsTeamOwner(false);
      setTeamId(null);
      setMaxConcurrentGenerations(5);
      setLoading(false);
      lastFetchedUserId.current = null;
      return;
    }

    // Avoid duplicate fetches for same user
    if (lastFetchedUserId.current === user.id && !loading) {
      return;
    }
    
    // Prevent concurrent fetches
    if (isFetching.current) {
      return;
    }

    isFetching.current = true;
    
    try {
      // Batch all queries in parallel
      const [rolesResult, teamOwnerResult, profileResult] = await Promise.all([
        // Get all user roles in one query
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id),
        
        // Check if user is team owner
        supabase
          .from("team_members")
          .select("team_id")
          .eq("user_id", user.id)
          .eq("role", "owner")
          .eq("status", "approved")
          .maybeSingle(),
        
        // Get profile settings
        supabase
          .from("profiles")
          .select("max_concurrent_generations")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      // Process roles
      const roles = rolesResult.data?.map(r => r.role) || [];
      setIsAdmin(roles.includes("admin") || roles.includes("super_admin"));
      setIsSuperAdmin(roles.includes("super_admin"));

      // Process team ownership
      if (teamOwnerResult.data) {
        setIsTeamOwner(true);
        setTeamId(teamOwnerResult.data.team_id);
      } else {
        setIsTeamOwner(false);
        setTeamId(null);
      }

      // Process profile
      if (profileResult.data) {
        setMaxConcurrentGenerations(profileResult.data.max_concurrent_generations || 5);
      }

      lastFetchedUserId.current = user.id;
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
      isFetching.current = false;
    }
  }, [user, loading]);

  useEffect(() => {
    fetchUserData();
  }, [user?.id]); // Only re-fetch when user ID changes

  const value: UserData = {
    isAdmin,
    isSuperAdmin,
    isTeamOwner,
    teamId,
    maxConcurrentGenerations,
    loading,
    refetch: fetchUserData,
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
