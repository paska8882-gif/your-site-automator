import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  FileCode, 
  Layers, 
  Globe, 
  Crown, 
  Users, 
  CheckCircle2, 
  Zap, 
  Image, 
  MessageSquare,
  TrendingDown
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

const tiers = [
  {
    id: "basic",
    icon: FileCode,
    name: "Basic Landing",
    price: "$5",
    accent: "text-blue-500",
    accentBg: "bg-blue-500/10 border-blue-500/20",
    description: "Простий односторінковий сайт — ідеальний для швидкого старту. Автогенерація за лічені хвилини.",
    features: [
      "Односторінковий лендінг",
      "Адаптивний дизайн",
      "Базова SEO-оптимізація",
      "Швидка доставка — до 5 хвилин",
    ],
  },
  {
    id: "html",
    icon: Layers,
    name: "HTML Multi-page",
    price: "$7",
    accent: "text-emerald-500",
    accentBg: "bg-emerald-500/10 border-emerald-500/20",
    description: "Багатосторінковий HTML-сайт з кількома розділами, сторінками та контентом.",
    features: [
      "Кілька сторінок (About, Services, Contact…)",
      "Унікальний контент під тематику",
      "Адаптивна верстка",
      "AI-генеровані тексти та структура",
    ],
  },
  {
    id: "react",
    icon: Zap,
    name: "React / Next.js",
    price: "$9",
    accent: "text-violet-500",
    accentBg: "bg-violet-500/10 border-violet-500/20",
    description: "Сучасний сайт на React — швидший, інтерактивніший та технологічніший.",
    features: [
      "Сучасний фреймворк React / Next.js",
      "Покращена швидкість завантаження",
      "Компонентна архітектура",
      "Розширені анімації та інтерактив",
    ],
  },
  {
    id: "bilingual",
    icon: Globe,
    name: "Bilingual HTML",
    price: "$10",
    accent: "text-amber-500",
    accentBg: "bg-amber-500/10 border-amber-500/20",
    description: "Двомовний HTML-сайт — контент автоматично генерується на двох мовах з перемикачем.",
    features: [
      "Дві мовні версії сайту",
      "Перемикач мов у хедері",
      "Контент перекладений під кожну мову",
      "Коректні мета-теги для кожної мови",
    ],
  },
  {
    id: "manual",
    icon: Crown,
    name: "Manual Premium",
    price: "від $20",
    accent: "text-orange-500",
    accentBg: "bg-orange-500/10 border-orange-500/20",
    description: "Ручна видача з модерацією живої людини. AI-генерація + професійне доведення: точні фото, будь-які вимоги, кастомні промпти.",
    features: [
      "AI-генерація + ручна модерація",
      "Фото що точно відповідають тематиці",
      "Будь-які вимоги клієнта (промпти, структура)",
      "Можливість розмістити фото клієнта",
      "Індивідуальний підхід до кожного сайту",
    ],
  },
];

const Pricing = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { t } = useLanguage();

  useEffect(() => {
    if (!loading && !adminLoading) {
      if (!user || !isAdmin) {
        navigate("/");
      }
    }
  }, [user, loading, isAdmin, adminLoading, navigate]);

  if (loading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">Тарифи та послуги</h1>
          <p className="text-muted-foreground text-sm">
            Огляд доступних типів сайтів та їх вартості
          </p>
        </div>

        {/* Tiers */}
        <div className="space-y-4">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`border rounded-xl p-5 space-y-3 ${tier.accentBg}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-background border`}>
                    <tier.icon className={`h-5 w-5 ${tier.accent}`} />
                  </div>
                  <div>
                    <h2 className="font-semibold text-lg">{tier.name}</h2>
                    <p className="text-muted-foreground text-sm mt-0.5">{tier.description}</p>
                  </div>
                </div>
                <div className={`text-2xl font-bold whitespace-nowrap ${tier.accent}`}>
                  {tier.price}
                </div>
              </div>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className={`h-4 w-4 mt-0.5 shrink-0 ${tier.accent}`} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Volume discounts section */}
        <div className="border rounded-xl p-5 space-y-3 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-background border">
              <TrendingDown className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Знижки при об'ємах</h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                Для команд з регулярним замовленням — спеціальні ціни на ручну видачу
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            <div className="border rounded-lg p-3 bg-background text-center">
              <div className="text-xs text-muted-foreground mb-1">від 10 сайтів/міс</div>
              <div className="text-xl font-bold text-green-500">$18</div>
              <div className="text-xs text-muted-foreground">за ручний сайт</div>
            </div>
            <div className="border rounded-lg p-3 bg-background text-center">
              <div className="text-xs text-muted-foreground mb-1">від 25 сайтів/міс</div>
              <div className="text-xl font-bold text-green-500">$16</div>
              <div className="text-xs text-muted-foreground">за ручний сайт</div>
            </div>
            <div className="border rounded-lg p-3 bg-background text-center">
              <div className="text-xs text-muted-foreground mb-1">від 50 сайтів/міс</div>
              <div className="text-xl font-bold text-green-500">$14</div>
              <div className="text-xs text-muted-foreground">за ручний сайт</div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            * Ціна на ручну видачу також може змінюватись залежно від складності ТЗ. Обговорюється індивідуально.
          </p>
        </div>

        {/* Additional info */}
        <div className="border rounded-xl p-5 space-y-3 bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-background border">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Залишились питання?</h2>
              <p className="text-muted-foreground text-sm mt-0.5">
                Зверніться до підтримки через чат у бічній панелі або напишіть вашому менеджеру.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Pricing;
