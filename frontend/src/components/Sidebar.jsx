import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "@/lib/api";
import { FileText } from "lucide-react";

export default function Sidebar() {
  const [sections, setSections] = useState([]);
  const [docs, setDocs] = useState([]);
  const location = useLocation();
  const currentSlug = location.pathname.startsWith("/docs/")
    ? location.pathname.split("/docs/")[1]
    : null;

  useEffect(() => {
    Promise.all([api.get("/sections"), api.get("/documents")])
      .then(([s, d]) => {
        setSections(s.data);
        setDocs(d.data);
      })
      .catch(() => {});
  }, []);

  return (
    <aside
      className="w-[260px] shrink-0 hidden lg:block sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto py-8 pr-4"
      data-testid="docs-sidebar"
    >
      <nav className="space-y-7">
        {sections.map((s) => (
          <div key={s.id}>
            <div
              className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2 px-2"
              data-testid={`section-title-${s.slug}`}
            >
              {s.title}
            </div>
            <ul className="space-y-0.5">
              {docs
                .filter((d) => d.section_id === s.id && d.published)
                .sort((a, b) => a.order - b.order)
                .map((d) => {
                  const active = currentSlug === d.slug;
                  return (
                    <li key={d.id}>
                      <Link
                        to={`/docs/${d.slug}`}
                        data-testid={`sidebar-doc-${d.slug}`}
                        className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors ${
                          active
                            ? "sidebar-link-active font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5 opacity-60" />
                        <span className="truncate">{d.title}</span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
        {sections.length === 0 && (
          <div className="text-sm text-muted-foreground px-2">Henüz bölüm yok.</div>
        )}
      </nav>
    </aside>
  );
}
