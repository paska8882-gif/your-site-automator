import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { uk } from "@/locales/uk";
import { ru } from "@/locales/ru";

type Language = "uk" | "ru";

type TranslationValue = string | { [key: string]: TranslationValue };

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const translations: Record<Language, any> = {
  uk,
  ru,
};

function getNestedValue(obj: TranslationValue, path: string): string {
  const keys = path.split(".");
  let current: TranslationValue = obj;

  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = current[key];
    } else {
      return path; // Return the key itself if not found
    }
  }

  return typeof current === "string" ? current : path;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("app-language");
    return (saved as Language) || "uk";
  });

  useEffect(() => {
    localStorage.setItem("app-language", language);
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return getNestedValue(translations[language], key);
    },
    [language]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

// Default fallback for when context is not available
const defaultContextValue: LanguageContextType = {
  language: "uk",
  setLanguage: () => {},
  t: (key: string) => key,
};

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    // Return fallback instead of throwing - handles edge cases during hydration
    console.warn("useLanguage used outside LanguageProvider, using fallback");
    return defaultContextValue;
  }
  return context;
}
