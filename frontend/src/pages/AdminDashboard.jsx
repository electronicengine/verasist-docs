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
} from "lucide-react";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [docs, setDocs] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [filterSection, setFilterSection] = useState("all");
  const [sectionDialog, setSectionDialog] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [showLogoFallback, setShowLogoFallback] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionOrder, setSectionOrder] = useState(0);
  const [sectionTabId, setSectionTabId] = useState("");

  const load = async () => {
    try {
      const [s, d, t] = await Promise.all([
        api.get("/sections"),
        api.get("/documents"),
        api.get("/tabs"),
      ]);
      setSections(s.data);
      setDocs(d.data);
      setTabs(t.data);
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
                        <Link to={`/docs/${d.slug}`} target="_blank">
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
    </div>
  );
}
