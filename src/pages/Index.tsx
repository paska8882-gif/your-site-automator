import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { WebsiteGenerator } from "@/components/WebsiteGenerator";
import { BlockedUserOverlay } from "@/components/BlockedUserOverlay";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const Index = () => {
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

  if (isBlocked) {
    return <BlockedUserOverlay />;
  }

  return <WebsiteGenerator />;
};

export default Index;
