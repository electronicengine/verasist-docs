import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, FileText } from "lucide-react";
import { api } from "@/lib/api";

export default function SearchDialog({ open, onOpenChange }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) {
      setQ("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/search`, { params: { q } });
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 max-w-2xl gap-0 overflow-hidden"
        data-testid="search-dialog"
      >
        <DialogTitle className="sr-only">Dökümanlarda Ara</DialogTitle>
        <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Doküman başlığı veya içeriğinde ara..."
            className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:text-muted-foreground"
            data-testid="search-input"
          />
          <kbd className="text-[10px] text-muted-foreground px-1.5 py-0.5 border border-border rounded">
            ESC
          </kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto" data-testid="search-results">
          {!q && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Aramaya başlamak için yazın
            </div>
          )}
          {q && loading && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Aranıyor...
            </div>
          )}
          {q && !loading && results.length === 0 && (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Sonuç bulunamadı
            </div>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => {
                onOpenChange(false);
                navigate(`/docs/${r.slug}`);
              }}
              className="w-full text-left px-4 py-3 hover:bg-secondary/60 transition-colors flex items-start gap-3 border-b border-border/50"
              data-testid={`search-result-${r.slug}`}
            >
              <FileText className="w-4 h-4 mt-1 text-primary shrink-0" />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{r.title}</div>
                {r.excerpt && (
                  <div className="text-xs text-muted-foreground truncate mt-0.5">
                    {r.excerpt}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
