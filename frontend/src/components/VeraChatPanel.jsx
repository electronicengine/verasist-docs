import { useEffect, useRef, useState } from "react";
import VeraMarkdown from "./VeraMarkdown";
import { sendVeraMessage } from "@/lib/veraStream";
import { Loader2, Send, Sparkles, RotateCcw } from "lucide-react";
import { api, formatApiError } from "@/lib/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";

const storageKey = (lang) => `verasist-docs-vera:${lang}`;
function savedToken(lang) { try { return sessionStorage.getItem(storageKey(lang)); } catch { return null; } }
function persistToken(lang, token) { try { token ? sessionStorage.setItem(storageKey(lang), token) : sessionStorage.removeItem(storageKey(lang)); } catch {} }

export default function VeraChatPanel({ open, onOpenChange }) {
  const { lang } = useLanguage();
  const en = lang === "en";
  const [token, setToken] = useState(() => savedToken(lang));
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [closed, setClosed] = useState(false);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");
  const [tools, setTools] = useState([]);
  const [partial, setPartial] = useState("");
  const stream = useRef(null);
  const end = useRef(null);
  const generation = useRef(0);
  const sending = useRef(false);
  const apply = (data) => { setMessages(data.messages || []); setClosed(Boolean(data.closed)); setPending(data.pending || null); if (!data.pending) setPartial(""); };

  useEffect(() => {
    generation.current += 1;
    stream.current?.abort();
    setPartial(""); setTools([]);
    setToken(savedToken(lang)); setMessages([]); setPending(null); setClosed(false); setText(""); setError(""); setBusy(false);
  }, [lang]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const status = await api.get("/vera/status");
        if (cancelled) return;
        setEnabled(status.data.enabled);
        const stored = savedToken(lang);
        if (status.data.enabled && stored && !sending.current) {
          const response = await api.get("/vera/session", { headers: { "X-Vera-Session": stored } });
          if (!cancelled) { setToken(stored); apply(response.data); }
        }
      } catch (err) {
        if (!cancelled) {
          setError(formatApiError(err));
          if ([404, 409].includes(err.response?.status)) { persistToken(lang, null); setToken(null); setMessages([]); setPending(null); }
        }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [open, lang]);

  useEffect(() => { if (open) end.current?.scrollIntoView({ block: "end" }); }, [messages, pending, partial, busy, open]);

  useEffect(() => () => { generation.current += 1; stream.current?.abort(); }, []);

  useEffect(() => {
    if (!open || !token || !pending || busy) return;
    let cancelled = false, running = false;
    const poll = async () => {
      if (running) return;
      running = true;
      try {
        const response = await api.get("/vera/session", { headers: { "X-Vera-Session": token } });
        if (!cancelled) { apply(response.data); if (!response.data.pending) setError(""); }
      } catch { /* A pending request can complete after connectivity returns. */ }
      finally { running = false; }
    };
    const timer = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [open, token, pending, busy]);

  async function send(retry = false) {
    if (sending.current || busy || loading || !enabled || closed) return;
    const message = retry ? pending : { request_id: crypto.randomUUID(), text: text.trim() };
    if (!message?.text || (!retry && pending)) return;
    const current = generation.current;
    sending.current = true; setTools([]); setBusy(true); setError(""); setPartial(""); setPending(message); setText("");
    const controller = new AbortController(); stream.current = controller;
    let activeToken = token;
    try {
      if (!activeToken) {
        const response = await api.post("/vera/sessions", { lang });
        activeToken = response.data.session_token;
        persistToken(lang, activeToken);
        if (generation.current === current) setToken(activeToken);
      }
      const result = await sendVeraMessage(activeToken, message, (value) => {
        if (generation.current === current) setPartial(value);
      }, controller.signal, (tool) => {
        if (generation.current !== current) return;
        setTools(items => {
          const index = items.findIndex(t => t.turn_id === tool.turn_id && t.tool_call_id === tool.tool_call_id);
          return index < 0 ? [...items, tool] : items.map((t, i) => i === index ? tool : t);
        });
      });
      if (generation.current === current) apply(result);
    } catch (err) {
      if (generation.current === current) setError(formatApiError(err));
    } finally { sending.current = false; if (generation.current === current) setBusy(false); }
  }

  async function reset() {
    if (busy || sending.current) return;
    generation.current += 1;
    const old = token;
    persistToken(lang, null); setToken(null); setMessages([]); setPending(null); setPartial(""); setClosed(false); setError(""); setText("");
    if (old) { try { await api.delete("/vera/session", { headers: { "X-Vera-Session": old } }); } catch {} }
  }

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-full sm:max-w-[440px] flex flex-col p-0 gap-0" data-testid="vera-chat-panel">
      <div className="p-5 pr-12 border-b border-border">
        <SheetTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" />{en ? "Ask Vera" : "Vera’ya sor"}</SheetTitle>
        <SheetDescription className="mt-1">{en ? "Ask your questions about Verasist." : "Verasist hakkındaki sorularını sor."}</SheetDescription>
      </div>
      <div className="flex justify-end px-4 py-2 border-b border-border">
        <Button variant="ghost" size="sm" onClick={reset} disabled={busy || loading}><RotateCcw className="w-3.5 h-3.5 mr-2" />{en ? "New chat" : "Yeni sohbet"}</Button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4" role="log" aria-live="polite" aria-label={en ? "Conversation" : "Sohbet"}>
        {loading && <p className="text-sm text-muted-foreground">{en ? "Loading…" : "Yükleniyor…"}</p>}
        {!loading && !enabled && <p className="text-sm text-muted-foreground">{en ? "Vera is not available yet. An administrator can enable it in the docs admin panel." : "Vera henüz etkin değil. Yönetici, docs admin panelinden bağlantıyı ayarlayabilir."}</p>}
        {!loading && enabled && messages.length === 0 && !pending && <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">{en ? "Hi, I’m Vera. How can I help?" : "Merhaba, ben Vera. Nasıl yardımcı olabilirim?"}</div>}
        {messages.map(message => <div key={message.id} className={`rounded-xl p-3 text-sm whitespace-pre-wrap break-words ${message.role === "user" ? "ml-8 bg-primary text-primary-foreground" : "mr-4 border border-border bg-secondary/30"}`}>
          <span className="block mb-1 text-xs font-semibold opacity-75">{message.role === "user" ? (en ? "You" : "Sen") : "Vera"}</span>{message.role === "assistant" ? <VeraMarkdown>{message.text || (en ? "This turn completed without a text response." : "Bu tur metin yanıtı olmadan tamamlandı.")}</VeraMarkdown> : message.text}
        </div>)}
        {pending && <div className="ml-8 rounded-xl p-3 text-sm whitespace-pre-wrap break-words bg-primary/15">{pending.text}</div>}
        {partial && <div className="mr-4 min-w-0 rounded-xl border border-border bg-secondary/30 p-3 text-sm break-words" data-testid="vera-partial"><span className="block mb-1 text-xs font-semibold opacity-75">Vera</span><VeraMarkdown>{partial}</VeraMarkdown></div>}
        {tools.length > 0 && <div role="status" aria-label={en ? "Tool calls" : "Araç çağrıları"} className="space-y-1 text-xs text-muted-foreground break-words">{tools.map(tool => <div key={`${tool.turn_id}:${tool.tool_call_id}`}>
          {tool.status === "running" ? "◌" : tool.status === "failed" ? "!" : "✓"} {tool.function_name.replace(/_/g, " ")} · {tool.status === "running" ? (busy ? (en ? "Running…" : "Çalışıyor…") : (en ? "Status unconfirmed" : "Durum doğrulanamadı")) : tool.status === "failed" ? (en ? "Failed" : "Başarısız") : (en ? "Completed" : "Tamamlandı")}
        </div>)}</div>}
        {busy && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />{en ? "Vera is thinking…" : "Vera yanıtlıyor…"}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {pending && !busy && <Button variant="outline" size="sm" disabled={loading || !enabled || closed} onClick={() => send(true)}>{en ? "Retry message" : "Mesajı yeniden dene"}</Button>}
        {closed && <p className="text-sm text-muted-foreground">{en ? "This conversation has ended. Start a new chat to continue." : "Bu görüşme tamamlandı. Devam etmek için yeni sohbet başlat."}</p>}
        <div ref={end} />
      </div>
      <form className="border-t border-border p-4 space-y-2" onSubmit={event => { event.preventDefault(); send(); }}>
        <Textarea value={text} onChange={event => setText(event.target.value)} maxLength={4000} rows={3} disabled={!enabled || busy || loading || closed || Boolean(pending)} aria-label={en ? "Your question" : "Sorun"} placeholder={en ? "Write your question…" : "Sorunu yaz…"} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} />
        <div className="flex items-center justify-between gap-2"><span className="text-[11px] text-muted-foreground">{en ? "Vera can make mistakes." : "Vera hata yapabilir."}</span><Button type="submit" size="sm" disabled={!text.trim() || !enabled || busy || loading || closed || Boolean(pending)}><Send className="w-4 h-4 mr-2" />{en ? "Send" : "Gönder"}</Button></div>
      </form>
    </SheetContent>
  </Sheet>;
}
