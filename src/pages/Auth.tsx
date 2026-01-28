import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useMaintenanceMode } from "@/hooks/useMaintenanceMode";
import { MaintenanceOverlay } from "@/components/MaintenanceOverlay";
import { Loader2, ArrowRight } from "lucide-react";

type TeamRole = "owner" | "team_lead" | "buyer" | "tech_dev";

const roles: { id: TeamRole; name: string }[] = [
  { id: "owner", name: "Owner" },
  { id: "team_lead", name: "Team Lead" },
  { id: "buyer", name: "Buyer" },
  { id: "tech_dev", name: "Tech Dev" },
];

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading, signIn, signUp } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const { maintenance, loading: maintenanceLoading } = useMaintenanceMode();
  const isDarkTheme = theme === "dark";
  const [isLogin, setIsLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedRole, setSelectedRole] = useState<TeamRole | null>(null);

  const authSchema = z.object({
    email: z.string().trim().email({ message: t("auth.invalidEmail") }),
    password: z.string().min(6, { message: t("auth.passwordMinLength") }),
    displayName: z.string().trim().optional(),
    inviteCode: z.string().trim().optional(),
  });

  useEffect(() => {
    if (user && !loading) {
      navigate("/");
    }
  }, [user, loading, navigate]);

  const validateForm = () => {
    try {
      const schema = isLogin 
        ? authSchema.omit({ inviteCode: true, displayName: true })
        : authSchema.extend({
            inviteCode: z.string().trim().min(1, { message: t("auth.enterInviteCode") })
          });
      schema.parse({ email, password, displayName: displayName || undefined, inviteCode: inviteCode || undefined });
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          if (error.path[0]) {
            newErrors[error.path[0] as string] = error.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const validateInviteCode = async (code: string): Promise<{ valid: boolean }> => {
    // Use secure RPC function to validate without exposing all codes
    const { data, error } = await supabase.rpc('validate_invite_code', { 
      p_code: code 
    });
    
    if (error) return { valid: false };
    const result = data as { valid?: boolean } | null;
    return { valid: result?.valid || false };
  };

  const notifyAdminsAndOwners = async (teamId: string, userName: string, userRole: string) => {
    try {
      // Get all admins
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "super_admin"]);

      // Get team owners
      const { data: owners } = await supabase
        .from("team_members")
        .select("user_id")
        .eq("team_id", teamId)
        .eq("role", "owner")
        .eq("status", "approved");

      // Get team name
      const { data: team } = await supabase
        .from("teams")
        .select("name")
        .eq("id", teamId)
        .single();

      const teamName = team?.name || "Невідома команда";

      // Combine unique user IDs
      const userIds = new Set<string>();
      admins?.forEach(a => userIds.add(a.user_id));
      owners?.forEach(o => userIds.add(o.user_id));

      // Create notifications via secure edge function
      const notifications = Array.from(userIds).map(userId => ({
        user_id: userId,
        type: "member_pending_approval",
        title: "Новий користувач очікує підтвердження",
        message: `${userName || "Новий користувач"} (${userRole}) зареєструвався в команді "${teamName}" і очікує підтвердження.`,
        data: { team_id: teamId, tab: "users" }
      }));

      if (notifications.length > 0) {
        await supabase.functions.invoke('create-notification', {
          body: { notifications }
        });
      }
    } catch (error) {
      console.error("Error sending notifications:", error);
    }
  };

  const registerWithInviteCode = async (code: string, userId: string) => {
    const { data, error } = await supabase.rpc("register_with_invite_code", {
      p_invite_code: code,
      p_user_id: userId
    });
    
    if (error) {
      console.error("Registration error:", error);
      return { success: false, error: error.message };
    }
    
    return data as { success: boolean; team_id?: string; role?: string; status?: string; error?: string };
  };

  const verifyUserRole = async (userId: string, expectedRole: TeamRole): Promise<{ valid: boolean; actualRole?: string }> => {
    const { data, error } = await supabase
      .from("team_members")
      .select("role")
      .eq("user_id", userId)
      .eq("status", "approved")
      .maybeSingle();
    
    if (error || !data) {
      return { valid: false };
    }
    
    return { 
      valid: data.role === expectedRole,
      actualRole: data.role 
    };
  };

  const checkIsAdmin = async (userId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    
    return !error && !!data;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      if (isLogin) {
        const { error, data } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: t("auth.loginError"),
              description: t("auth.invalidCredentials"),
              variant: "destructive",
            });
          } else {
            toast({
              title: t("common.error"),
              description: error.message,
              variant: "destructive",
            });
          }
          setIsSubmitting(false);
          return;
        }
        
        if (data?.user) {
          // Перевіряємо чи користувач адмін - адміни пропускають перевірку ролі
          const isAdmin = await checkIsAdmin(data.user.id);
          
          if (!isAdmin) {
            // Для не-адмінів перевіряємо вибір ролі
            if (!selectedRole) {
              await supabase.auth.signOut();
              toast({
                title: t("auth.selectRole"),
                description: t("auth.selectRoleDescription"),
                variant: "destructive",
              });
              setIsSubmitting(false);
              return;
            }
            
            // Перевіряємо роль користувача в команді
            const roleCheck = await verifyUserRole(data.user.id, selectedRole);
            
            if (!roleCheck.valid) {
              await supabase.auth.signOut();
              toast({
                title: t("auth.wrongRole"),
                description: roleCheck.actualRole 
                  ? `${t("auth.yourRoleIs")} ${roleCheck.actualRole}. ${t("auth.selectCorrectRole")}`
                  : t("auth.notApproved"),
                variant: "destructive",
              });
              setIsSubmitting(false);
              return;
            }
          }
        }
        
        toast({
          title: t("auth.loginSuccess"),
          description: t("auth.welcome"),
        });
      } else {
        const codeResult = await validateInviteCode(inviteCode);
        if (!codeResult.valid) {
          toast({
            title: t("auth.registrationError"),
            description: t("auth.invalidInviteCode"),
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        const { data, error } = await signUp(email, password, displayName);
        if (error) {
          if (error.message.includes("User already registered")) {
            toast({
              title: t("auth.registrationError"),
              description: t("auth.userExists"),
              variant: "destructive",
            });
          } else {
            toast({
              title: t("common.error"),
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          if (data?.user) {
            // Використовуємо функцію з підвищеними правами для реєстрації
            const regResult = await registerWithInviteCode(inviteCode, data.user.id);
            
            if (!regResult.success) {
              toast({
                title: t("common.error"),
                description: regResult.error || t("errors.somethingWentWrong"),
                variant: "destructive",
              });
              setIsSubmitting(false);
              return;
            }
            
            const isOwner = regResult.role === "owner";
            const isPending = regResult.team_id && !isOwner;
            
            // Notify admins and team owners about pending approval
            if (isPending && regResult.team_id) {
              await notifyAdminsAndOwners(regResult.team_id, displayName, regResult.role || "member");
            }
            
            toast({
              title: t("auth.registrationSuccess"),
              description: isPending
                ? t("auth.awaitApproval")
                : t("auth.accountCreated"),
            });
          } else {
            toast({
              title: t("auth.registrationSuccess"),
              description: t("auth.accountCreated"),
            });
          }
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || maintenanceLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkTheme ? 'bg-black' : 'bg-white'}`}>
        <Loader2 className={`h-8 w-8 animate-spin ${isDarkTheme ? 'text-white' : 'text-black'}`} />
      </div>
    );
  }

  // Show maintenance overlay if maintenance mode is enabled
  if (maintenance.enabled) {
    return (
      <MaintenanceOverlay
        message={maintenance.message}
        supportLink={maintenance.support_link}
      />
    );
  }

  return (
    <div className={`min-h-screen flex relative transition-colors duration-500 ${isDarkTheme ? 'bg-black' : 'bg-white'}`}>
      {/* Center transition effect */}
      <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 -translate-x-1/2 z-20 w-48 pointer-events-none">
        <div className={`absolute inset-0 bg-gradient-to-r from-transparent ${isDarkTheme ? 'via-white/[0.02]' : 'via-black/[0.02]'} to-transparent blur-2xl`} />
        <div className={`absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-gradient-to-b ${isDarkTheme ? 'from-white/5 via-white/15 to-white/5' : 'from-black/5 via-black/15 to-black/5'}`} />
      </div>

      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background gradient */}
        <div className={`absolute inset-0 transition-colors duration-500 ${
          isDarkTheme 
            ? 'bg-gradient-to-r from-black via-neutral-950 to-neutral-900' 
            : 'bg-gradient-to-r from-white via-neutral-50 to-neutral-100'
        }`} />
        
        {/* Animated particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className={`absolute rounded-full ${isDarkTheme ? 'bg-white/10' : 'bg-black/10'}`}
              style={{
                width: Math.random() * 4 + 2 + 'px',
                height: Math.random() * 4 + 2 + 'px',
                left: Math.random() * 100 + '%',
                top: Math.random() * 100 + '%',
                animation: `float ${Math.random() * 10 + 15}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 5}s`,
              }}
            />
          ))}
        </div>
        
        {/* Decorative glows */}
        <div className={`absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl ${isDarkTheme ? 'bg-white/[0.02]' : 'bg-black/[0.02]'}`} />
        <div className={`absolute bottom-0 left-0 w-80 h-80 rounded-full blur-3xl ${isDarkTheme ? 'bg-white/[0.02]' : 'bg-black/[0.02]'}`} />
        
        {/* Content */}
        <div className="relative z-10 animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'backwards' }}>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="relative group cursor-pointer"
            >
              <div className={`absolute inset-0 rounded-lg blur-md animate-pulse opacity-20 pointer-events-none ${isDarkTheme ? 'bg-white' : 'bg-black'}`} />
              <div className={`relative w-10 h-10 rounded-lg flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-110 group-active:scale-95 pointer-events-none ${
                isDarkTheme ? 'bg-white shadow-white/20' : 'bg-black shadow-black/20'
              }`}>
                <span className={`font-bold text-lg pointer-events-none ${isDarkTheme ? 'text-black' : 'text-white'}`}>D</span>
              </div>
            </button>
            <span className={`font-semibold text-xl tracking-tight ${isDarkTheme ? 'text-white' : 'text-black'}`}>
              DRAGON<span className="text-neutral-400">WHITE</span>
            </span>
          </div>
        </div>

        <div className="relative z-10 max-w-md animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'backwards' }}>
          <h1 className="text-5xl xl:text-6xl font-bold leading-tight mb-6">
            <span className={isDarkTheme ? 'text-white' : 'text-black'}>{t("auth.createSites")}</span>
            <br />
            <span className={isDarkTheme ? 'text-neutral-500' : 'text-neutral-400'}>
              {t("auth.withAI")}
            </span>
          </h1>
          <p className={`text-lg leading-relaxed ${isDarkTheme ? 'text-neutral-400' : 'text-neutral-500'}`}>
            {t("auth.heroDescription")}
          </p>
        </div>

        <div className={`relative z-10 flex items-center gap-8 text-sm animate-fade-in ${isDarkTheme ? 'text-neutral-500' : 'text-neutral-400'}`} style={{ animationDelay: '0.5s', animationFillMode: 'backwards' }}>
          <div>
            <span className={`font-semibold text-2xl ${isDarkTheme ? 'text-white' : 'text-black'}`}>24</span>
            <span className="ml-1">{t("auth.languages")}</span>
          </div>
          <div className={`w-px h-8 ${isDarkTheme ? 'bg-neutral-700' : 'bg-neutral-200'}`} />
          <div>
            <span className={`font-semibold text-2xl ${isDarkTheme ? 'text-white' : 'text-black'}`}>2</span>
            <span className="ml-1">{t("auth.aiModels")}</span>
          </div>
          <div className={`w-px h-8 ${isDarkTheme ? 'bg-neutral-700' : 'bg-neutral-200'}`} />
          <div>
            <span className={`font-semibold text-2xl ${isDarkTheme ? 'text-white' : 'text-black'}`}>10+</span>
            <span className="ml-1">{t("auth.styles")}</span>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-8 lg:p-12 relative overflow-hidden">
        {/* Gradient background */}
        <div className={`absolute inset-0 transition-colors duration-500 ${
          isDarkTheme 
            ? 'bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-700' 
            : 'bg-gradient-to-r from-neutral-100 via-neutral-200 to-neutral-300'
        }`} />
        
        {/* Glow accents */}
        <div className={`absolute top-1/4 right-1/4 w-64 h-64 rounded-full blur-3xl ${isDarkTheme ? 'bg-white/[0.02]' : 'bg-black/[0.02]'}`} />
        <div className={`absolute bottom-1/3 left-1/3 w-48 h-48 rounded-full blur-2xl ${isDarkTheme ? 'bg-white/[0.02]' : 'bg-black/[0.02]'}`} />
        
        <div className="w-full max-w-md relative z-10">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10 animate-fade-in">
            <button 
              onClick={toggleTheme}
              className="relative group cursor-pointer"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-110 group-active:scale-95 pointer-events-none ${
                isDarkTheme ? 'bg-white shadow-white/10' : 'bg-black shadow-black/10'
              }`}>
                <span className={`font-bold text-lg pointer-events-none ${isDarkTheme ? 'text-black' : 'text-white'}`}>D</span>
              </div>
            </button>
            <span className={`font-semibold text-xl tracking-tight ${isDarkTheme ? 'text-white' : 'text-black'}`}>
              DRAGON<span className="text-neutral-400">WHITE</span>
            </span>
            <div className="ml-auto">
              <LanguageSwitcher variant="minimal" className={isDarkTheme ? 'text-white hover:bg-white/10' : 'text-black hover:bg-black/10'} />
            </div>
          </div>

          {/* Header */}
          <div className="mb-8 animate-fade-in">
            <h2 className={`text-2xl font-bold mb-2 ${isDarkTheme ? 'text-white' : 'text-black'}`}>
              {isLogin ? t("auth.loginTitle") : t("auth.registerTitle")}
            </h2>
            <p className={`text-sm ${isDarkTheme ? 'text-neutral-400' : 'text-neutral-500'}`}>
              {isLogin
                ? t("auth.loginSubtitle")
                : t("auth.registerSubtitle")}
            </p>
          </div>

          {/* Role Selection - Minimal inline style */}
          {isLogin && (
            <div className="mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center gap-1.5">
                {roles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    onClick={() => setSelectedRole(role.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                      selectedRole === role.id
                        ? isDarkTheme 
                          ? 'bg-white text-black shadow-lg shadow-white/20'
                          : 'bg-black text-white shadow-lg shadow-black/20'
                        : isDarkTheme
                          ? 'bg-white/10 text-neutral-400 hover:bg-white/15 hover:text-white'
                          : 'bg-black/5 text-neutral-500 hover:bg-black/10 hover:text-black'
                    }`}
                  >
                    {role.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            {!isLogin && (
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="inviteCode" className={`text-xs font-medium ${isDarkTheme ? 'text-neutral-300' : 'text-neutral-600'}`}>
                    {t("auth.inviteCode")}
                  </Label>
                  <Input
                    id="inviteCode"
                    type="text"
                    placeholder="XXXXXXXX"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    disabled={isSubmitting}
                    className={`h-10 transition-all ${
                      isDarkTheme 
                        ? 'bg-white/10 border-white/10 text-white placeholder:text-neutral-500 focus:border-white/30' 
                        : 'bg-white/80 border-black/10 text-black placeholder:text-neutral-400 focus:border-black/30'
                    } focus:ring-0 ${errors.inviteCode ? "border-red-500" : ""}`}
                    maxLength={8}
                  />
                  {errors.inviteCode && (
                    <p className="text-xs text-red-500">{errors.inviteCode}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName" className={`text-xs font-medium ${isDarkTheme ? 'text-neutral-300' : 'text-neutral-600'}`}>
                    {t("auth.displayName")}
                  </Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder={t("auth.yourName")}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={isSubmitting}
                    className={`h-10 transition-all ${
                      isDarkTheme 
                        ? 'bg-white/10 border-white/10 text-white placeholder:text-neutral-500 focus:border-white/30' 
                        : 'bg-white/80 border-black/10 text-black placeholder:text-neutral-400 focus:border-black/30'
                    } focus:ring-0`}
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className={`text-xs font-medium ${isDarkTheme ? 'text-neutral-300' : 'text-neutral-600'}`}>
                {t("auth.email")}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className={`h-10 transition-all ${
                  isDarkTheme 
                    ? 'bg-white/10 border-white/10 text-white placeholder:text-neutral-500 focus:border-white/30' 
                    : 'bg-white/80 border-black/10 text-black placeholder:text-neutral-400 focus:border-black/30'
                } focus:ring-0 ${errors.email ? "border-red-500" : ""}`}
              />
              {errors.email && (
                <p className="text-xs text-red-500">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className={`text-xs font-medium ${isDarkTheme ? 'text-neutral-300' : 'text-neutral-600'}`}>
                {t("auth.password")}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className={`h-10 transition-all ${
                  isDarkTheme 
                    ? 'bg-white/10 border-white/10 text-white placeholder:text-neutral-500 focus:border-white/30' 
                    : 'bg-white/80 border-black/10 text-black placeholder:text-neutral-400 focus:border-black/30'
                } focus:ring-0 ${errors.password ? "border-red-500" : ""}`}
              />
              {errors.password && (
                <p className="text-xs text-red-500">{errors.password}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className={`w-full h-10 font-medium transition-all duration-200 border-0 shadow-lg hover:shadow-xl ${
                isDarkTheme 
                  ? 'bg-white hover:bg-neutral-200 text-black shadow-white/10 hover:shadow-white/20' 
                  : 'bg-black hover:bg-neutral-800 text-white shadow-black/10 hover:shadow-black/20'
              }`}
              disabled={isSubmitting || (isLogin && !selectedRole)}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {isLogin ? t("auth.login") : t("auth.register")}
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              )}
            </Button>
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
            {isLogin ? (
              <p className={`text-sm ${isDarkTheme ? 'text-neutral-400' : 'text-neutral-500'}`}>
                {t("auth.noAccount")}{" "}
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className={`font-medium hover:underline ${isDarkTheme ? 'text-white' : 'text-black'}`}
                >
                  {t("auth.register")}
                </button>
              </p>
            ) : (
              <p className={`text-sm ${isDarkTheme ? 'text-neutral-400' : 'text-neutral-500'}`}>
                {t("auth.hasAccount")}{" "}
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className={`font-medium hover:underline ${isDarkTheme ? 'text-white' : 'text-black'}`}
                >
                  {t("auth.login")}
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
