import { Link, NavLink, useNavigate } from "react-router-dom";
import { Moon, Sun, Search, BookOpen, ShieldCheck, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";

export default function Header({ onSearchClick }) {
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header
      className="sticky top-0 z-40 w-full backdrop-blur-md bg-background/75 border-b border-border"
      data-testid="site-header"
    >
      <div className="max-w-[1400px] mx-auto flex items-center gap-4 h-16 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 group" data-testid="logo-link">
          <span
            className="relative flex items-center justify-center w-9 h-9 rounded-lg"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-mid)))",
              boxShadow: "0 0 24px -4px hsl(var(--primary) / 0.55)",
            }}
          >
            <span className="text-white font-bold text-lg" style={{ fontFamily: "Outfit" }}>S</span>
          </span>
          <div className="hidden sm:flex flex-col leading-tight">
            <span className="font-semibold text-[15px]" style={{ fontFamily: "Outfit" }}>
              Dokümantasyon
            </span>
            <span className="text-[11px] text-muted-foreground tracking-wide uppercase">
              Türkçe rehber
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-6">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `text-sm px-3 py-1.5 rounded-md transition-colors ${
                isActive ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground"
              }`
            }
            data-testid="nav-home"
          >
            Ana Sayfa
          </NavLink>
          <NavLink
            to="/docs"
            className={({ isActive }) =>
              `text-sm px-3 py-1.5 rounded-md transition-colors ${
                isActive ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground"
              }`
            }
            data-testid="nav-docs"
          >
            Dokümanlar
          </NavLink>
        </nav>

        <div className="flex-1" />

        <button
          onClick={onSearchClick}
          className="hidden sm:flex items-center gap-2 px-3 h-9 rounded-md border border-border bg-secondary/40 hover:bg-secondary text-sm text-muted-foreground transition-colors min-w-[220px]"
          data-testid="open-search-btn"
        >
          <Search className="w-4 h-4" />
          <span>Dökümanlarda ara...</span>
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
        ) : (
          <Button
            size="sm"
            onClick={() => navigate("/admin/login")}
            data-testid="login-btn"
            className="hidden sm:inline-flex"
          >
            <BookOpen className="w-4 h-4 mr-1.5" />
            Giriş
          </Button>
        )}
      </div>
    </header>
  );
}
