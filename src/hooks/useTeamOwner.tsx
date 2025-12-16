import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useTeamOwner() {
  const { user } = useAuth();
  const [isTeamOwner, setIsTeamOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [teamId, setTeamId] = useState<string | null>(null);

  useEffect(() => {
    const checkTeamOwnership = async () => {
      if (!user) {
        setIsTeamOwner(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .eq("status", "approved")
        .maybeSingle();

      if (!error && data) {
        setIsTeamOwner(true);
        setTeamId(data.team_id);
      } else {
        setIsTeamOwner(false);
        setTeamId(null);
      }
      setLoading(false);
    };

    checkTeamOwnership();
  }, [user]);

  return { isTeamOwner, loading, teamId };
}
