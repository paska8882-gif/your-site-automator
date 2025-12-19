import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useSuperAdmin = () => {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSuperAdminRole = async () => {
      if (!user) {
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();

      if (error) {
        console.error("Error checking super admin role:", error);
        setIsSuperAdmin(false);
      } else {
        setIsSuperAdmin(!!data);
      }
      setLoading(false);
    };

    checkSuperAdminRole();
  }, [user]);

  return { isSuperAdmin, loading };
};
