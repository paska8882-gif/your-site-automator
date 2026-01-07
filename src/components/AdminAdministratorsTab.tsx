import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { AdminPageHeader } from "@/components/AdminPageHeader";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  Shield, 
  ShieldOff,
  UserPlus,
  Loader2,
  Crown,
  AlertTriangle,
  Lock,
  Check,
  ChevronsUpDown,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

const SUPER_ADMIN_EMAIL = "paska8882@gmail.com";

interface Admin {
  user_id: string;
  display_name: string | null;
  created_at: string;
  role_created_at: string;
}

interface UserProfile {
  user_id: string;
  display_name: string | null;
  email?: string;
}

export const AdminAdministratorsTab = () => {
  const { toast } = useToast();
  const { t } = useLanguage();
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Add admin dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [superAdminPassword, setSuperAdminPassword] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [userComboboxOpen, setUserComboboxOpen] = useState(false);
  
  // Remove admin dialog  
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [adminToRemove, setAdminToRemove] = useState<Admin | null>(null);
  const [removePassword, setRemovePassword] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch all admin roles
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id, created_at")
      .eq("role", "admin")
      .order("created_at", { ascending: false });

    // Fetch all profiles
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("user_id, display_name");

    const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
    
    const adminsWithProfiles: Admin[] = (adminRoles || []).map(role => ({
      user_id: role.user_id,
      display_name: profilesMap.get(role.user_id)?.display_name || null,
      created_at: profilesMap.get(role.user_id)?.display_name ? "" : "",
      role_created_at: role.created_at
    }));

    // Get users who are not admins for the dropdown
    const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);
    const nonAdminUsers = (profilesData || []).filter(p => !adminUserIds.has(p.user_id));

    setAdmins(adminsWithProfiles);
    setAllUsers(nonAdminUsers);
    setLoading(false);
  };

  const verifySuperAdminPassword = async (password: string): Promise<boolean> => {
    try {
      // Try to sign in with super admin credentials
      const { error } = await supabase.auth.signInWithPassword({
        email: SUPER_ADMIN_EMAIL,
        password: password
      });
      
      if (error) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  };

  const handleAddAdmin = async () => {
    if (!selectedUserId || !superAdminPassword) {
      toast({
        title: t("common.error"),
        description: t("admin.selectUserForAdmin"),
        variant: "destructive"
      });
      return;
    }

    setVerifying(true);
    
    const isValid = await verifySuperAdminPassword(superAdminPassword);
    
    if (!isValid) {
      toast({
        title: t("common.error"),
        description: t("admin.passwordIncorrect"),
        variant: "destructive"
      });
      setVerifying(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("user_roles")
        .insert({
          user_id: selectedUserId,
          role: "admin"
        });

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("admin.adminAdded")
      });

      setAddDialogOpen(false);
      setSelectedUserId("");
      setSuperAdminPassword("");
      fetchData();
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("admin.addAdminError"),
        variant: "destructive"
      });
    }
    
    setVerifying(false);
  };

  const handleRemoveAdmin = async () => {
    if (!adminToRemove || !removePassword) {
      toast({
        title: t("common.error"),
        description: t("admin.superAdminPassword"),
        variant: "destructive"
      });
      return;
    }

    setVerifying(true);
    
    const isValid = await verifySuperAdminPassword(removePassword);
    
    if (!isValid) {
      toast({
        title: t("common.error"),
        description: t("admin.passwordIncorrect"),
        variant: "destructive"
      });
      setVerifying(false);
      return;
    }

    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", adminToRemove.user_id)
        .eq("role", "admin");

      if (error) throw error;

      toast({
        title: t("common.success"),
        description: t("admin.adminRemoved")
      });

      setRemoveDialogOpen(false);
      setAdminToRemove(null);
      setRemovePassword("");
      fetchData();
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("admin.removeAdminError"),
        variant: "destructive"
      });
    }
    
    setVerifying(false);
  };

  const openRemoveDialog = (admin: Admin) => {
    setAdminToRemove(admin);
    setRemoveDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader 
        icon={Settings} 
        title={t("admin.administratorsTitle")} 
        description={t("admin.administratorsDescription")} 
      />
      {/* Info Card */}
      <Card className="border-yellow-500/50 bg-yellow-500/10">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-500">{t("appeals.attention")}</p>
            <p className="text-sm text-muted-foreground">
              {t("admin.superAdminNote")} ({SUPER_ADMIN_EMAIL}).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <Card>
          <CardContent className="p-4 text-center">
            <Shield className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold">{admins.length}</div>
            <div className="text-xs text-muted-foreground">{t("admin.adminsTotal")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Crown className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
            <div className="text-2xl font-bold">1</div>
            <div className="text-xs text-muted-foreground">{t("admin.superAdminsCount")}</div>
          </CardContent>
        </Card>
      </div>

      {/* Admins Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("admin.currentAdmins")}
          </CardTitle>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                {t("admin.addAdmin")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  {t("admin.addAdmin")}
                </DialogTitle>
                <DialogDescription>
                  {t("admin.superAdminNote")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t("admin.selectUserForAdmin")}</Label>
                  <Popover open={userComboboxOpen} onOpenChange={setUserComboboxOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={userComboboxOpen}
                        className="w-full justify-between"
                      >
                        {selectedUserId
                          ? allUsers.find(u => u.user_id === selectedUserId)?.display_name || 
                            allUsers.find(u => u.user_id === selectedUserId)?.user_id.slice(0, 8) + "..."
                          : t("common.search") + "..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder={t("common.search") + "..."} />
                        <CommandList>
                          <CommandEmpty>{t("users.noUsers")}</CommandEmpty>
                          <CommandGroup>
                            {allUsers.map(user => (
                              <CommandItem
                                key={user.user_id}
                                value={`${user.display_name || ""} ${user.user_id}`}
                                onSelect={() => {
                                  setSelectedUserId(user.user_id);
                                  setUserComboboxOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedUserId === user.user_id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span>{user.display_name || t("users.noName")}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {user.user_id.slice(0, 12)}...
                                  </span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>{t("admin.superAdminPassword")}</Label>
                  <Input
                    type="password"
                    value={superAdminPassword}
                    onChange={(e) => setSuperAdminPassword(e.target.value)}
                    placeholder={t("auth.password")}
                  />
                </div>
                <Button 
                  onClick={handleAddAdmin} 
                  disabled={!selectedUserId || !superAdminPassword || verifying}
                  className="w-full"
                >
                  {verifying ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Shield className="h-4 w-4 mr-2" />
                  )}
                  {t("admin.addAdmin")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {admins.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">{t("admin.noAdmins")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("users.user")}</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>{t("admin.roleDate")}</TableHead>
                  <TableHead className="text-right">{t("sites.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map(admin => (
                  <TableRow key={admin.user_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{admin.display_name || t("users.noName")}</span>
                        <Badge className="bg-primary">{t("admin.roleAdmin")}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {admin.user_id.slice(0, 12)}...
                    </TableCell>
                    <TableCell>
                      {new Date(admin.role_created_at).toLocaleDateString("uk-UA")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => openRemoveDialog(admin)}
                      >
                        <ShieldOff className="h-4 w-4 mr-1" />
                        {t("admin.removeAdmin")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Remove Admin Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldOff className="h-5 w-5" />
              {t("admin.removeAdmin")}
            </DialogTitle>
            <DialogDescription>
              {t("admin.confirmRemove")} {adminToRemove?.display_name || adminToRemove?.user_id.slice(0, 8)}?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("admin.superAdminPassword")}</Label>
              <Input
                type="password"
                value={removePassword}
                onChange={(e) => setRemovePassword(e.target.value)}
                placeholder={t("auth.password")}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setRemoveDialogOpen(false)}
                className="flex-1"
              >
                {t("common.cancel")}
              </Button>
              <Button 
                variant="destructive"
                onClick={handleRemoveAdmin} 
                disabled={!removePassword || verifying}
                className="flex-1"
              >
                {verifying ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <ShieldOff className="h-4 w-4 mr-2" />
                )}
                {t("admin.removeAdmin")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
