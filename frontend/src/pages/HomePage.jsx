import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Search, Zap, Shield, Code2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function HomePage() {
  const [sections, setSections] = useState([]);
  const [docs, setDocs] = useState([]);

  useEffect(() => {
    Promise.all([api.get("/sections"), api.get("/documents")])
      .then(([s, d]) => {
        setSections(s.data);
        setDocs(d.data);
      })
      .catch(() => {});
  }, []);

  const features = [
    { icon: Zap, title: "2 dakikada kurulum", desc: "Docker ile sıfırdan çalışan sesli bota dakikalar içinde ulaşın." },
    { icon: Shield, title: "Tam kontrol", desc: "Açık kaynak. Kendi sunucunuzda barındırın, kodu özelleştirin." },
    { icon: Code2, title: "Geliştirici dostu", desc: "REST API, webhook'lar ve modüler eklenti sistemi." },
  ];

  return (
    <div className="-mt-8 lg:-mt-12">
      {/* Hero */}
      <section className="relative overflow-hidden grain rounded-3xl border border-border bg-card px-6 sm:px-12 py-16 sm:py-24 mt-8">
        <div
          className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full opacity-50 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.35), transparent 70%)" }}
        />
        <div
          className="absolute -bottom-40 -left-20 w-[420px] h-[420px] rounded-full opacity-40 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, hsl(var(--brand-mid) / 0.3), transparent 70%)" }}
        />
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs border border-border bg-secondary/60 text-muted-foreground mb-6">
            <Sparkles className="w-3 h-3" />
            <span>Türkçe geliştirici dokümantasyonu</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.05] tracking-tight">
            Sesli yapay zekâ ajanları için{" "}
            <span style={{ color: "hsl(var(--primary))" }}>açık kaynak</span> rehber.
          </h1>
          <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Kurulumdan dağıtıma kadar tüm adımları içeren, takım üyelerinin ortak hafızası
            haline gelen Türkçe dokümantasyon platformu.
          </p>
          <div className="mt-8 flex flex-wrap gap-3" data-testid="hero-cta">
            <Button asChild size="lg" data-testid="hero-start-btn">
              <Link to="/docs/giris">
                Hızlı başlangıç
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" data-testid="hero-browse-btn">
              <Link to="/docs">
                <BookOpen className="mr-2 w-4 h-4" />
                Tüm dokümanlar
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mt-16 grid sm:grid-cols-3 gap-4">
        {features.map((f) => (
          <div
            key={f.title}
            className="p-6 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors"
            data-testid={`feature-${f.title}`}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
              style={{
                background: "hsl(var(--tint))",
                color: "hsl(var(--primary))",
              }}
            >
              <f.icon className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold mb-1">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Sections grid */}
      <section className="mt-20">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold">Dokümantasyon bölümleri</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Konuya göre düzenlenmiş kapsamlı rehberler
            </p>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {sections.map((s) => {
            const items = docs.filter((d) => d.section_id === s.id && d.published);
            return (
              <div
                key={s.id}
                className="p-6 rounded-xl border border-border bg-card hover:border-primary/40 transition-all"
                data-testid={`home-section-${s.slug}`}
              >
                <h3 className="text-lg font-semibold mb-3">{s.title}</h3>
                <ul className="space-y-1.5">
                  {items.slice(0, 5).map((d) => (
                    <li key={d.id}>
                      <Link
                        to={`/docs/${d.slug}`}
                        className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
                        data-testid={`home-doc-${d.slug}`}
                      >
                        <ArrowRight className="w-3 h-3 opacity-50" />
                        {d.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
