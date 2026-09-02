/**
 * Static nav/grouping config for the API Reference "Try it" pages.
 *
 * This mirrors the hand-curated endpoint set already documented in
 * docs/api-reference/*.mdx (workflows, campaigns, runs, telephony-configs,
 * api-keys) — NOT the raw OpenAPI `tags` field, which is generically
 * "main" for every route (see api/routes/main.py), and NOT the same set
 * as `@sdk_expose`-tagged operations (a different, non-overlapping surface
 * used only for SDK codegen).
 *
 * Each entry either has {method, path} (a leaf endpoint, resolvable in the
 * live OpenAPI spec) or {children} (a nested sub-section, e.g. Workflows→Runs).
 * `opSlug` segments join with "/" to form the route splat, e.g.
 * "runs/create" under the "workflows" group → /api-referansi/workflows/runs/create.
 */

export const API_REFERENCE_GROUPS = [
  {
    slug: "api-keys",
    order: 0,
    title_tr: "API Anahtarları",
    title_en: "API Keys",
    entries: [
      { opSlug: "create", method: "POST", path: "/user/api-keys", title_tr: "API anahtarı oluştur", title_en: "Create an API key", description_tr: "Programatik erişim için yeni bir API anahtarı oluşturur.", description_en: "Create a new API key for programmatic access." },
      { opSlug: "list", method: "GET", path: "/user/api-keys", title_tr: "API anahtarlarını listele", title_en: "List API keys", description_tr: "Organizasyonunuza ait tüm API anahtarlarını getirir.", description_en: "Retrieve all API keys for your organization." },
      { opSlug: "archive", method: "DELETE", path: "/user/api-keys/{api_key_id}", title_tr: "API anahtarını arşivle", title_en: "Archive an API key", description_tr: "Bir API anahtarını ID'sine göre devre dışı bırakır; anahtar hemen geçersiz olur.", description_en: "Deactivate an API key by ID. The key is revoked immediately." },
      { opSlug: "reactivate", method: "PUT", path: "/user/api-keys/{api_key_id}/reactivate", title_tr: "API anahtarını yeniden etkinleştir", title_en: "Reactivate an API key", description_tr: "Daha önce arşivlenmiş bir API anahtarını yeniden etkinleştirir.", description_en: "Reactivate a previously archived API key." },
    ],
  },
  {
    slug: "workflows",
    order: 1,
    title_tr: "İş Akışları",
    title_en: "Workflows",
    entries: [
      { opSlug: "create-from-definition", method: "POST", path: "/workflow/create/definition", title_tr: "Tanımdan oluştur", title_en: "Create from definition", description_tr: "Doğrudan verdiğiniz node/edge grafiğinden bir ses ajanı oluşturur; iş akışı yapısı üzerinde tam kontrol istediğinizde kullanılır.", description_en: "Create a voice agent from an explicit workflow definition (nodes and edges) you provide directly." },
      { opSlug: "list-templates", method: "GET", path: "/workflow/templates", title_tr: "Şablonları listele", title_en: "List templates", description_tr: "Kullanılabilir tüm iş akışı şablonlarını (sektör, çağrı yönü ve önizleme bilgileriyle) listeler; bir şablonu çoğaltmadan önce template_id almak için kullanılır.", description_en: "List all available workflow templates, including sector, call direction, and preview info. Use this to get a template_id before duplicating one." },
      { opSlug: "duplicate-template", method: "POST", path: "/workflow/templates/duplicate", title_tr: "Şablonu çoğalt", title_en: "Duplicate a template", description_tr: "Hazır bir iş akışı şablonunu birebir kopyalayarak yeni bir iş akışı oluşturur (LLM kullanılmaz). template_id için önce şablonları listeleyin.", description_en: "Create a new workflow by duplicating a pre-built workflow template as-is (no LLM involved). List templates first to get a template_id." },
      { opSlug: "list", method: "GET", path: "/workflow/fetch", title_tr: "İş akışlarını listele", title_en: "List workflows", description_tr: "Organizasyonunuzdaki tüm iş akışlarını (aktif ve arşivlenmiş) listeler.", description_en: "Retrieve all workflows in your organization." },
      { opSlug: "count", method: "GET", path: "/workflow/count", title_tr: "İş akışı sayısını al", title_en: "Get workflow count", description_tr: "İş akışı sayısını durumlarına göre (aktif/arşiv/toplam) döndürür; panolar ve kota kontrolleri için kullanışlıdır.", description_en: "Get the total number of workflows broken down by status — useful for dashboards or quota checks." },
      { opSlug: "get", method: "GET", path: "/workflow/fetch/{workflow_id}", title_tr: "İş akışını getir", title_en: "Get a workflow", description_tr: "Tek bir iş akışını ID'sine göre, tam iş akışı tanımıyla birlikte getirir.", description_en: "Retrieve a single workflow by ID, including its full workflow definition." },
      { opSlug: "update", method: "PUT", path: "/workflow/{workflow_id}", title_tr: "İş akışını güncelle", title_en: "Update a workflow", description_tr: "Bir iş akışının adını, iş akışı tanımını veya yapılandırmasını günceller.", description_en: "Update a workflow's name, workflow definition, or configuration." },
      { opSlug: "archive", method: "PUT", path: "/workflow/{workflow_id}/status", title_tr: "İş akışını arşivle", title_en: "Archive a workflow", description_tr: "Bir iş akışını arşivler (çağrı alamaz hale getirir) veya arşivden geri yükler.", description_en: "Archive or restore a workflow. Archived workflows cannot receive calls." },
      { opSlug: "validate", method: "POST", path: "/workflow/{workflow_id}/validate", title_tr: "İş akışını doğrula", title_en: "Validate a workflow", description_tr: "Bir iş akışı tanımını, çalıştırmadan yapısal hatalara karşı doğrular.", description_en: "Validate a workflow definition for structural errors without executing it." },
      {
        opSlug: "runs",
        title_tr: "Çalıştırmalar",
        title_en: "Runs",
        children: [
          { opSlug: "create", method: "POST", path: "/workflow/{workflow_id}/runs", title_tr: "Test çalıştırması oluştur", title_en: "Create test run", description_tr: "Gerçek bir telefon çağrısı yapmadan iş akışını test amaçlı çalıştırır.", description_en: "Execute a workflow without placing a real phone call." },
          { opSlug: "list", method: "GET", path: "/workflow/{workflow_id}/runs", title_tr: "Çalıştırmaları listele", title_en: "List runs", description_tr: "Bir iş akışına ait tüm çalıştırmaları listeler.", description_en: "Retrieve all runs for a workflow." },
          { opSlug: "get", method: "GET", path: "/workflow/{workflow_id}/runs/{run_id}", title_tr: "Çalıştırmayı getir", title_en: "Get a run", description_tr: "Tek bir iş akışı çalıştırmasını ID'sine göre getirir.", description_en: "Retrieve a single workflow run by ID." },
        ],
      },
    ],
  },
  {
    slug: "call-plans",
    order: 2,
    title_tr: "Çağrı Planları",
    title_en: "Call Plans",
    entries: [
      { opSlug: "upload-contacts", method: "POST", path: "/s3/presigned-upload-url", title_tr: "Kişi CSV'si yükle", title_en: "Upload contacts CSV", description_tr: "Çağrı Planı için kişi CSV'si yüklemek üzere önceden imzalanmış (presigned) bir S3 URL'si alır.", description_en: "Get a presigned S3 URL to upload a contacts CSV for a campaign." },
      { opSlug: "create", method: "POST", path: "/campaign/create", title_tr: "Çağrı planı oluştur", title_en: "Create a call plan", description_tr: "Yeni bir giden arama çağrı planı oluşturur.", description_en: "Create a new outbound calling campaign." },
      { opSlug: "list", method: "GET", path: "/campaign/", title_tr: "Çağrı planlarını listele", title_en: "List call plans", description_tr: "Organizasyonunuza ait tüm çağrı planlarını listeler.", description_en: "Retrieve all campaigns for your organization." },
      { opSlug: "get", method: "GET", path: "/campaign/{campaign_id}", title_tr: "Çağrı planını getir", title_en: "Get a call plan", description_tr: "Tek bir Çağrı Planı ID'sine göre getirir.", description_en: "Retrieve a single campaign by ID." },
      { opSlug: "update", method: "PATCH", path: "/campaign/{campaign_id}", title_tr: "Çağrı planını güncelle", title_en: "Update a call plan", description_tr: "Çağrı Planı ayarlarını günceller; yalnızca taslak veya duraklatılmış kampanyalarda izinlidir.", description_en: "Update campaign settings. Only allowed on campaigns in draft or paused status." },
      { opSlug: "start", method: "POST", path: "/campaign/{campaign_id}/start", title_tr: "Çağrı planını başlat", title_en: "Start", description_tr: "Çağrı Planındaki kişileri aramaya başlar.", description_en: "Start dialing contacts in a campaign." },
      { opSlug: "pause", method: "POST", path: "/campaign/{campaign_id}/pause", title_tr: "Çağrı planını duraklat", title_en: "Pause", description_tr: "Çalışan bir Çağrı Planını geçici olarak durdurur; devam eden çağrılar kesilmeden tamamlanır.", description_en: "Temporarily stop a running campaign. In-flight calls are not interrupted." },
      { opSlug: "resume", method: "POST", path: "/campaign/{campaign_id}/resume", title_tr: "Çağrı planını devam ettir", title_en: "Resume", description_tr: "Duraklatılmış bir Çağrı Planını kaldığı yerden devam ettirir.", description_en: "Resume a paused campaign." },
      { opSlug: "progress", method: "GET", path: "/campaign/{campaign_id}/progress", title_tr: "Çağrı planı ilerlemesini al", title_en: "Get call plan progress", description_tr: "Bir Çağrı Planının anlık ilerleme durumunu (işlenen/tamamlanan/başarısız/bekleyen) döndürür.", description_en: "Get the current progress of a campaign (processed/completed/failed/pending contacts)." },
      { opSlug: "runs", method: "GET", path: "/campaign/{campaign_id}/runs", title_tr: "Çağrı planı çağrı çalıştırmalarını al", title_en: "Get call plan call runs", description_tr: "Çağrı Planındaki her kişi için ayrı çalıştırma kayıtlarını getirir.", description_en: "Retrieve individual run records for each contact in a campaign." },
    ],
  },
  {
    slug: "runs",
    order: 3,
    title_tr: "Çalıştırmalar",
    title_en: "Runs",
    entries: [
      { opSlug: "trigger", method: "POST", path: "/public/agent/{uuid}", title_tr: "API Trigger düğümüyle tetikle", title_en: "Trigger by API Trigger node", description_tr: "Bir API Trigger düğümü UUID'si (trigger_path) kullanarak giden bir ajan çalıştırması başlatır.", description_en: "Start an outbound agent run using an API Trigger node's UUID (trigger_path)." },
      { opSlug: "trigger-workflow", method: "POST", path: "/public/agent/workflow/{workflow_uuid}", title_tr: "Ajan UUID'siyle tetikle", title_en: "Trigger by Agent UUID", description_tr: "Ajanın sabit Agent UUID'sini kullanarak, bir API Trigger düğümü olmadan giden bir ajan çalıştırması başlatır.", description_en: "Start an outbound agent run using a workflow's stable Agent UUID instead of an API Trigger node." },
      { opSlug: "get-run", method: "GET", path: "/workflow/{workflow_id}/runs/{run_id}", title_tr: "Çalıştırma ayrıntılarını getir", title_en: "Retrieve agent run details", description_tr: "Bir ajan çalıştırmasının durumunu, dökümünü ve kaydını getirir.", description_en: "Get the details, transcript, and recording for an agent run." },
      { opSlug: "download", method: "GET", path: "/public/download/workflow/{token}/{artifact_type}", title_tr: "Kayıt ve dökümü indir", title_en: "Download recordings and transcripts", description_tr: "Zaman sınırlı genel bir URL üzerinden kayıt veya döküm indirir.", description_en: "Download a recording or transcript using a time-limited public URL." },
      { opSlug: "inbound", method: "POST", path: "/telephony/inbound/{workflow_id}", title_tr: "Gelen çağrı webhook'u", title_en: "Inbound run webhook", description_tr: "Telefon sağlayıcınızın panelinde tanımlanan, gelen çağrılardan ajan çalıştırması başlatan webhook uç noktası.", description_en: "Webhook endpoint, configured in your telephony provider's dashboard, that starts agent runs from inbound calls." },
    ],
  },
  {
    slug: "telephony-configs",
    order: 4,
    title_tr: "Telefon Yapılandırmaları",
    title_en: "Telephony Configurations",
    entries: [
      { opSlug: "providers", method: "GET", path: "/organizations/telephony-providers/metadata", title_tr: "Desteklenen sağlayıcıları listele", title_en: "List supported providers", description_tr: "Desteklenen telefon sağlayıcılarını ve her birinin gerektirdiği kimlik bilgisi alanlarını keşfeder.", description_en: "Discover available telephony providers and the credential fields each one requires." },
      { opSlug: "list", method: "GET", path: "/organizations/telephony-configs", title_tr: "Yapılandırmaları listele", title_en: "List configurations", description_tr: "Organizasyonunuzdaki tüm telefon yapılandırmalarını listeler.", description_en: "List all telephony configurations in your organization." },
      { opSlug: "create", method: "POST", path: "/organizations/telephony-configs", title_tr: "Yapılandırma oluştur", title_en: "Create a configuration", description_tr: "Yeni bir telefon yapılandırması oluşturur.", description_en: "Create a new telephony configuration." },
      { opSlug: "get", method: "GET", path: "/organizations/telephony-configs/{config_id}", title_tr: "Yapılandırmayı getir", title_en: "Get a configuration", description_tr: "Bir telefon yapılandırmasını ID'sine göre getirir; hassas alanlar maskeli döner.", description_en: "Retrieve a telephony configuration by id. Sensitive credential fields are returned masked." },
      { opSlug: "update", method: "PUT", path: "/organizations/telephony-configs/{config_id}", title_tr: "Yapılandırmayı güncelle", title_en: "Update a configuration", description_tr: "Bir yapılandırmanın adını değiştirir veya kimlik bilgilerini döndürür (rotate).", description_en: "Rename a configuration or rotate its credentials." },
      { opSlug: "delete", method: "DELETE", path: "/organizations/telephony-configs/{config_id}", title_tr: "Yapılandırmayı sil", title_en: "Delete a configuration", description_tr: "Bir telefon yapılandırmasını siler; bir kampanya veya numara tarafından kullanılıyorsa 409 döner.", description_en: "Delete a telephony configuration. Returns 409 if referenced by a campaign or phone number." },
      { opSlug: "set-default-outbound", method: "POST", path: "/organizations/telephony-configs/{config_id}/set-default-outbound", title_tr: "Varsayılan giden olarak ayarla", title_en: "Set as default outbound", description_tr: "Bu yapılandırmayı organizasyon genelinde varsayılan giden çağrı yapılandırması olarak belirler.", description_en: "Designate this configuration as the org-wide default for outbound calls." },
      {
        opSlug: "phone-numbers",
        title_tr: "Telefon Numaraları",
        title_en: "Phone Numbers",
        children: [
          { opSlug: "list", method: "GET", path: "/organizations/telephony-configs/{config_id}/phone-numbers", title_tr: "Telefon numaralarını listele", title_en: "List phone numbers", description_tr: "Bir telefon yapılandırmasına bağlı telefon numaralarını listeler.", description_en: "List phone numbers attached to a telephony configuration." },
          { opSlug: "create", method: "POST", path: "/organizations/telephony-configs/{config_id}/phone-numbers", title_tr: "Telefon numarası ekle", title_en: "Add a phone number", description_tr: "Bir telefon yapılandırmasına yeni bir telefon numarası ekler.", description_en: "Attach a new phone number to a telephony configuration." },
          { opSlug: "get", method: "GET", path: "/organizations/telephony-configs/{config_id}/phone-numbers/{phone_number_id}", title_tr: "Telefon numarasını getir", title_en: "Get a phone number", description_tr: "Bir telefon numarasını ID'sine göre getirir.", description_en: "Retrieve a phone number by id." },
          { opSlug: "update", method: "PUT", path: "/organizations/telephony-configs/{config_id}/phone-numbers/{phone_number_id}", title_tr: "Telefon numarasını güncelle", title_en: "Update a phone number", description_tr: "Bir telefon numarasının etiketini, gelen çağrı bağlamasını veya aktiflik durumunu günceller.", description_en: "Update label, inbound binding, or activation state of a phone number." },
          { opSlug: "delete", method: "DELETE", path: "/organizations/telephony-configs/{config_id}/phone-numbers/{phone_number_id}", title_tr: "Telefon numarasını sil", title_en: "Delete a phone number", description_tr: "Bir telefon numarasını yapılandırmadan kaldırır.", description_en: "Remove a phone number from a telephony configuration." },
          { opSlug: "set-default-caller", method: "POST", path: "/organizations/telephony-configs/{config_id}/phone-numbers/{phone_number_id}/set-default-caller", title_tr: "Varsayılan arayan olarak ayarla", title_en: "Set as default caller", description_tr: "Bir telefon numarasını bu yapılandırmanın varsayılan giden arayan kimliği olarak belirler.", description_en: "Designate a phone number as the configuration's default outbound caller id." },
        ],
      },
    ],
  },
  {
    slug: "api-auth-errors",
    order: 5,
    title_tr: "Kimlik Doğrulama ve Hatalar",
    title_en: "Authentication & Errors",
    // Guide-only group: no try-it operations, just ported overview/authentication/errors content.
    guide: true,
    entries: [],
  },
];

/** Flatten a group's entries (including nested children) into leaf endpoint entries. */
export function flattenEntries(entries, prefix = []) {
  return (entries || []).flatMap((entry) => {
    const opSlugPath = [...prefix, entry.opSlug];
    if (entry.children) return flattenEntries(entry.children, opSlugPath);
    return [{ ...entry, opSlug: opSlugPath.join("/") }];
  });
}

/** Find a group by slug. */
export function findGroup(groupSlug) {
  return API_REFERENCE_GROUPS.find((g) => g.slug === groupSlug) || null;
}

/** Find a leaf endpoint entry within a group by its full (possibly nested) opSlug path. */
export function findEntry(groupSlug, opSlugPath) {
  const group = findGroup(groupSlug);
  if (!group) return null;
  const leaves = flattenEntries(group.entries);
  return leaves.find((e) => e.opSlug === opSlugPath) || null;
}
