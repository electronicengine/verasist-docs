import { getPreferredLanguage } from "../lib/browserLanguage";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
} from "react";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getPreferredLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((newLang) => {
    if (newLang !== "tr" && newLang !== "en") return;
    try {
      localStorage.setItem("dokuman_lang", newLang);
    } catch {}
    setLangState(newLang);
  }, []);

  const toggleLang = useCallback(() => {
    const next = lang === "tr" ? "en" : "tr";
    try {
      localStorage.setItem("dokuman_lang", next);
      window.location.reload();
    } catch {
      setLangState(next);
    }
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
