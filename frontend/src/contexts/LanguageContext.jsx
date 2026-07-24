import { createContext, useContext, useCallback, useEffect, useState } from "react";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem("dokuman_lang") || "tr";
    } catch {
      return "tr";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("dokuman_lang", lang);
    } catch {}
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((newLang) => {
    setLangState(newLang);
  }, []);

  const toggleLang = useCallback(() => {
    const next = lang === "tr" ? "en" : "tr";
    localStorage.setItem("dokuman_lang", next);
    window.location.reload();
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
