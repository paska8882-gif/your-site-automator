import { useUserData } from "@/contexts/UserDataContext";

export function useTeamOwner() {
  const { isTeamOwner, teamId, loading } = useUserData();
  return { isTeamOwner, loading, teamId };
}
