import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { BookOpen, ArrowRight } from "lucide-react";

export default function DocsIndexPage() {
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

  return (
    <div data-testid="docs-index">
      <div className="flex items-center gap-3 mb-2">
        <BookOpen className="w-5 h-5 text-primary" />
        <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-semibold">
          Dokümantasyon
        </span>
      </div>
      <h1 className="text-4xl font-bold mb-3">Tüm dokümanlar</h1>
      <p className="text-muted-foreground mb-12 max-w-2xl">
        Konularına göre düzenlenmiş, sürekli güncellenen Türkçe rehberler.
      </p>

      <div className="space-y-10">
        {sections.map((s) => {
          const items = docs.filter((d) => d.section_id === s.id && d.published);
          if (items.length === 0) return null;
          return (
            <section key={s.id} data-testid={`docs-section-${s.slug}`}>
              <h2 className="text-xl font-semibold mb-4 pb-2 border-b border-border">{s.title}</h2>
              <div className="grid md:grid-cols-2 gap-3">
                {items
                  .sort((a, b) => a.order - b.order)
                  .map((d) => (
                    <Link
                      key={d.id}
                      to={`/docs/${d.slug}`}
                      className="group p-4 rounded-lg border border-border hover:border-primary/50 hover:bg-secondary/40 transition-all"
                      data-testid={`docs-index-link-${d.slug}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium group-hover:text-primary transition-colors">
                            {d.title}
                          </div>
                          {d.excerpt && (
                            <div className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {d.excerpt}
                            </div>
                          )}
                        </div>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary mt-1 shrink-0" />
                      </div>
                    </Link>
                  ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
