import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useAdmin } from "@/hooks/useAdmin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  FileCode, Layers, Globe, Crown, Zap, 
  CheckCircle2, TrendingDown, MessageSquare,
  Pencil, Save, X, Plus, Trash2, Download, Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface Tier {
  id: string;
  name: string;
  price: string;
  description: string;
  features: string[];
}

interface VolumeDiscount {
  min_sites: number;
  price: string;
}

const iconMap: Record<string, any> = {
  basic: FileCode,
  html: Layers,
  react: Zap,
  bilingual: Globe,
  manual: Crown,
};

const accentMap: Record<string, { text: string; bg: string }> = {
  basic: { text: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20" },
  html: { text: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20" },
  react: { text: "text-violet-500", bg: "bg-violet-500/10 border-violet-500/20" },
  bilingual: { text: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20" },
  manual: { text: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/20" },
};

const defaultAccent = { text: "text-primary", bg: "bg-primary/10 border-primary/20" };

const Pricing = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading } = useAdmin();

  const [tiers, setTiers] = useState<Tier[]>([]);
  const [discounts, setDiscounts] = useState<VolumeDiscount[]>([]);
  const [footerNote, setFooterNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Draft state for editing
  const [draftTiers, setDraftTiers] = useState<Tier[]>([]);
  const [draftDiscounts, setDraftDiscounts] = useState<VolumeDiscount[]>([]);
  const [draftFooterNote, setDraftFooterNote] = useState("");

  const fetchConfig = useCallback(async () => {
    const { data, error } = await supabase
      .from("pricing_config")
      .select("*")
      .eq("id", "global")
      .single();

    if (error) {
      console.error("Failed to fetch pricing config:", error);
      setFetching(false);
      return;
    }

    const t = (data.tiers as unknown as Tier[]) || [];
    const d = (data.volume_discounts as unknown as VolumeDiscount[]) || [];
    setTiers(t);
    setDiscounts(d);
    setFooterNote(data.footer_note || "");
    setFetching(false);
  }, []);

  useEffect(() => {
    if (!loading && !adminLoading) {
      if (!user || !isAdmin) {
        navigate("/");
        return;
      }
      fetchConfig();
    }
  }, [user, loading, isAdmin, adminLoading, navigate, fetchConfig]);

  const startEditing = () => {
    setDraftTiers(JSON.parse(JSON.stringify(tiers)));
    setDraftDiscounts(JSON.parse(JSON.stringify(discounts)));
    setDraftFooterNote(footerNote);
    setEditing(true);
  };

  const cancelEditing = () => setEditing(false);

  const saveChanges = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("pricing_config")
      .update({
        tiers: draftTiers as any,
        volume_discounts: draftDiscounts as any,
        footer_note: draftFooterNote,
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      })
      .eq("id", "global");

    if (error) {
      toast.error("Помилка збереження");
      console.error(error);
    } else {
      setTiers(draftTiers);
      setDiscounts(draftDiscounts);
      setFooterNote(draftFooterNote);
      setEditing(false);
      toast.success("Тарифи збережено");
    }
    setSaving(false);
  };

  const updateTierField = (idx: number, field: keyof Tier, value: string) => {
    setDraftTiers(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t));
  };

  const updateTierFeature = (tierIdx: number, featIdx: number, value: string) => {
    setDraftTiers(prev => prev.map((t, i) => {
      if (i !== tierIdx) return t;
      const features = [...t.features];
      features[featIdx] = value;
      return { ...t, features };
    }));
  };

  const addFeature = (tierIdx: number) => {
    setDraftTiers(prev => prev.map((t, i) =>
      i === tierIdx ? { ...t, features: [...t.features, ""] } : t
    ));
  };

  const removeFeature = (tierIdx: number, featIdx: number) => {
    setDraftTiers(prev => prev.map((t, i) => {
      if (i !== tierIdx) return t;
      return { ...t, features: t.features.filter((_, fi) => fi !== featIdx) };
    }));
  };

  const addTier = () => {
    setDraftTiers(prev => [...prev, {
      id: `tier_${Date.now()}`,
      name: "Новий тариф",
      price: "$0",
      description: "Опис тарифу",
      features: ["Функція 1"],
    }]);
  };

  const removeTier = (idx: number) => {
    setDraftTiers(prev => prev.filter((_, i) => i !== idx));
  };

  const updateDiscount = (idx: number, field: keyof VolumeDiscount, value: string) => {
    setDraftDiscounts(prev => prev.map((d, i) =>
      i === idx ? { ...d, [field]: field === "min_sites" ? parseInt(value) || 0 : value } : d
    ));
  };

  const addDiscount = () => {
    setDraftDiscounts(prev => [...prev, { min_sites: 0, price: "$0" }]);
  };

  const removeDiscount = (idx: number) => {
    setDraftDiscounts(prev => prev.filter((_, i) => i !== idx));
  };

  const exportPricing = () => {
    let text = "📋 ТАРИФИ ТА ПОСЛУГИ\n\n";
    
    tiers.forEach(tier => {
      text += `━━━ ${tier.name} — ${tier.price} ━━━\n`;
      text += `${tier.description}\n`;
      tier.features.forEach(f => {
        text += `  ✅ ${f}\n`;
      });
      text += "\n";
    });

    if (discounts.length > 0) {
      text += "━━━ Знижки при об'ємах ━━━\n";
      discounts.forEach(d => {
        text += `  📦 від ${d.min_sites} сайтів/міс — ${d.price} за ручний сайт\n`;
      });
      text += "\n";
    }

    if (footerNote) {
      text += footerNote + "\n";
    }

    navigator.clipboard.writeText(text).then(() => {
      toast.success("Тарифи скопійовано в буфер обміну");
    }).catch(() => {
      // Fallback: download as file
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pricing.txt";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Файл завантажено");
    });
  };

  if (loading || adminLoading || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  const displayTiers = editing ? draftTiers : tiers;
  const displayDiscounts = editing ? draftDiscounts : discounts;
  const displayFooterNote = editing ? draftFooterNote : footerNote;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Тарифи та послуги</h1>
            <p className="text-muted-foreground text-sm">
              Огляд доступних типів сайтів та їх вартості
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportPricing} disabled={editing}>
              <Copy className="h-4 w-4 mr-1" />
              Експорт
            </Button>
            {editing ? (
              <>
                <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={saving}>
                  <X className="h-4 w-4 mr-1" />
                  Скасувати
                </Button>
                <Button size="sm" onClick={saveChanges} disabled={saving}>
                  <Save className="h-4 w-4 mr-1" />
                  {saving ? "Зберігаю..." : "Зберегти"}
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={startEditing}>
                <Pencil className="h-4 w-4 mr-1" />
                Редагувати
              </Button>
            )}
          </div>
        </div>

        {/* Tiers */}
        <div className="space-y-4">
          {displayTiers.map((tier, tierIdx) => {
            const accent = accentMap[tier.id] || defaultAccent;
            const Icon = iconMap[tier.id] || FileCode;

            return (
              <div key={tier.id} className={`border rounded-xl p-5 space-y-3 ${accent.bg}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-2 rounded-lg bg-background border shrink-0">
                      <Icon className={`h-5 w-5 ${accent.text}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {editing ? (
                        <div className="space-y-2">
                          <Input
                            value={tier.name}
                            onChange={e => updateTierField(tierIdx, "name", e.target.value)}
                            className="font-semibold text-lg h-8"
                            placeholder="Назва тарифу"
                          />
                          <Input
                            value={tier.description}
                            onChange={e => updateTierField(tierIdx, "description", e.target.value)}
                            className="text-sm h-8"
                            placeholder="Опис"
                          />
                        </div>
                      ) : (
                        <>
                          <h2 className="font-semibold text-lg">{tier.name}</h2>
                          <p className="text-muted-foreground text-sm mt-0.5">{tier.description}</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {editing ? (
                      <>
                        <Input
                          value={tier.price}
                          onChange={e => updateTierField(tierIdx, "price", e.target.value)}
                          className={`text-xl font-bold w-24 text-right h-8 ${accent.text}`}
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeTier(tierIdx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <div className={`text-2xl font-bold whitespace-nowrap ${accent.text}`}>
                        {tier.price}
                      </div>
                    )}
                  </div>
                </div>

                <ul className={editing ? "space-y-1.5" : "grid grid-cols-1 sm:grid-cols-2 gap-1.5"}>
                  {tier.features.map((feature, featIdx) => (
                    <li key={featIdx} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className={`h-4 w-4 shrink-0 ${accent.text}`} />
                      {editing ? (
                        <div className="flex gap-1 flex-1">
                          <Input
                            value={feature}
                            onChange={e => updateTierFeature(tierIdx, featIdx, e.target.value)}
                            className="h-7 text-sm flex-1"
                          />
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => removeFeature(tierIdx, featIdx)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span>{feature}</span>
                      )}
                    </li>
                  ))}
                  {editing && (
                    <li>
                      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => addFeature(tierIdx)}>
                        <Plus className="h-3 w-3 mr-1" />
                        Додати функцію
                      </Button>
                    </li>
                  )}
                </ul>
              </div>
            );
          })}

          {editing && (
            <Button variant="outline" className="w-full" onClick={addTier}>
              <Plus className="h-4 w-4 mr-2" />
              Додати тариф
            </Button>
          )}
        </div>

        {/* Volume discounts */}
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
            {displayDiscounts.map((d, idx) => (
              <div key={idx} className="border rounded-lg p-3 bg-background text-center relative">
                {editing && (
                  <Button
                    variant="ghost" size="icon"
                    className="absolute top-1 right-1 h-6 w-6 text-destructive"
                    onClick={() => removeDiscount(idx)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
                {editing ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 justify-center">
                      <span className="text-xs text-muted-foreground">від</span>
                      <Input
                        type="number"
                        value={d.min_sites}
                        onChange={e => updateDiscount(idx, "min_sites", e.target.value)}
                        className="h-6 w-16 text-xs text-center"
                      />
                      <span className="text-xs text-muted-foreground">сайтів/міс</span>
                    </div>
                    <Input
                      value={d.price}
                      onChange={e => updateDiscount(idx, "price", e.target.value)}
                      className="h-8 text-xl font-bold text-green-500 text-center"
                    />
                    <div className="text-xs text-muted-foreground">за ручний сайт</div>
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground mb-1">від {d.min_sites} сайтів/міс</div>
                    <div className="text-xl font-bold text-green-500">{d.price}</div>
                    <div className="text-xs text-muted-foreground">за ручний сайт</div>
                  </>
                )}
              </div>
            ))}
          </div>

          {editing && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={addDiscount}>
              <Plus className="h-3 w-3 mr-1" />
              Додати знижку
            </Button>
          )}

          {editing ? (
            <Input
              value={displayFooterNote}
              onChange={e => setDraftFooterNote(e.target.value)}
              className="text-xs h-7"
              placeholder="Примітка"
            />
          ) : (
            <p className="text-xs text-muted-foreground">{displayFooterNote}</p>
          )}
        </div>

        {/* Questions section */}
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
