import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { ManualOrderForm } from "@/components/ManualOrderForm";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

const ManualOrder = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{t("manualOrder.title")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("manualOrder.subtitle")}
          </p>
        </div>
        <ManualOrderForm />
      </div>
    </AppLayout>
  );
};

export default ManualOrder;
