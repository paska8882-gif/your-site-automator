import { useEffect, useState } from "react";
import dragonLogo from "@/assets/dragon-logo.png";

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
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, hsl(0 0% 2%) 0%, hsl(0 0% 8%) 25%, hsl(0 0% 12%) 50%, hsl(0 0% 8%) 75%, hsl(0 0% 2%) 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ maxWidth: "28rem", width: "100%", textAlign: "center" }}>
        {/* Dragon emoji */}
        <div style={{ fontSize: "5rem", marginBottom: "1.5rem" }}>🐉</div>

        {/* Title */}
        <h1
          style={{
            fontSize: "2.25rem",
            fontWeight: 700,
            color: "#e2e8f0",
            letterSpacing: "-0.025em",
            marginBottom: "0.5rem",
          }}
        >
          dragon.white
        </h1>

        <div
          style={{
            height: "1px",
            width: "4rem",
            margin: "1rem auto",
            background: "hsl(220 40% 30%)",
          }}
        />

        {/* Message */}
        <p
          style={{
            fontSize: "1.25rem",
            color: "#e2e8f0",
            fontWeight: 500,
            marginBottom: "1rem",
          }}
        >
          🚀 Ми переїхали на новий домен!
        </p>

        <p
          style={{
            color: "hsl(220 30% 60%)",
            lineHeight: 1.7,
            marginBottom: "2rem",
          }}
        >
          Дякуємо, що Ви з нами! Наш сервіс тепер доступний за новою адресою.
          Ми продовжуємо розвиватися для вас 💪
        </p>

        {/* Link button */}
        <a
          href="https://dragon-white.com"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1.5rem",
            borderRadius: "0.5rem",
            background: "hsl(0 0% 95%)",
            color: "#111",
            fontWeight: 600,
            fontSize: "1.125rem",
            textDecoration: "none",
            transition: "opacity 0.2s",
          }}
        >
          dragon-white.com ↗
        </a>

        {/* Countdown */}
        <p
          style={{
            marginTop: "1.5rem",
            fontSize: "0.875rem",
            color: "hsl(220 30% 60%)",
          }}
        >
          Автоматичне перенаправлення через{" "}
          <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#e2e8f0" }}>
            {countdown}
          </span>{" "}
          сек...
        </p>
      </div>
    </div>
  );
};

export default Index;
