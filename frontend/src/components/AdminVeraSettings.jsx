import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export default function AdminVeraSettings() {
  const [workflow, setWorkflow] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    api.get("/admin/vera").then(({ data }) => {
      if (active) { setWorkflow(data.workflow_uuid); setEnabled(data.enabled); setHasKey(data.has_api_key); }
    }).catch(err => { if (active) setError(formatApiError(err)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  async function save(event) {
    event.preventDefault(); setSaving(true); setError(""); setSaved(false);
    try {
      const { data } = await api.put("/admin/vera", { workflow_uuid: workflow.trim() || null, api_key: apiKey.trim(), enabled }, { timeout: 70000 });
      setHasKey(data.has_api_key); setApiKey(""); setSaved(true);
    } catch (err) { setError(formatApiError(err)); } finally { setSaving(false); }
  }
  return <section className="max-w-xl rounded-xl border border-border bg-card p-6">
    <h2 className="text-xl font-semibold">Vera sohbet ayarları</h2>
    <p className="mt-2 text-sm text-muted-foreground">Yayımlanmış workflow UUID’sini ve aynı organizasyona ait API anahtarını girin. Doküman erişimini bu workflow’a eklediğiniz MCP platform aracıyla yapılandırın.</p>
    <form onSubmit={save} className="mt-6 space-y-5">
      <div className="space-y-2"><Label htmlFor="vera-workflow">Workflow UUID</Label><Input id="vera-workflow" value={workflow} onChange={event => setWorkflow(event.target.value)} disabled={loading || saving} required={enabled} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" /><p className="text-xs text-muted-foreground">Sayısal workflow ID’si değil, workflow UUID’si kullanılır.</p></div>
      <div className="space-y-2"><Label htmlFor="vera-api-key">Verasist API anahtarı</Label><Input id="vera-api-key" type="password" autoComplete="new-password" value={apiKey} onChange={event => setApiKey(event.target.value)} disabled={loading || saving} required={enabled && !hasKey} placeholder={hasKey ? "Kayıtlı anahtarı korumak için boş bırakın" : "API anahtarınızı girin"} /><p className="text-xs text-muted-foreground">Anahtar sunucuda şifrelenerek saklanır; ziyaretçilerle paylaşılmaz.</p></div>
      <div className="flex items-center gap-3"><Switch id="vera-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={loading || saving} /><Label htmlFor="vera-enabled">Vera sohbetini etkinleştir</Label></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {saved && <p role="status" className="text-sm text-primary">Ayarlar kaydedildi. Değişiklikler yeni sohbetlerde kullanılacak.</p>}
      <Button type="submit" disabled={loading || saving}>{saving ? "Bağlantı kontrol ediliyor…" : "Kaydet"}</Button>
    </form>
  </section>;
}
