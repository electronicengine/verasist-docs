import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import VideoGrid from "@/components/VideoGrid";

export default function VideoPage() {
  const { lang } = useLanguage();
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    api
      .get("/videos")
      .then(({ data }) => setVideos(data))
      .catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-2" data-testid="videos-title">
        {lang === "en" ? "Video Tutorials" : "Video Eğitimler"}
      </h1>
      <p className="text-muted-foreground mb-8">
        {lang === "en"
          ? "Watch step-by-step video guides for using Verasist."
          : "Verasist'i kullanmayla ilgili adım adım video rehberleri izleyin."}
      </p>
      <VideoGrid videos={videos} />
    </div>
  );
}
