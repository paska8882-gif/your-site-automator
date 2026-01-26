import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCallback } from "react";

type TeamRole = "owner" | "team_lead" | "buyer" | "tech_dev";
type MemberStatus = "pending" | "approved" | "rejected";

export interface Team {
  id: string;
  name: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  status: MemberStatus;
  created_at: string;
  approved_at: string | null;
  profile?: {
    display_name: string | null;
  };
}

export interface InviteCode {
  id: string;
  code: string;
  team_id: string;
  assigned_role: TeamRole;
  used_by: string | null;
  is_active: boolean;
  created_at: string;
}

async function fetchTeams(userId: string): Promise<Team[]> {
  const { data: memberData } = await supabase
    .from("team_members")
    .select("team_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("status", "approved");

  if (!memberData || memberData.length === 0) {
    return [];
  }

  const teamIds = memberData.map(m => m.team_id);
  const { data: teamsData } = await supabase
    .from("teams")
    .select("*")
    .in("id", teamIds);

  return teamsData || [];
}

async function fetchTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data: membersData } = await supabase
    .from("team_members")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  if (!membersData) return [];

  const userIds = membersData.map(m => m.user_id);
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("user_id, display_name")
    .in("user_id", userIds);

  const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

  return membersData.map(m => ({
    ...m,
    profile: profilesMap.get(m.user_id)
  })) as TeamMember[];
}

async function fetchInviteCodes(teamId: string): Promise<InviteCode[]> {
  const { data: codesData } = await supabase
    .from("invite_codes")
    .select("*")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false });

  return (codesData || []) as InviteCode[];
}

export function useTeamsList() {
  const { user } = useAuth();

  const { data: teams = [], isLoading, refetch } = useQuery({
    queryKey: ["teams", user?.id],
    queryFn: () => fetchTeams(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  return { teams, isLoading, refetch };
}

export function useTeamMembers(teamId: string | null) {
  const queryClient = useQueryClient();

  const { data: members = [], isLoading, refetch } = useQuery({
    queryKey: ["teamMembers", teamId],
    queryFn: () => fetchTeamMembers(teamId!),
    enabled: !!teamId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["teamMembers", teamId] });
  }, [queryClient, teamId]);

  return { members, isLoading, refetch, invalidate };
}

export function useInviteCodes(teamId: string | null) {
  const queryClient = useQueryClient();

  const { data: inviteCodes = [], isLoading, refetch } = useQuery({
    queryKey: ["inviteCodes", teamId],
    queryFn: () => fetchInviteCodes(teamId!),
    enabled: !!teamId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["inviteCodes", teamId] });
  }, [queryClient, teamId]);

  return { inviteCodes, isLoading, refetch, invalidate };
}
