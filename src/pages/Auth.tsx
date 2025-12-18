import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, ArrowRight } from "lucide-react";

const authSchema = z.object({
  email: z.string().trim().email({ message: "Невірний формат email" }),
  password: z.string().min(6, { message: "Пароль має бути мінімум 6 символів" }),
  displayName: z.string().trim().optional(),
  inviteCode: z.string().trim().optional(),
});

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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex relative">
      {/* Center transition effect */}
      <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 -translate-x-1/2 z-20 w-32 pointer-events-none">
        {/* Gradient blur transition */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent blur-xl" />
        {/* Center glow line */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-cyan-400/50 to-transparent" />
        {/* Accent dots */}
        <div className="absolute left-1/2 -translate-x-1/2 top-1/4 w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50" />
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 w-2 h-2 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50" />
        <div className="absolute left-1/2 -translate-x-1/2 top-3/4 w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50" />
      </div>

      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 via-black to-neutral-950" />
        
        {/* Animated particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white/20"
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
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/[0.03] rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/[0.03] rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        {/* Content */}
        <div className="relative z-10 animate-fade-in" style={{ animationDelay: '0.1s', animationFillMode: 'backwards' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <span className="text-black font-bold text-lg">D</span>
            </div>
            <span className="text-white font-semibold text-xl tracking-tight">
              DRAGON<span className="text-neutral-500">WHITE</span>
            </span>
          </div>
        </div>

        <div className="relative z-10 max-w-md animate-fade-in" style={{ animationDelay: '0.3s', animationFillMode: 'backwards' }}>
          <h1 className="text-5xl xl:text-6xl font-bold leading-tight mb-6">
            <span className="text-white">Створюй сайти</span>
            <br />
            <span className="bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 bg-clip-text text-transparent">
              за допомогою AI
            </span>
          </h1>
          <p className="text-neutral-400 text-lg leading-relaxed">
            Професійний генератор вебсайтів на базі штучного інтелекту. 
            Опиши свою ідею — отримай готовий сайт за лічені хвилини.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-8 text-neutral-500 text-sm animate-fade-in" style={{ animationDelay: '0.5s', animationFillMode: 'backwards' }}>
          <div>
            <span className="text-white font-semibold text-2xl">24</span>
            <span className="ml-1">мови</span>
          </div>
          <div className="w-px h-8 bg-neutral-800" />
          <div>
            <span className="text-white font-semibold text-2xl">2</span>
            <span className="ml-1">AI моделі</span>
          </div>
          <div className="w-px h-8 bg-neutral-800" />
          <div>
            <span className="text-white font-semibold text-2xl">10+</span>
            <span className="ml-1">стилів</span>
          </div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative overflow-hidden">
        {/* Gradient background - darker left, lighter right */}
        <div className="absolute inset-0 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-700" />
        <div className="w-full max-w-sm relative z-10">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10 animate-fade-in">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
              <span className="text-black font-bold text-lg">D</span>
            </div>
            <span className="text-white font-semibold text-xl tracking-tight">
              DRAGON<span className="text-neutral-500">WHITE</span>
            </span>
          </div>

          <div className="mb-8 animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'backwards' }}>
            <h2 className="text-2xl font-bold text-white mb-2">
              {isLogin ? "Вхід в акаунт" : "Створити акаунт"}
            </h2>
            <p className="text-neutral-500">
              {isLogin
                ? "Введіть свої дані для входу"
                : "Заповніть форму для реєстрації"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in" style={{ animationDelay: '0.4s', animationFillMode: 'backwards' }}>
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="inviteCode" className="text-neutral-300 text-sm">
                    Інвайт-код
                  </Label>
                  <Input
                    id="inviteCode"
                    type="text"
                    placeholder="XXXXXXXX"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    disabled={isSubmitting}
                    className={`h-12 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-white focus:ring-0 ${errors.inviteCode ? "border-red-500" : ""}`}
                    maxLength={8}
                  />
                  {errors.inviteCode && (
                    <p className="text-xs text-red-400">{errors.inviteCode}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName" className="text-neutral-300 text-sm">
                    Ім&apos;я <span className="text-neutral-600">(опціонально)</span>
                  </Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="Ваше ім'я"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={isSubmitting}
                    className="h-12 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-white focus:ring-0"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-neutral-300 text-sm">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                className={`h-12 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-white focus:ring-0 ${errors.email ? "border-red-500" : ""}`}
              />
              {errors.email && (
                <p className="text-xs text-red-400">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-neutral-300 text-sm">
                Пароль
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                className={`h-12 bg-neutral-900 border-neutral-800 text-white placeholder:text-neutral-600 focus:border-white focus:ring-0 ${errors.password ? "border-red-500" : ""}`}
              />
              {errors.password && (
                <p className="text-xs text-red-400">{errors.password}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-white hover:bg-gradient-to-r hover:from-cyan-400 hover:via-blue-500 hover:to-violet-500 text-black hover:text-white font-medium text-base transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-500/25" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {isLogin ? "Увійти" : "Зареєструватись"}
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 text-center">
            {isLogin ? (
              <p className="text-neutral-500 text-sm">
                Немає акаунту?{" "}
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className="text-white hover:underline font-medium"
                >
                  Зареєструватись
                </button>
              </p>
            ) : (
              <p className="text-neutral-500 text-sm">
                Вже є акаунт?{" "}
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className="text-white hover:underline font-medium"
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
