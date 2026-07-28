import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast, Toaster } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  LogOut,
  FolderPlus,
  Folder,
  ExternalLink,
  Moon,
  Sun,
  Video,
} from "lucide-react";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("docs"); // "docs" | "videos"
  const [sections, setSections] = useState([]);
  const [docs, setDocs] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [videos, setVideos] = useState([]);
  const [filterSection, setFilterSection] = useState("all");
  const [sectionDialog, setSectionDialog] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [showLogoFallback, setShowLogoFallback] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionOrder, setSectionOrder] = useState(0);
  const [sectionTabId, setSectionTabId] = useState("");

  // Video dialog state
  const [videoDialog, setVideoDialog] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoTitleEn, setVideoTitleEn] = useState("");
  const [videoFilename, setVideoFilename] = useState("");
  const [videoDesc, setVideoDesc] = useState("");
  const [videoDescEn, setVideoDescEn] = useState("");
  const [videoDocId, setVideoDocId] = useState("");
  const [videoSectionId, setVideoSectionId] = useState("");
  const [videoOrder, setVideoOrder] = useState(0);

  const load = async () => {
    try {
      const [s, d, t, v] = await Promise.all([
        api.get("/sections"),
        api.get("/documents"),
        api.get("/tabs"),
        api.get("/videos"),
      ]);
      setSections(s.data);
      setDocs(d.data);
      setTabs(t.data);
      setVideos(v.data);
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openSection = (s = null) => {
    if (s) {
      setEditingSection(s);
      setSectionTitle(s.title);
      setSectionOrder(s.order);
      setSectionTabId(s.tab_id || (tabs[0]?.id ?? ""));
    } else {
      setEditingSection(null);
      setSectionTitle("");
      setSectionOrder(sections.length + 1);
      setSectionTabId(tabs[0]?.id ?? "");
    }
    setSectionDialog(true);
  };

  const saveSection = async () => {
    try {
      if (editingSection) {
        await api.put(`/sections/${editingSection.id}`, {
          title: sectionTitle,
          order: Number(sectionOrder),
          tab_id: sectionTabId || undefined,
        });
        toast.success("Bölüm güncellendi");
      } else {
        await api.post("/sections", {
          title: sectionTitle,
          order: Number(sectionOrder),
          tab_id: sectionTabId || undefined,
        });
        toast.success("Bölüm oluşturuldu");
      }
      setSectionDialog(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const deleteSection = async (s) => {
    if (!window.confirm(`"${s.title}" bölümünü ve içindeki tüm dokümanları silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/sections/${s.id}`);
      toast.success("Bölüm silindi");
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const deleteDoc = async (d) => {
    if (!window.confirm(`"${d.title}" dokümanını silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/documents/${d.id}`);
      toast.success("Doküman silindi");
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  // ----- Video CRUD -----
  const openVideo = (v = null) => {
    if (v) {
      setEditingVideo(v);
      setVideoTitle(v.title);
      setVideoTitleEn(v.title_en || "");
      setVideoFilename(v.filename);
      setVideoDesc(v.description || "");
      setVideoDescEn(v.description_en || "");
      setVideoDocId(v.document_id || "");
      setVideoSectionId(v.section_id || "");
      setVideoOrder(v.order);
    } else {
      setEditingVideo(null);
      setVideoTitle("");
      setVideoTitleEn("");
      setVideoFilename("");
      setVideoDesc("");
      setVideoDescEn("");
      setVideoDocId("");
      setVideoOrder(videos.length + 1);
    }
    setVideoDialog(true);
  };

  const saveVideo = async () => {
    if (!videoTitle.trim() || !videoFilename.trim()) {
      toast.error("Başlık ve dosya adı zorunludur");
      return;
    }
    try {
      const payload = {
        title: videoTitle,
        title_en: videoTitleEn,
        filename: videoFilename,
        description: videoDesc,
        description_en: videoDescEn,
        document_id: videoDocId || null,
        section_id: videoSectionId || null,
        order: Number(videoOrder),
      };
      if (editingVideo) {
        await api.put(`/videos/${editingVideo.id}`, payload);
        toast.success("Video güncellendi");
      } else {
        await api.post("/videos", payload);
        toast.success("Video eklendi");
      }
      setVideoDialog(false);
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const deleteVideo = async (v) => {
    if (!window.confirm(`"${v.title}" videosunu silmek istediğinize emin misiniz?`)) return;
    try {
      await api.delete(`/videos/${v.id}`);
      toast.success("Video silindi");
      load();
    } catch (e) {
      toast.error(formatApiError(e));
    }
  };

  const filteredDocs = docs
    .filter((d) => filterSection === "all" || d.section_id === filterSection)
    .sort((a, b) => a.order - b.order);

  return (
    <div className="min-h-screen bg-background" data-testid="admin-dashboard">
      <Toaster theme={theme} position="top-right" />
      {/* Top bar */}
      <header className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto h-16 px-4 sm:px-6 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-11 h-11 rounded-xl border border-border/70 bg-background shadow-sm overflow-hidden flex items-center justify-center">
              <img
                src="/logo.png"
                alt="Verasist logo"
                className={`h-8 w-8 object-contain ${showLogoFallback ? "hidden" : "block"}`}
                onError={() => setShowLogoFallback(true)}
              />
              {showLogoFallback && <span className="text-sm font-semibold tracking-wide text-foreground">V</span>}
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Panel</div>
              <div className="font-semibold leading-tight" style={{ fontFamily: "Outfit" }}>
                Yönetim
              </div>
            </div>
          </Link>
          <div className="flex-1" />
          <div className="text-sm text-muted-foreground hidden sm:block" data-testid="admin-user-info">
            {user?.email}
          </div>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Tema" data-testid="admin-theme-toggle">
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="sm" asChild data-testid="view-site-btn">
            <Link to="/">
              <ExternalLink className="w-4 h-4 mr-1.5" />
              Siteyi gör
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              logout();
              navigate("/admin/login");
            }}
            data-testid="admin-logout-btn"
          >
            <LogOut className="w-4 h-4 mr-1.5" />
            Çıkış
          </Button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-10">
        {/* Tab switcher */}
        <div className="flex items-center gap-1 mb-8 border-b border-border pb-0">
          <button
            onClick={() => setActiveTab("docs")}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors -mb-[1px] ${
              activeTab === "docs"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid="admin-tab-docs"
          >
            <Folder className="w-4 h-4 inline mr-1.5" />
            Dokümanlar
          </button>
          <button
            onClick={() => setActiveTab("videos")}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors -mb-[1px] ${
              activeTab === "videos"
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
            data-testid="admin-tab-videos"
          >
            <Video className="w-4 h-4 inline mr-1.5" />
            Videolar
          </button>
          <div className="flex-1 border-b border-border" />
        </div>

        {/* Docs tab content */}
        {activeTab === "docs" && (
          <>
        {/* Sections row */}
        <div className="mb-10">
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Folder className="w-5 h-5 text-primary" /> Bölümler
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Dokümantasyon kategorilerini yönetin
              </p>
            </div>
            <Button size="sm" onClick={() => openSection()} data-testid="new-section-btn">
              <FolderPlus className="w-4 h-4 mr-1.5" />
              Yeni bölüm
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {sections.map((s) => {
              const tab = tabs.find((t) => t.id === s.tab_id);
              return (
              <div
                key={s.id}
                className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-card text-sm"
                data-testid={`section-chip-${s.slug}`}
              >
                <span>{s.title}</span>
                {tab && (
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                    {tab.title}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  ({docs.filter((d) => d.section_id === s.id).length})
                </span>
                <button
                  onClick={() => openSection(s)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity"
                  aria-label="Düzenle"
                  data-testid={`edit-section-${s.slug}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteSection(s)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                  aria-label="Sil"
                  data-testid={`delete-section-${s.slug}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              );
            })}
            {sections.length === 0 && (
              <div className="text-sm text-muted-foreground">Henüz bölüm yok</div>
            )}
          </div>
        </div>

        {/* Documents */}
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold">Dokümanlar</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Toplam {docs.length} doküman
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={filterSection} onValueChange={setFilterSection}>
              <SelectTrigger className="w-[180px]" data-testid="filter-section-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm bölümler</SelectItem>
                {sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild data-testid="new-doc-btn">
              <Link to="/admin/edit/new">
                <Plus className="w-4 h-4 mr-1.5" />
                Yeni doküman
              </Link>
            </Button>
          </div>
        </div>

        <div className="border border-border rounded-xl overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Başlık</TableHead>
                <TableHead>Bölüm</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead>Sıra</TableHead>
                <TableHead>Güncelleme</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocs.map((d) => {
                const sec = sections.find((s) => s.id === d.section_id);
                return (
                  <TableRow key={d.id} data-testid={`doc-row-${d.slug}`}>
                    <TableCell className="font-medium">
                      <div>{d.title}</div>
                      <div className="text-xs text-muted-foreground font-normal">{d.slug}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{sec?.title || "-"}</TableCell>
                    <TableCell>
                      {d.published ? (
                        <Badge className="bg-primary/15 text-primary hover:bg-primary/20 border-primary/30">
                          Yayında
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Taslak</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{d.order}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(d.updated_at).toLocaleDateString("tr-TR")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        aria-label="Görüntüle"
                        data-testid={`view-doc-${d.slug}`}
                      >
                        <Link to={d.path ? `/${d.path}` : `/docs/${d.slug}`} target="_blank">
                          <ExternalLink className="w-4 h-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        aria-label="Düzenle"
                        data-testid={`edit-doc-${d.slug}`}
                      >
                        <Link to={`/admin/edit/${d.id}`}>
                          <Pencil className="w-4 h-4" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteDoc(d)}
                        aria-label="Sil"
                        data-testid={`delete-doc-${d.slug}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filteredDocs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                    Doküman yok. Yeni bir doküman oluşturun.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

      {/* Section dialog */}
      <Dialog open={sectionDialog} onOpenChange={setSectionDialog}>
        <DialogContent data-testid="section-dialog">
          <DialogHeader>
            <DialogTitle>{editingSection ? "Bölümü düzenle" : "Yeni bölüm"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="section-title">Başlık</Label>
              <Input
                id="section-title"
                value={sectionTitle}
                onChange={(e) => setSectionTitle(e.target.value)}
                className="mt-1.5"
                data-testid="section-title-input"
              />
            </div>
            <div>
              <Label htmlFor="section-tab">Sekme</Label>
              <Select value={sectionTabId} onValueChange={setSectionTabId}>
                <SelectTrigger id="section-tab" className="mt-1.5" data-testid="section-tab-select">
                  <SelectValue placeholder="Sekme seç" />
                </SelectTrigger>
                <SelectContent>
                  {tabs.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="section-order">Sıra</Label>
              <Input
                id="section-order"
                type="number"
                value={sectionOrder}
                onChange={(e) => setSectionOrder(e.target.value)}
                className="mt-1.5"
                data-testid="section-order-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectionDialog(false)}>
              İptal
            </Button>
            <Button onClick={saveSection} disabled={!sectionTitle.trim()} data-testid="save-section-btn">
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
          </>
        )}

        {/* Videos tab content */}
        {activeTab === "videos" && (
          <>
            <div className="flex items-end justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Video className="w-5 h-5 text-primary" /> Videolar
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Eğitim videolarını yönetin — her video bir dokümana bağlanabilir
                </p>
              </div>
              <Button size="sm" onClick={() => openVideo()} data-testid="new-video-btn">
                <Plus className="w-4 h-4 mr-1.5" />
                Yeni video
              </Button>
            </div>

            <div className="border border-border rounded-xl overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Başlık</TableHead>
                    <TableHead>Dosya</TableHead>
                    <TableHead>Bağlı Doküman</TableHead>
                    <TableHead>Bağlı Bölüm</TableHead>
                    <TableHead>Sıra</TableHead>
                    <TableHead className="text-right">İşlem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videos.map((v) => {
                    const linkedDoc = docs.find((d) => d.id === v.document_id);
                    const linkedSection = sections.find((s) => s.id === v.section_id);
                    return (
                      <TableRow key={v.id} data-testid={`video-row-${v.id}`}>
                        <TableCell className="font-medium">
                          <div>{v.title}</div>
                          {v.title_en && (
                            <div className="text-xs text-muted-foreground">{v.title_en}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground font-mono">
                          /videos/{v.filename}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {linkedDoc ? linkedDoc.title : <span className="italic">—</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {linkedSection ? linkedSection.title : <span className="italic">—</span>}
                        </TableCell>
                        <TableCell className="text-sm">{v.order}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openVideo(v)}
                            aria-label="Düzenle"
                            data-testid={`edit-video-${v.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteVideo(v)}
                            aria-label="Sil"
                            data-testid={`delete-video-${v.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {videos.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                        Henüz video yok. İlk videoyu ekleyin.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Video dialog */}
            <Dialog open={videoDialog} onOpenChange={setVideoDialog}>
              <DialogContent data-testid="video-dialog">
                <DialogHeader>
                  <DialogTitle>{editingVideo ? "Videoyu düzenle" : "Yeni video"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <Label htmlFor="video-title">Başlık (TR)</Label>
                    <Input
                      id="video-title"
                      value={videoTitle}
                      onChange={(e) => setVideoTitle(e.target.value)}
                      className="mt-1.5"
                      data-testid="video-title-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="video-title-en">Başlık (EN)</Label>
                    <Input
                      id="video-title-en"
                      value={videoTitleEn}
                      onChange={(e) => setVideoTitleEn(e.target.value)}
                      className="mt-1.5"
                      data-testid="video-title-en-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="video-filename">Dosya adı</Label>
                    <Input
                      id="video-filename"
                      value={videoFilename}
                      onChange={(e) => setVideoFilename(e.target.value)}
                      placeholder="ornek_video.mp4"
                      className="mt-1.5"
                      data-testid="video-filename-input"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Dosya <code>public/videos/</code> klasöründe bulunmalıdır.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="video-desc">Açıklama (TR)</Label>
                    <Input
                      id="video-desc"
                      value={videoDesc}
                      onChange={(e) => setVideoDesc(e.target.value)}
                      className="mt-1.5"
                      data-testid="video-desc-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="video-desc-en">Açıklama (EN)</Label>
                    <Input
                      id="video-desc-en"
                      value={videoDescEn}
                      onChange={(e) => setVideoDescEn(e.target.value)}
                      className="mt-1.5"
                      data-testid="video-desc-en-input"
                    />
                  </div>
                  <div>
                    <Label htmlFor="video-doc">Bağlı doküman</Label>
                    <Select value={videoDocId} onValueChange={setVideoDocId}>
                      <SelectTrigger id="video-doc" className="mt-1.5" data-testid="video-doc-select">
                        <SelectValue placeholder="Doküman seç (opsiyonel)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">— Bağlı doküman yok —</SelectItem>
                        {docs
                          .sort((a, b) => a.title.localeCompare(b.title))
                          .map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="video-section">Bağlı bölüm</Label>
                    <Select value={videoSectionId} onValueChange={setVideoSectionId}>
                      <SelectTrigger id="video-section" className="mt-1.5" data-testid="video-section-select">
                        <SelectValue placeholder="Bölüm seç (opsiyonel)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">— Bağlı bölüm yok —</SelectItem>
                        {sections.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="video-order">Sıra</Label>
                    <Input
                      id="video-order"
                      type="number"
                      value={videoOrder}
                      onChange={(e) => setVideoOrder(e.target.value)}
                      className="mt-1.5"
                      data-testid="video-order-input"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setVideoDialog(false)}>
                    İptal
                  </Button>
                  <Button
                    onClick={saveVideo}
                    disabled={!videoTitle.trim() || !videoFilename.trim()}
                    data-testid="save-video-btn"
                  >
                    Kaydet
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </div>
  );
}
