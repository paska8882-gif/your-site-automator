import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { N8nGenerationPanel } from "@/components/N8nGenerationPanel";
import { BlockedUserOverlay } from "@/components/BlockedUserOverlay";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const N8nGenerator = () => {
  const { user, loading, isBlocked } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      <div className="container mx-auto py-6 px-4 max-w-5xl">
        <N8nGenerationPanel />
      </div>
      {isBlocked && <BlockedUserOverlay />}
    </AppLayout>
  );
};

export default N8nGenerator;
