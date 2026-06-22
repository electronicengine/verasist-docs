import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { FileText, ChevronRight } from "lucide-react";

export default function Sidebar() {
  const [tabs, setTabs] = useState([]);
  const [sections, setSections] = useState([]);
  const [docs, setDocs] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const location = useLocation();
  const { tabSlug: paramTab, docSlug } = useParams();

  const pathParts = location.pathname.split("/").filter(Boolean);
  const tabFromPath = pathParts[0] === "docs" ? pathParts[1] : null;
  const activeTabSlug = paramTab || tabFromPath || tabs[0]?.slug;

  useEffect(() => {
    Promise.all([
      api.get("/tabs"),
      api.get("/sections"),
      api.get("/documents"),
    ])
      .then(([t, s, d]) => {
        setTabs(t.data);
        setSections(s.data);
        setDocs(d.data);
      })
      .catch(() => {});
  }, []);

  const onToggle = (id) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const activeTab = tabs.find((t) => t.slug === activeTabSlug) || tabs[0];
  const tabSections = sections
    .filter((s) => activeTab && s.tab_id === activeTab.id)
    .sort((a, b) => a.order - b.order);

  // Build flat list with depth for each section
  const buildFlat = (sectionDocs) => {
    const byParent = new Map();
    sectionDocs.forEach((d) => {
      const pid = d.parent_id || "ROOT";
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid).push(d);
    });
    byParent.forEach((arr) => arr.sort((a, b) => a.order - b.order));

    // Path of ancestor ids that are open (current doc path)
    const pathIds = new Set();
    const findPath = (slug) => {
      const target = sectionDocs.find((d) => d.slug === slug);
      if (!target) return;
      let cur = target;
      while (cur) {
        pathIds.add(cur.id);
        cur = cur.parent_id ? sectionDocs.find((d) => d.id === cur.parent_id) : null;
      }
    };
    if (docSlug) findPath(docSlug);

    const out = [];
    const walk = (parentId, depth) => {
      const items = byParent.get(parentId) || [];
      items.forEach((d) => {
        const kids = byParent.get(d.id) || [];
        const hasChildren = kids.length > 0;
        const isOpen = expanded.has(d.id) || pathIds.has(d.id);
        out.push({ doc: d, depth, hasChildren, isOpen });
        if (hasChildren && isOpen) walk(d.id, depth + 1);
      });
    };
    walk("ROOT", 0);
    return out;
  };

  return (
    <aside
      className="w-[270px] shrink-0 hidden lg:block sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto py-8 pr-4"
      data-testid="docs-sidebar"
    >
      <nav className="space-y-7">
        {tabSections.map((s) => {
          const sectionDocs = docs.filter(
            (d) => d.section_id === s.id && d.published
          );
          const flat = buildFlat(sectionDocs);
          return (
            <div key={s.id}>
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2 px-2"
                data-testid={`section-title-${s.slug}`}
              >
                {s.title}
              </div>
              <ul className="space-y-0.5">
                {flat.map(({ doc, depth, hasChildren, isOpen }) => {
                  const active = docSlug === doc.slug;
                  return (
                    <li key={doc.id}>
                      <div
                        className="flex items-center group"
                        style={{ paddingLeft: depth * 12 }}
                      >
                        {hasChildren ? (
                          <button
                            onClick={() => onToggle(doc.id)}
                            className="p-1 -ml-1 rounded hover:bg-secondary/60 text-muted-foreground"
                            aria-label={isOpen ? "Daralt" : "Genişlet"}
                            data-testid={`toggle-doc-${doc.slug}`}
                          >
                            <ChevronRight
                              className={`w-3.5 h-3.5 transition-transform ${
                                isOpen ? "rotate-90" : ""
                              }`}
                            />
                          </button>
                        ) : (
                          <span className="w-5" />
                        )}
                        <Link
                          to={`/docs/${activeTab?.slug}/${doc.slug}`}
                          data-testid={`sidebar-doc-${doc.slug}`}
                          className={`flex-1 flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors ${
                            active
                              ? "sidebar-link-active font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                          }`}
                        >
                          {!hasChildren && (
                            <FileText className="w-3.5 h-3.5 opacity-50" />
                          )}
                          <span className="truncate">{doc.title}</span>
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
        {tabSections.length === 0 && (
          <div className="text-sm text-muted-foreground px-2">
            Bu sekmede henüz içerik yok.
          </div>
        )}
      </nav>
    </aside>
  );
}
