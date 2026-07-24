import { useEffect, useState, useMemo } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { translateSection } from "@/lib/translations";
import { FileText, ChevronRight } from "lucide-react";

/**
 * Flatten all docs across tabs and sections into a single lookup.
 * Returns a Map of path (without leading /) → { tabSlug, doc }.
 */
function buildDocLookup(navData) {
  const map = new Map();
  for (const tab of navData) {
    for (const sec of tab.sections || []) {
      for (const doc of sec.documents || []) {
        // Direct doc path
        if (doc.path) map.set(doc.path.replace(/^\/+/, ""), { tabSlug: tab.slug, doc });
        // Legacy slug-based path
        const slugPath = `docs/${tab.slug}/${doc.slug}`;
        if (!map.has(slugPath)) map.set(slugPath, { tabSlug: tab.slug, doc });
        // Children
        for (const child of doc.children || []) {
          if (child.path) map.set(child.path.replace(/^\/+/, ""), { tabSlug: tab.slug, doc });
          const childSlugPath = `docs/${tab.slug}/${child.slug}`;
          if (!map.has(childSlugPath)) map.set(childSlugPath, { tabSlug: tab.slug, doc });
        }
      }
    }
  }
  return map;
}

export default function Sidebar() {
  const [navData, setNavData] = useState([]);
  const [expanded, setExpanded] = useState(new Set());
  const location = useLocation();
  const { tabSlug: paramTab, docSlug } = useParams();
  const { lang } = useLanguage();

  // Determine current path for active state detection
  const currentPath = location.pathname.replace(/^\/+|\/+$/g, "");

  // Fetch navigation tree (path-based) or fall back to legacy API
  useEffect(() => {
    api
      .get("/navigation")
      .then(({ data }) => setNavData(data))
      .catch(() => {
        // Fallback to legacy
        Promise.all([
          api.get("/tabs"),
          api.get("/sections"),
          api.get("/documents"),
        ])
          .then(([t, s, d]) => {
            const tabs = t.data;
            const sections = s.data;
            const docs = d.data;
            const result = tabs.map((tab) => ({
              ...tab,
              sections: sections
                .filter((sec) => sec.tab_id === tab.id)
                .sort((a, b) => a.order - b.order)
                .map((sec) => ({
                  ...sec,
                  documents: docs
                    .filter((d) => d.section_id === sec.id && d.published)
                    .sort((a, b) => a.order - b.order)
                    .map((d) => ({ ...d, path: null, children: null })),
                })),
            }));
            setNavData(result);
          })
          .catch(() => {});
      });
  }, []);

  // Build a flat lookup of all doc paths → tab
  const docLookup = useMemo(() => buildDocLookup(navData), [navData]);

  // Derive active tab — try URL params first, then path, then doc lookup, then fallback
  const pathParts = currentPath.split("/");
  const tabFromPath = pathParts[0] === "docs" ? pathParts[1] : null;
  const matchedTabFromLookup = docLookup.get(currentPath)?.tabSlug;
  const activeTabSlug = paramTab || tabFromPath || matchedTabFromLookup || navData[0]?.slug;
  const activeTab = navData.find((t) => t.slug === activeTabSlug) || navData[0];
  const tabSections = (activeTab?.sections || []).sort(
    (a, b) => a.order - b.order,
  );

  const onToggle = (id) =>
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Auto-expand ancestors of the active doc when URL changes
  useEffect(() => {
    if (!navData.length) return;
    const lookup = docLookup;
    const match = lookup.get(currentPath);
    if (!match) return;

    // Find the parent doc (section-level) that contains this doc/child
    const activeTabData = navData.find((t) => t.slug === match.tabSlug);
    if (!activeTabData) return;

    for (const sec of activeTabData.sections || []) {
      for (const doc of sec.documents || []) {
        if (doc.id === match.doc.id) {
          setExpanded((prev) => {
            const next = new Set(prev);
            next.add(doc.id);
            return next;
          });
          return;
        }
        // Check children
        for (const child of doc.children || []) {
          if (child.path && child.path.replace(/^\/+/, "") === currentPath) {
            setExpanded((prev) => {
              const next = new Set(prev);
              next.add(doc.id);
              return next;
            });
            return;
          }
          if (`docs/${match.tabSlug}/${child.slug}` === currentPath) {
            setExpanded((prev) => {
              const next = new Set(prev);
              next.add(doc.id);
              return next;
            });
            return;
          }
        }
      }
    }
  }, [currentPath, navData, docLookup]);

  // Link builder: prefer path-based URLs, fall back to /docs/:tab/:slug
  const docUrl = (doc) => {
    if (doc.path) return `/${doc.path}`;
    return `/docs/${activeTab?.slug || "rehberler"}/${doc.slug}`;
  };

  // Check if a doc is active based on path or slug
  const isDocActive = (doc) => {
    if (doc.path && currentPath === doc.path) return true;
    if (docSlug === doc.slug) return true;
    // Check children too
    if (doc.children) {
      return doc.children.some(
        (c) => c.path === currentPath || c.slug === docSlug,
      );
    }
    return false;
  };

  // Build flat list with depth for each section (supporting nested children)
  const buildFlat = (sectionDocs) => {
    const allDocs = [];
    sectionDocs.forEach((d) => {
      allDocs.push(d);
      if (d.children && d.children.length > 0) {
        d.children.forEach((c) =>
          allDocs.push({ ...c, _depth: 1, _parentId: d.id }),
        );
      }
    });

    // Auto-expand ancestors of active doc
    const pathIds = new Set();
    const activeDoc = allDocs.find((d) => isDocActive(d));
    if (activeDoc) {
      let cur = activeDoc;
      while (cur) {
        pathIds.add(cur.id);
        if (cur._parentId) {
          cur = allDocs.find((d) => d.id === cur._parentId);
        } else {
          break;
        }
      }
    }

    const out = [];
    sectionDocs.forEach((d) => {
      const hasChildren = d.children && d.children.length > 0;
      const isOpen = expanded.has(d.id) || pathIds.has(d.id);
      out.push({ doc: d, depth: 0, hasChildren, isOpen });
      if (hasChildren && isOpen) {
        d.children
          .sort((a, b) => a.order - b.order)
          .forEach((c) => {
            out.push({ doc: c, depth: 1, hasChildren: false, isOpen: false });
          });
      }
    });
    return out;
  };

  return (
    <aside
      className="w-[270px] shrink-0 hidden lg:block sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto py-8 pr-4"
      data-testid="docs-sidebar"
    >
      <nav className="space-y-7">
        {tabSections.map((s) => {
          const sectionDocs = (s.documents || []).filter(
            (d) => d.published !== false,
          );
          const flat = buildFlat(sectionDocs);
          return (
            <div key={s.id}>
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2 px-2"
                data-testid={`section-title-${s.slug}`}
              >
                {translateSection(s, lang).title}
              </div>
              <ul className="space-y-0.5">
                {flat.map(({ doc, depth, hasChildren, isOpen }) => {
                  const active = isDocActive(doc);
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
                          to={docUrl(doc)}
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
