import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import SearchDialog from "./SearchDialog";

export default function DocsLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { lang } = useLanguage();
  const location = useLocation();
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const close = () => { if (media.matches) setMenuOpen(false); };
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, []);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header onSearchClick={() => setSearchOpen(true)} onMenuClick={() => setMenuOpen(true)} menuOpen={menuOpen} />
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" id="mobile-docs-menu" className="w-[min(88vw,360px)] overflow-y-auto p-4"
          onCloseAutoFocus={(event) => { event.preventDefault(); document.querySelector('[data-testid="open-menu-mobile"]')?.focus(); }}>
          <SheetTitle>{lang === "tr" ? "Dokümantasyon menüsü" : "Documentation menu"}</SheetTitle>
          <SheetDescription className="sr-only">{lang === "tr" ? "Bölüm ve sayfa seçin" : "Choose a section and page"}</SheetDescription>
          <Sidebar mobile onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex-1 w-full px-4 sm:px-6 flex gap-8">
        <Sidebar />
        <main className="flex-1 min-w-0 py-8 lg:py-12 max-w-[860px] mx-auto" data-testid="docs-main">
          <Outlet />
        </main>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
