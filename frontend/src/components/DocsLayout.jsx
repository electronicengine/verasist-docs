import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import SearchDialog from "./SearchDialog";

export default function DocsLayout() {
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
      <Header onSearchClick={() => setSearchOpen(true)} />
      <div className="flex-1 max-w-[1400px] mx-auto w-full px-4 sm:px-6 flex gap-8">
        <Sidebar />
        <main className="flex-1 min-w-0 py-8 lg:py-12" data-testid="docs-main">
          <Outlet />
        </main>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
