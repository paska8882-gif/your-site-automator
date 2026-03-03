import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

const Index = () => {
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          window.location.href = "https://dragon-white.com";
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative z-10 max-w-lg w-full text-center space-y-8">
        {/* Dragon emoji */}
        <div className="text-7xl mb-2 animate-bounce" style={{ animationDuration: "2s" }}>
          🐉
        </div>

        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
            dragon.white
          </h1>
          <div className="h-px w-16 mx-auto bg-border" />
        </div>

        {/* Message */}
        <div className="space-y-4 px-4">
          <p className="text-lg text-foreground font-medium">
            🚀 Ми переїхали на новий домен!
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Дякуємо, що Ви з нами! Наш сервіс тепер доступний за новою адресою.
            Ми продовжуємо розвиватися для вас 💪
          </p>
        </div>

        {/* New domain link */}
        <a
          href="https://dragon-white.com"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-semibold text-lg hover:opacity-90 transition-opacity"
        >
          dragon-white.com
          <ExternalLink className="h-5 w-5" />
        </a>

        {/* Countdown */}
        <p className="text-sm text-muted-foreground">
          Автоматичне перенаправлення через{" "}
          <span className="font-mono font-bold text-foreground">{countdown}</span>{" "}
          сек...
        </p>
      </div>
    </div>
  );
};

export default Index;
