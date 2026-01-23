import { useUserData } from "@/contexts/UserDataContext";

export const useAdmin = () => {
  const { isAdmin, loading } = useUserData();
  return { isAdmin, loading };
};
