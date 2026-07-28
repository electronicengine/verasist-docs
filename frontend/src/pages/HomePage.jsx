import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { t } from "@/lib/translations";
import VideoGrid from "@/components/VideoGrid";

export default function HomePage() {
  const { lang } = useLanguage();
  const [tabs, setTabs] = useState([]);
  const [sections, setSections] = useState([]);
  const [docs, setDocs] = useState([]);
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    Promise.all([api.get("/tabs"), api.get("/sections"), api.get("/documents"), api.get("/videos")])
      .then(([t, s, d, v]) => {
        setTabs(t.data);
        setSections(s.data);
        setDocs(d.data);
        setVideos(v.data);
      })
      .catch(() => {});
  }, []);

  const tabForSection = (sec) => tabs.find((t) => t.id === sec.tab_id);
  const linkFor = (sec, docSlug) =>
    `/docs/${tabForSection(sec)?.slug || "guides"}/${docSlug}`;

  return (
    <div className="-mt-8 lg:-mt-12">
      {/* Video Tutorials */}
      <div className="mt-8">
        <VideoGrid
          videos={videos}
          title={lang === "en" ? "Video Tutorials" : "Video Eğitimler"}
        />
      </div>

      {/* Sections grid */}
      <section className="mt-20">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold">{t("sections.heading", lang)}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("sections.subtitle", lang)}
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
                        to={linkFor(s, d.slug)}
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
