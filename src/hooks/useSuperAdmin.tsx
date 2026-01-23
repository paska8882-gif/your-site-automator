import { useUserData } from "@/contexts/UserDataContext";

export const useSuperAdmin = () => {
  const { isSuperAdmin, loading } = useUserData();
  return { isSuperAdmin, loading };
};
