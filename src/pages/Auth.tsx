import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ArrowRight, Sun, Moon } from "lucide-react";

const authSchema = z.object({
  email: z.string().trim().email({ message: "Невірний формат email" }),
  password: z.string().min(6, { message: "Пароль має бути мінімум 6 символів" }),
  displayName: z.string().trim().optional(),
  inviteCode: z.string().trim().optional(),
});

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
  const [isLogin, setIsLogin] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedRole, setSelectedRole] = useState<TeamRole | null>(null);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleThemeToggle = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setIsDarkTheme(!isDarkTheme);
    }, 600);
    setTimeout(() => {
      setIsTransitioning(false);
    }, 1200);
  };

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
            inviteCode: z.string().trim().min(1, { message: "Введіть інвайт-код" })
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

  const validateInviteCode = async (code: string): Promise<{ valid: boolean; teamId?: string; role?: string }> => {
    const { data, error } = await supabase
      .from("invite_codes")
      .select("id, team_id, assigned_role")
      .eq("code", code.toUpperCase())
      .eq("is_active", true)
      .is("used_by", null)
      .maybeSingle();
    
    if (error || !data) {
      return { valid: false };
    }
    
    return { 
      valid: true, 
      teamId: data.team_id || undefined,
      role: data.assigned_role || undefined
    };
  };

  const markInviteCodeAsUsed = async (code: string, userId: string) => {
    await supabase
      .from("invite_codes")
      .update({ used_by: userId, used_at: new Date().toISOString() })
      .eq("code", code.toUpperCase());
  };

  const joinTeam = async (userId: string, teamId: string, role: string) => {
    const isOwner = role === "owner";

    await supabase.from("team_members").insert({
      team_id: teamId,
      user_id: userId,
      role: role as "owner" | "team_lead" | "buyer" | "tech_dev",
      status: (isOwner ? "approved" : "pending") as "approved" | "pending",
      approved_at: isOwner ? new Date().toISOString() : null,
      approved_by: isOwner ? userId : null
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Invalid login credentials")) {
            toast({
              title: "Помилка входу",
              description: "Невірний email або пароль",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Помилка",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Успішний вхід",
            description: "Ласкаво просимо!",
          });
        }
      } else {
        const codeResult = await validateInviteCode(inviteCode);
        if (!codeResult.valid) {
          toast({
            title: "Помилка реєстрації",
            description: "Невірний або використаний інвайт-код",
            variant: "destructive",
          });
          setIsSubmitting(false);
          return;
        }

        const { data, error } = await signUp(email, password, displayName);
        if (error) {
          if (error.message.includes("User already registered")) {
            toast({
              title: "Помилка реєстрації",
              description: "Користувач з таким email вже існує",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Помилка",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          if (data?.user) {
            await markInviteCodeAsUsed(inviteCode, data.user.id);
            
            if (codeResult.teamId && codeResult.role) {
              await joinTeam(data.user.id, codeResult.teamId, codeResult.role);
            }
          }
          
          const isOwner = codeResult.role === "owner";
          const isPending = codeResult.teamId && !isOwner;
          
          toast({
            title: "Реєстрація успішна",
            description: isPending 
              ? "Ваш акаунт створено! Очікуйте затвердження від Owner команди." 
              : "Ваш акаунт створено!",
          });
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkTheme ? 'bg-black' : 'bg-white'}`}>
        <Loader2 className={`h-8 w-8 animate-spin ${isDarkTheme ? 'text-white' : 'text-black'}`} />
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex relative transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)] ${isDarkTheme ? 'bg-black' : 'bg-white'}`}>
      {/* Transition Overlay */}
      <div 
        className="fixed inset-0 z-[100] pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.9) 100%)',
          opacity: isTransitioning ? 1 : 0,
          transform: isTransitioning ? 'scale(1)' : 'scale(1.2)',
          transition: 'opacity 700ms cubic-bezier(0.4, 0, 0.2, 1), transform 700ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />

      {/* Theme Toggle */}
      <button
        onClick={handleThemeToggle}
        disabled={isTransitioning}
        className={`absolute top-6 right-6 z-50 p-2.5 rounded-full ${
          isDarkTheme 
            ? 'bg-white/10 hover:bg-white/20 text-white' 
            : 'bg-black/5 hover:bg-black/10 text-black'
        }`}
        style={{
          transform: isTransitioning ? 'scale(0.8)' : 'scale(1)',
          opacity: isTransitioning ? 0.4 : 1,
          transition: 'all 600ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div 
          style={{
            transform: isTransitioning ? 'rotate(360deg)' : 'rotate(0deg)',
            transition: 'transform 1000ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {isDarkTheme ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </div>
      </button>

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
            <div className="relative">
              <div className={`absolute inset-0 rounded-lg blur-md animate-pulse opacity-20 ${isDarkTheme ? 'bg-white' : 'bg-black'}`} />
              <div className={`relative w-10 h-10 rounded-lg flex items-center justify-center shadow-lg ${
                isDarkTheme ? 'bg-white shadow-white/20' : 'bg-black shadow-black/20'
              }`}>
                <span className={`font-bold text-lg ${isDarkTheme ? 'text-black' : 'text-white'}`}>D</span>
              </div>
            </div>
            <span className={`font-semibold text-xl tracking-tight ${isDarkTheme ? 'text-white' : 'text-black'}`}>
              DRAGON<span className="text-neutral-400">WHITE</span>
            </span>
          </div>
        </div>

        <div className="relative z-10 max-w-md animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'backwards' }}>
          <h1 className="text-5xl xl:text-6xl font-bold leading-tight mb-6">
            <span className={isDarkTheme ? 'text-white' : 'text-black'}>Створюй сайти</span>
            <br />
            <span className={isDarkTheme ? 'text-neutral-500' : 'text-neutral-400'}>
              за допомогою AI
            </span>
          </h1>
          <p className={`text-lg leading-relaxed ${isDarkTheme ? 'text-neutral-400' : 'text-neutral-500'}`}>
            Професійний генератор вебсайтів на базі штучного інтелекту. 
            Опиши свою ідею — отримай готовий сайт за лічені хвилини.
          </p>
        </div>

        <div className={`relative z-10 flex items-center gap-8 text-sm animate-fade-in ${isDarkTheme ? 'text-neutral-500' : 'text-neutral-400'}`} style={{ animationDelay: '0.5s', animationFillMode: 'backwards' }}>
          <div>
            <span className={`font-semibold text-2xl ${isDarkTheme ? 'text-white' : 'text-black'}`}>24</span>
            <span className="ml-1">мови</span>
          </div>
          <div className={`w-px h-8 ${isDarkTheme ? 'bg-neutral-700' : 'bg-neutral-200'}`} />
          <div>
            <span className={`font-semibold text-2xl ${isDarkTheme ? 'text-white' : 'text-black'}`}>2</span>
            <span className="ml-1">AI моделі</span>
          </div>
          <div className={`w-px h-8 ${isDarkTheme ? 'bg-neutral-700' : 'bg-neutral-200'}`} />
          <div>
            <span className={`font-semibold text-2xl ${isDarkTheme ? 'text-white' : 'text-black'}`}>10+</span>
            <span className="ml-1">стилів</span>
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
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-lg ${
              isDarkTheme ? 'bg-white shadow-white/10' : 'bg-black shadow-black/10'
            }`}>
              <span className={`font-bold text-lg ${isDarkTheme ? 'text-black' : 'text-white'}`}>D</span>
            </div>
            <span className={`font-semibold text-xl tracking-tight ${isDarkTheme ? 'text-white' : 'text-black'}`}>
              DRAGON<span className="text-neutral-400">WHITE</span>
            </span>
          </div>

          {/* Header */}
          <div className="mb-8 animate-fade-in">
            <h2 className={`text-2xl font-bold mb-2 ${isDarkTheme ? 'text-white' : 'text-black'}`}>
              {isLogin ? "Вхід в акаунт" : "Створити акаунт"}
            </h2>
            <p className={`text-sm ${isDarkTheme ? 'text-neutral-400' : 'text-neutral-500'}`}>
              {isLogin
                ? "Оберіть роль та введіть дані"
                : "Заповніть форму для реєстрації"}
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
                    Інвайт-код
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
                    Ім&apos;я
                  </Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="Ваше ім'я"
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
                Email
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
                Пароль
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
                  {isLogin ? "Увійти" : "Зареєструватись"}
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              )}
            </Button>
          </form>

          {/* Toggle */}
          <div className="mt-6 text-center animate-fade-in" style={{ animationDelay: '0.3s' }}>
            {isLogin ? (
              <p className={`text-sm ${isDarkTheme ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Немає акаунту?{" "}
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className={`font-medium hover:underline ${isDarkTheme ? 'text-white' : 'text-black'}`}
                >
                  Зареєструватись
                </button>
              </p>
            ) : (
              <p className={`text-sm ${isDarkTheme ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Вже є акаунт?{" "}
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className={`font-medium hover:underline ${isDarkTheme ? 'text-white' : 'text-black'}`}
                >
                  Увійти
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
