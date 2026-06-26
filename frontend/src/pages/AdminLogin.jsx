import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";


export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showLogoFallback, setShowLogoFallback] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) navigate("/admin");
    else setErr(res.error || "Giriş başarısız");
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-tint/20 to-primary/10" />
      <div className="relative w-full max-w-md">
        <Link
          to="/"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-4"
          data-testid="back-home-link"
        >
          ← Ana sayfaya dön
        </Link>
        <div
          className="rounded-2xl border border-border bg-card p-8 brand-glow"
          data-testid="login-card"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl border border-border/70 bg-background shadow-sm overflow-hidden flex items-center justify-center">
              <img
                src="/logo.png"
                alt="Verasist logo"
                className={`h-8 w-8 object-contain ${showLogoFallback ? "hidden" : "block"}`}
                onError={() => setShowLogoFallback(true)}
              />
              {showLogoFallback && <span className="text-sm font-semibold tracking-wide text-foreground">V</span>}
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                Yönetici Paneli
              </div>
              <h1 className="text-2xl font-semibold">Giriş yap</h1>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4" data-testid="login-form">
            <div>
              <Label htmlFor="email">E-posta</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@dokuman.com"
                className="mt-1.5"
                data-testid="login-email-input"
              />
            </div>
            <div>
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5"
                data-testid="login-password-input"
              />
            </div>

            {err && (
              <div
                className="text-sm rounded-md px-3 py-2 border border-destructive/40 bg-destructive/10 text-destructive"
                data-testid="login-error"
              >
                {err}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit-btn">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Giriş yap
            </Button>
          </form>

          <p className="mt-6 text-xs text-muted-foreground text-center">
            Yalnızca yetkili yöneticiler giriş yapabilir.
          </p>
        </div>
      </div>
    </div>
  );
}
