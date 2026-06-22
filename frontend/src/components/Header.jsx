import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Moon, Sun, Search, ShieldCheck, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

export default function Header({ onSearchClick }) {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tabs, setTabs] = useState([]);
  const [showLogoFallback, setShowLogoFallback] = useState(false);

  useEffect(() => {
    api.get("/tabs").then(({ data }) => setTabs(data)).catch(() => {});
  }, []);

  const pathParts = location.pathname.split("/").filter(Boolean);
  const activeTab = pathParts[0] === "docs" ? pathParts[1] : null;

  return (
    <header
      className="sticky top-0 z-40 w-full backdrop-blur-md bg-background/75 border-b border-border"
      data-testid="site-header"
    >
      <div className="max-w-[1400px] mx-auto flex items-center gap-3 h-16 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 group shrink-0" data-testid="logo-link">
          <div className="relative flex items-center justify-center w-11 h-11 rounded-xl overflow-hidden border border-border/70 bg-background shadow-sm">
            <img
              src="/logo.png"
              alt="Verasist logo"
              className={`h-8 w-8 object-contain ${showLogoFallback ? "hidden" : "block"}`}
              onError={() => setShowLogoFallback(true)}
            />
            {!showLogoFallback && <span className="sr-only">Verasist</span>}
            {showLogoFallback && (
              <span className="text-sm font-semibold tracking-wide text-foreground">V</span>
            )}
          </div>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="font-semibold text-[15px]" style={{ fontFamily: "Outfit" }}>
              Verasist Dökümantasyon
            </span>
            <span className="text-[11px] text-muted-foreground tracking-wide uppercase">
              Yazılım Rehberi
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-4" data-testid="tabs-nav">
          {tabs.map((t) => {
            const isActive = activeTab === t.slug;
            return (
              <NavLink
                key={t.id}
                to={`/docs/${t.slug}`}
                className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
                data-testid={`tab-${t.slug}`}
              >
                {t.title}
              </NavLink>
            );
          })}
        </nav>

        <div className="flex-1" />

        <button
          onClick={onSearchClick}
          className="hidden sm:flex items-center gap-2 px-3 h-9 rounded-md border border-border bg-secondary/40 hover:bg-secondary text-sm text-muted-foreground transition-colors min-w-[200px]"
          data-testid="open-search-btn"
        >
          <Search className="w-4 h-4" />
          <span>Ara...</span>
          <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-background border border-border">
            Ctrl K
          </kbd>
        </button>

        <Button
          variant="ghost"
          size="icon"
          onClick={onSearchClick}
          className="sm:hidden"
          data-testid="open-search-btn-mobile"
          aria-label="Ara"
        >
          <Search className="w-4 h-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          aria-label="Tema değiştir"
          data-testid="theme-toggle-btn"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {user && user.role === "admin" ? (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/admin")}
              data-testid="admin-panel-btn"
              className="hidden sm:inline-flex"
            >
              <ShieldCheck className="w-4 h-4 mr-1.5" />
              Panel
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                logout();
                navigate("/");
              }}
              aria-label="Çıkış"
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
