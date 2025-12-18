import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Zap, Shield, Globe, Layers } from "lucide-react";

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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const features = [
    { icon: Zap, title: "Швидка генерація", desc: "AI створює сайти за хвилини" },
    { icon: Globe, title: "24 мови", desc: "Європейські мови" },
    { icon: Layers, title: "HTML та React", desc: "Два формати" },
    { icon: Shield, title: "Команди", desc: "Управління балансом" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - DRAGON (Dark) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, #000000 0%, #0a0a0a 25%, #111111 50%, #0a0a0a 75%, #000000 100%)'
      }}>
        {/* Subtle gradient overlays */}
        <div className="absolute inset-0 opacity-30" style={{
          background: 'radial-gradient(ellipse at 30% 20%, rgba(30, 30, 30, 0.8) 0%, transparent 50%)'
        }} />
        <div className="absolute inset-0 opacity-20" style={{
          background: 'radial-gradient(ellipse at 70% 80%, rgba(40, 40, 40, 0.6) 0%, transparent 50%)'
        }} />

        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center items-center w-full px-12 text-white">
          {/* Main Title */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-4 mb-6">
              <span className="text-5xl">🐉</span>
            </div>
            <h1 className="text-6xl xl:text-7xl font-black tracking-tight mb-4">
              DRAGON
            </h1>
            <p className="text-white/50 text-lg tracking-[0.3em] uppercase">
              AI Website Generator
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10"
              >
                <feature.icon className="w-4 h-4 text-white/70" />
                <div>
                  <h3 className="font-medium text-xs text-white/90">{feature.title}</h3>
                  <p className="text-white/40 text-[10px]">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="flex gap-8 mt-10 pt-8 border-t border-white/10">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">10+</div>
              <div className="text-white/40 text-xs">Стилів</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">2</div>
              <div className="text-white/40 text-xs">AI моделі</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">∞</div>
              <div className="text-white/40 text-xs">Сайтів</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - WHITE (Light) */}
      <div className="w-full lg:w-1/2 flex flex-col bg-white">
        {/* WHITE Title Header */}
        <div className="hidden lg:flex items-center justify-center py-6 border-b border-gray-100">
          <h2 className="text-4xl xl:text-5xl font-black tracking-tight text-black">
            WHITE
          </h2>
        </div>

        {/* Auth Form */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
              <span className="text-3xl">🐉</span>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-black">DRAGON</span>
                <span className="text-2xl font-black text-gray-400">WHITE</span>
              </div>
            </div>

            <Card className="border border-gray-200 shadow-sm bg-white">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold text-black">
                  {isLogin ? "Вхід" : "Реєстрація"}
                </CardTitle>
                <CardDescription className="text-gray-500">
                  {isLogin
                    ? "Введіть дані для входу в систему"
                    : "Заповніть форму для створення акаунту"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="inviteCode" className="text-sm font-medium text-black">
                          Інвайт-код <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="inviteCode"
                          type="text"
                          placeholder="XXXXXXXX"
                          value={inviteCode}
                          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                          disabled={isSubmitting}
                          className={`h-11 bg-gray-50 border-gray-200 text-black placeholder:text-gray-400 ${errors.inviteCode ? "border-red-500" : ""}`}
                          maxLength={8}
                        />
                        {errors.inviteCode && (
                          <p className="text-xs text-red-500">{errors.inviteCode}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="displayName" className="text-sm font-medium text-black">
                          Ім&apos;я <span className="text-gray-400 text-xs">(необов&apos;язково)</span>
                        </Label>
                        <Input
                          id="displayName"
                          type="text"
                          placeholder="Ваше ім'я"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          disabled={isSubmitting}
                          className="h-11 bg-gray-50 border-gray-200 text-black placeholder:text-gray-400"
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-black">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isSubmitting}
                      className={`h-11 bg-gray-50 border-gray-200 text-black placeholder:text-gray-400 ${errors.email ? "border-red-500" : ""}`}
                    />
                    {errors.email && (
                      <p className="text-xs text-red-500">{errors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-black">Пароль</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isSubmitting}
                      className={`h-11 bg-gray-50 border-gray-200 text-black placeholder:text-gray-400 ${errors.password ? "border-red-500" : ""}`}
                    />
                    {errors.password && (
                      <p className="text-xs text-red-500">{errors.password}</p>
                    )}
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-11 font-medium text-base bg-black hover:bg-gray-800 text-white" 
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {isLogin ? "Вхід..." : "Реєстрація..."}
                      </>
                    ) : (
                      <>{isLogin ? "Увійти" : "Зареєструватись"}</>
                    )}
                  </Button>
                </form>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-400">або</span>
                  </div>
                </div>

                <div className="text-center text-sm">
                  {isLogin ? (
                    <p className="text-gray-500">
                      Немає акаунту?{" "}
                      <button
                        type="button"
                        onClick={() => setIsLogin(false)}
                        className="text-black font-medium hover:underline"
                      >
                        Зареєструватись
                      </button>
                    </p>
                  ) : (
                    <p className="text-gray-500">
                      Вже маєте акаунт?{" "}
                      <button
                        type="button"
                        onClick={() => setIsLogin(true)}
                        className="text-black font-medium hover:underline"
                      >
                        Увійти
                      </button>
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <p className="text-center text-xs text-gray-400 mt-6">
              Продовжуючи, ви погоджуєтесь з умовами використання
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
