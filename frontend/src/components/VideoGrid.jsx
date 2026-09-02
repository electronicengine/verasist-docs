import { useLanguage } from "@/contexts/LanguageContext";

export default function VideoGrid({ videos, title, cols = 3 }) {
  const { lang } = useLanguage();

  if (!videos || videos.length === 0) return null;

  const sorted = [...videos].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const colsClass =
    cols === 1
      ? "grid-cols-1"
      : cols === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div data-testid="video-grid">
      {title && (
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
      )}
      <div className={`grid ${colsClass} gap-6`}>
        {sorted.map((v) => {
          const videoTitle = (lang === "en" && v.title_en) || v.title;
          const description = (lang === "en" && v.description_en) || v.description;
          return (
            <div
              key={v.id}
              className="border border-border rounded-xl overflow-hidden bg-card"
              data-testid={`video-card-${v.id}`}
            >
              <video
                controls
                preload="metadata"
                className="w-full aspect-video bg-black"
                src={`/videos/${v.filename}`}
              />
              <div className="p-4">
                <h3 className="font-medium">{videoTitle}</h3>
                {description && (
                  <p className="text-sm text-muted-foreground mt-1">{description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
