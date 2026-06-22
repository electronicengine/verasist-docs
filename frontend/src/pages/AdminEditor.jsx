import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import RichEditor from "@/components/RichEditor";
import { toast, Toaster } from "sonner";
import { ArrowLeft, Save, ExternalLink, Loader2 } from "lucide-react";

export default function AdminEditor() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [order, setOrder] = useState(0);
  const [published, setPublished] = useState(true);
  const [savedSlug, setSavedSlug] = useState(null);

  useEffect(() => {
    api.get("/sections").then(({ data }) => {
      setSections(data);
      if (isNew && data.length > 0) setSectionId((s) => s || data[0].id);
    });
    if (!isNew) {
      api
        .get("/documents")
        .then(({ data }) => {
          const found = data.find((d) => d.id === id);
          if (found) {
            // fetch full doc with content
            return api.get(`/documents/${found.slug}`);
          }
          throw new Error("Doküman bulunamadı");
        })
        .then(({ data: doc }) => {
          setTitle(doc.title);
          setSlug(doc.slug);
          setSectionId(doc.section_id);
          setExcerpt(doc.excerpt || "");
          setContent(doc.content || "");
          setOrder(doc.order || 0);
          setPublished(doc.published);
          setSavedSlug(doc.slug);
        })
        .catch((e) => toast.error(formatApiError(e)))
        .finally(() => setLoading(false));
    }
  }, [id, isNew]);

  const save = async () => {
    if (!title.trim()) {
      toast.error("Başlık gerekli");
      return;
    }
    if (!sectionId) {
      toast.error("Bölüm seçin");
      return;
    }
    setSaving(true);
    const payload = {
      title,
      slug: slug || undefined,
      section_id: sectionId,
      content,
      excerpt,
      order: Number(order),
      published,
    };
    try {
      if (isNew) {
        const { data } = await api.post("/documents", payload);
        toast.success("Doküman oluşturuldu");
        navigate(`/admin/edit/${data.id}`, { replace: true });
      } else {
        const { data } = await api.put(`/documents/${id}`, payload);
        setSavedSlug(data.slug);
        toast.success("Doküman güncellendi");
      }
    } catch (e) {
      toast.error(formatApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Yükleniyor...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="admin-editor">
      <Toaster theme={theme} position="top-right" />
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto h-16 px-4 sm:px-6 flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild data-testid="back-to-dashboard-btn">
            <Link to="/admin">
              <ArrowLeft className="w-4 h-4 mr-1.5" /> Panele dön
            </Link>
          </Button>
          <div className="flex-1" />
          {savedSlug && (
            <Button variant="outline" size="sm" asChild data-testid="preview-doc-btn">
              <Link to={`/docs/${savedSlug}`} target="_blank">
                <ExternalLink className="w-4 h-4 mr-1.5" /> Önizle
              </Link>
            </Button>
          )}
          <Button onClick={save} disabled={saving} data-testid="save-doc-btn">
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Kaydet
          </Button>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 grid lg:grid-cols-[1fr_280px] gap-8">
        <div className="space-y-5 min-w-0">
          <div>
            <Label htmlFor="title">Başlık</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Doküman başlığı"
              className="mt-1.5 text-lg"
              data-testid="editor-title-input"
            />
          </div>
          <div>
            <Label htmlFor="excerpt">Kısa açıklama</Label>
            <Textarea
              id="excerpt"
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="Listelerde gösterilecek kısa açıklama"
              className="mt-1.5"
              rows={2}
              data-testid="editor-excerpt-input"
            />
          </div>
          <div>
            <Label>İçerik</Label>
            <div className="mt-1.5">
              <RichEditor value={content} onChange={setContent} />
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="p-5 rounded-xl border border-border bg-card">
            <h3 className="font-semibold mb-4">Yayın ayarları</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="published" className="cursor-pointer">Yayında</Label>
                <Switch
                  id="published"
                  checked={published}
                  onCheckedChange={setPublished}
                  data-testid="editor-published-switch"
                />
              </div>
              <div>
                <Label htmlFor="section">Bölüm</Label>
                <Select value={sectionId} onValueChange={setSectionId}>
                  <SelectTrigger id="section" className="mt-1.5" data-testid="editor-section-select">
                    <SelectValue placeholder="Bölüm seç" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="slug">URL kısayolu (slug)</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="otomatik oluşturulur"
                  className="mt-1.5 font-mono text-xs"
                  data-testid="editor-slug-input"
                />
              </div>
              <div>
                <Label htmlFor="order">Sıra</Label>
                <Input
                  id="order"
                  type="number"
                  value={order}
                  onChange={(e) => setOrder(e.target.value)}
                  className="mt-1.5"
                  data-testid="editor-order-input"
                />
              </div>
            </div>
          </div>
          <div className="p-5 rounded-xl border border-border bg-card text-xs text-muted-foreground leading-relaxed">
            <strong className="block text-foreground mb-1">İpucu</strong>
            Slug boş bırakılırsa başlıktan otomatik üretilir. Sıra alanı, sol kenar çubuğunda görünüm sırasını
            belirler.
          </div>
        </aside>
      </div>
    </div>
  );
}
