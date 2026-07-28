import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import mermaid from "mermaid";
import { api } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { translateTab, translateSection } from "@/lib/translations";
import { ChevronRight, ArrowLeft, ArrowRight } from "lucide-react";
import VideoGrid from "@/components/VideoGrid";

export default function DocPage() {
  const params = useParams();
  const splat = params["*"];
  const slug = params.docSlug || params.slug;
  const tabSlugParam = params.tabSlug;
  const { lang } = useLanguage();
  const navigate = useNavigate();

  // Determine lookup mode: path-based (Mintlify) or slug-based (legacy /docs/...)
  const lookupPath =
    splat && splat !== "" && !splat.startsWith("docs/") ? splat : null;

  const [doc, setDoc] = useState(null);
  const [navData, setNavData] = useState(null);
  const [section, setSection] = useState(null);
  const [tab, setTab] = useState(null);
  const [siblings, setSiblings] = useState([]);
  const [toc, setToc] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [videos, setVideos] = useState([]);
  const contentRef = useRef(null);

  // Fetch document by path (Mintlify-style) or slug (legacy)
  useEffect(() => {
    setNotFound(false);
    setDoc(null);
    setNavData(null);
    setSection(null);
    setTab(null);
    setSiblings([]);

    if (lookupPath) {
      // Path-based lookup: GET /api/documents/by-path/{path}
      api
        .get(`/documents/by-path/${lookupPath}`)
        .then(({ data }) => {
          setDoc(data);
          // Also fetch navigation context
          return api.get("/navigation");
        })
        .then((navRes) => {
          if (navRes) setNavData(navRes.data);
        })
        .catch(() => setNotFound(true));
    } else if (slug) {
      // Legacy slug-based lookup
      api
        .get(`/documents/${slug}`)
        .then(({ data }) => setDoc(data))
        .catch(() => setNotFound(true));
    }
  }, [lookupPath, slug]);

  // Build navigation context from navData (path-based) or fetch directly (legacy slug-based)
  useEffect(() => {
    if (!doc) return;

    if (navData) {
      // Path-based: extract section, tab, and siblings from navigation tree
      for (const t of navData) {
        for (const s of t.sections || []) {
          const found = (s.documents || []).find(
            (d) =>
              d.id === doc.id || d.slug === doc.slug || d.path === doc.path,
          );
          if (found) {
            setTab(t);
            setSection({
              id: s.id,
              slug: s.slug,
              title: s.title,
              tab_id: t.id,
            });
            // Build siblings list from section docs
            const allDocs = [...(s.documents || [])];
            s.documents.forEach((d) => {
              if (d.children) allDocs.push(...d.children);
            });
            setSiblings(
              allDocs.sort((a, b) => (a.order || 0) - (b.order || 0)),
            );
            return;
          }
        }
      }
      // Fallback: try legacy API
      fetchLegacyContext();
    } else if (slug) {
      fetchLegacyContext();
    }

    function fetchLegacyContext() {
      Promise.all([
        api.get("/sections"),
        api.get("/tabs"),
        api.get("/documents", { params: { section_id: doc.section_id } }),
      ])
        .then(([s, t, d]) => {
          const sec = s.data.find((x) => x.id === doc.section_id) || null;
          setSection(sec);
          const tb = sec ? t.data.find((x) => x.id === sec.tab_id) : null;
          setTab(tb);
          const ordered = [...d.data].sort((a, b) => a.order - b.order);
          setSiblings(ordered);
        })
        .catch(() => {});
    }
  }, [doc, navData, slug]);

  // Build TOC from rendered content
  useEffect(() => {
    if (!doc) return;
    setTimeout(() => {
      const el = contentRef.current;
      if (!el) return;
      const headings = el.querySelectorAll("h2, h3");
      const items = [];
      headings.forEach((h, i) => {
        const id = `heading-${i}`;
        h.id = id;
        items.push({
          id,
          text: h.textContent,
          level: h.tagName === "H2" ? 2 : 3,
        });
      });
      setToc(items);

      // Render Mermaid diagrams – handles both .mermaid divs and <pre><code class="language-mermaid">
      const mermaidSelectors = [
        ".mermaid",
        "pre code.language-mermaid",
        'pre code[class*="mermaid"]',
      ];
      const mermaidEls = [];
      mermaidSelectors.forEach((sel) => {
        try {
          el.querySelectorAll(sel).forEach((n) => mermaidEls.push(n));
        } catch (_) {}
      });

      if (mermaidEls.length > 0) {
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
        });
        (async () => {
          for (let idx = 0; idx < mermaidEls.length; idx++) {
            const mel = mermaidEls[idx];
            const raw = mel.textContent || "";
            const code = raw
              .replace(/&gt;/g, ">")
              .replace(/&lt;/g, "<")
              .replace(/&amp;/g, "&")
              .trim();
            if (!code) continue;
            const id = `mermaid-${Date.now()}-${idx}`;
            try {
              const { svg } = await mermaid.render(id, code);
              const wrapper = mel.closest("pre") || mel;
              wrapper.outerHTML = svg;
            } catch (err) {
              console.warn("Mermaid render failed:", err);
              const wrapper = mel.closest("pre") || mel;
              wrapper.outerHTML = `<pre class="mermaid-error text-xs text-muted-foreground border border-destructive/30 rounded p-3 overflow-x-auto">${raw}</pre>`;
            }
          }
        })();
      }
    }, 50);
  }, [doc]);

  // Scroll spy
  useEffect(() => {
    if (toc.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveId(e.target.id);
        });
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );
    toc.forEach((t) => {
      const el = document.getElementById(t.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [toc]);

  // Fetch related videos for this document (by doc_id first, then by section_id)
  useEffect(() => {
    if (!doc?.id) return;
    api
      .get("/videos", { params: { document_id: doc.id } })
      .then(({ data }) => {
        if (data.length > 0) {
          setVideos(data);
        } else if (doc.section_id) {
          // Fallback: fetch by section
          return api.get("/videos", { params: { section_id: doc.section_id } });
        }
        return { data: [] };
      })
      .then((res) => {
        if (res?.data?.length) setVideos(res.data);
      })
      .catch(() => setVideos([]));
  }, [doc?.id, doc?.section_id]);

  if (notFound) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-3xl font-bold mb-3">Doküman bulunamadı</h1>
        <p className="text-muted-foreground mb-6">
          Aradığınız doküman silinmiş veya taşınmış olabilir.
        </p>
        <Link
          to="/"
          className="text-primary hover:underline"
          data-testid="not-found-home-link"
        >
          Ana sayfaya dön
        </Link>
      </div>
    );
  }

  if (!doc) {
    return <div className="py-16 text-muted-foreground">Yükleniyor...</div>;
  }

  const currentIdx = siblings.findIndex((d) => d.id === doc.id);
  const prev = currentIdx > 0 ? siblings[currentIdx - 1] : null;
  const next =
    currentIdx >= 0 && currentIdx < siblings.length - 1
      ? siblings[currentIdx + 1]
      : null;

  // Use path-based URL if available (Mintlify-style), otherwise fall back to /docs/:tab/:slug
  const docLink = (d) => {
    const p = d.path || d.slug;
    if (p && !p.startsWith("docs/")) return `/${p}`;
    const ts = tab?.slug || tabSlugParam || "rehberler";
    return `/docs/${ts}/${d.slug}`;
  };

  return (
    <div className="flex gap-10" data-testid={`doc-page-${doc.slug}`}>
      <article className="flex-1 min-w-0 max-w-3xl">
        {/* Breadcrumb */}
        <nav
          className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6"
          data-testid="doc-breadcrumb"
        >
          <Link to="/" className="hover:text-foreground">
            Dokümantasyon
          </Link>
          {tab && !lookupPath && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link to={`/docs/${tab.slug}`} className="hover:text-foreground">
                {translateTab(tab, lang).title}
              </Link>
            </>
          )}
          {section && (
            <>
              <ChevronRight className="w-3.5 h-3.5" />
              <span>{translateSection(section, lang).title}</span>
            </>
          )}
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-foreground">{doc.title}</span>
        </nav>

        <h1
          className="text-4xl font-bold tracking-tight mb-3"
          data-testid="doc-title"
        >
          {doc.title}
        </h1>
        {doc.excerpt && (
          <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
            {doc.excerpt}
          </p>
        )}

        {/* Related Video Tutorials */}
        <div className="mb-8">
          <VideoGrid
            videos={videos}
            title={lang === "en" ? "Related Video Tutorials" : "Bu Konuyla İlgili Videolar"}
            cols={1}
          />
        </div>

        <div
          ref={contentRef}
          className="doc-content"
          dangerouslySetInnerHTML={{ __html: doc.content }}
          onClick={(e) => {
            const a = e.target.closest("a[href]");
            if (a) {
              const href = a.getAttribute("href");
              if (href?.startsWith("/")) {
                e.preventDefault();
                navigate(href);
              }
            }
          }}
        />

        {/* Prev / Next */}
        <div className="mt-16 pt-8 border-t border-border grid grid-cols-2 gap-4">
          <div>
            {prev && (
              <Link
                to={docLink(prev)}
                className="block p-4 rounded-lg border border-border hover:border-primary/50 transition-colors group"
                data-testid="prev-doc-link"
              >
                <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                  <ArrowLeft className="w-3 h-3" /> Önceki
                </div>
                <div className="text-sm font-medium group-hover:text-primary">
                  {prev.title}
                </div>
              </Link>
            )}
          </div>
          <div>
            {next && (
              <Link
                to={docLink(next)}
                className="block p-4 rounded-lg border border-border hover:border-primary/50 transition-colors group text-right"
                data-testid="next-doc-link"
              >
                <div className="text-xs text-muted-foreground flex items-center justify-end gap-1 mb-1">
                  Sonraki <ArrowRight className="w-3 h-3" />
                </div>
                <div className="text-sm font-medium group-hover:text-primary">
                  {next.title}
                </div>
              </Link>
            )}
          </div>
        </div>
      </article>

      {/* TOC */}
      {toc.length > 0 && (
        <aside className="hidden xl:block w-[200px] shrink-0 sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto py-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
            Bu sayfada
          </div>
          <ul className="space-y-2 text-sm border-l border-border">
            {toc.map((t) => (
              <li key={t.id}>
                <a
                  href={`#${t.id}`}
                  className={`block -ml-px pl-3 py-0.5 border-l transition-colors ${
                    activeId === t.id
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  } ${t.level === 3 ? "pl-6" : ""}`}
                  data-testid={`toc-${t.id}`}
                >
                  {t.text}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      )}
    </div>
  );
}
