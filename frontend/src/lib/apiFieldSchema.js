import { resolveSchema } from "./apiReferenceSpec";

export function fieldSchema(spec, source, depth = 0) {
  if (depth > 12) return {};
  const schema = resolveSchema(spec, source) || {};
  if (schema.allOf) return schema.allOf.reduce((acc, item) => {
    const part = fieldSchema(spec, item, depth + 1);
    return { ...acc, ...part, properties: { ...acc.properties, ...part.properties }, required: [...new Set([...(acc.required || []), ...(part.required || [])])] };
  }, { ...schema, allOf: undefined });
  const options = schema.anyOf || schema.oneOf;
  if (options) {
    const nonNull = options.map((item) => fieldSchema(spec, item, depth + 1)).filter((item) => item.type !== "null");
    if (nonNull.length > 1 && nonNull.every((item) => item.const !== undefined)) return { ...schema, type: nonNull[0].type, enum: nonNull.map((item) => item.const), anyOf: undefined, oneOf: undefined };
    if (nonNull.length === 1) return { ...schema, ...nonNull[0], nullable: options.length !== nonNull.length, anyOf: undefined, oneOf: undefined };
  }
  if (!schema.enum && schema.type === "string" && schema.pattern?.startsWith("^") && schema.pattern.endsWith("$")) {
    const expression = schema.pattern.slice(1, -1).replace(/^\((.*)\)$/, "$1");
    if (/^[A-Za-z0-9_-]+(?:\|[A-Za-z0-9_-]+)*$/.test(expression)) return { ...schema, enum: expression.split("|") };
  }
  return schema.const !== undefined ? { ...schema, enum: [schema.const] } : schema;
}

const descriptions = {
  name: ["Kaynak için ayırt edilebilir bir ad girin.", "Enter a recognizable name for this resource."],
  workflow_id: ["İş akışı listesinden alınan sayısal ID. Workflow UUID ile aynı değildir.", "Numeric ID from the workflow list, not the workflow UUID."],
  workflow_uuid: ["İş akışının kalıcı UUID değeri; iş akışı ayarlarından alınır.", "Stable workflow UUID from workflow settings."],
  uuid: ["API Tetikleyici node’unun UUID değeri. Workflow UUID yerine tetikleyici UUID kullanın.", "UUID of the API Trigger node; use the trigger UUID, not the workflow UUID."],
  run_id: ["İş akışı çalıştırma kaydının sayısal ID değeri.", "Numeric ID of the workflow run record."],
  campaign_id: ["Kampanya listesinden alınan sayısal kampanya ID değeri.", "Numeric campaign ID returned by the campaign list."],
  api_key_id: ["API anahtarının kayıt ID değeri; gizli anahtar metnini girmeyin.", "Record ID of the API key, not the secret key value."],
  config_id: ["Telefon yapılandırmasının ID değeri.", "ID of the telephony configuration."],
  phone_number_id: ["Yapılandırmaya kayıtlı telefon numarasının ID değeri.", "ID of the phone-number record belonging to the configuration."],
  phone_number: ["Aranacak telefon numarası; ülke koduyla birlikte girin (ör. +905551234567).", "Destination phone number including country code, for example +905551234567."],
  workflow_definition: ["Node ve edge dizilerini içeren workflow grafiği. Workflow şemasına uygun JSON girin.", "Workflow graph containing nodes and edges. Supply JSON matching the workflow definition schema."],
  template_id: ["Şablonları listeleme yanıtından alınan şablon ID değeri.", "Template ID returned by the list-templates endpoint."],
  workflow_name: ["Oluşturulacak iş akışının adı.", "Name for the workflow being created."],
  template_context_variables: ["Şablon değişkenlerini anahtar/değer JSON nesnesi olarak verin.", "Template variables as a JSON object of key/value pairs."],
  initial_context: ["Konuşma başlangıcındaki bağlam değişkenleri; JSON nesnesi olarak gönderilir.", "Initial conversation context variables, supplied as a JSON object."],
  workflow_configurations: ["Bu çalıştırmada kullanılacak workflow yapılandırması; şemadaki alanları kullanın.", "Workflow configuration for this run; use the fields defined by the schema."],
  include_archived: ["Arşivlenmiş kayıtların listeye dahil edilip edilmeyeceğini belirler.", "Whether archived records should be included in the list."],
  page: ["Sonuçların hangi sayfasının getirileceği. İzin verilen en düşük değeri dikkate alın.", "Page of results to retrieve. Observe the minimum allowed value."],
  limit: ["Bir yanıtta döndürülecek en fazla kayıt sayısı.", "Maximum number of records returned in one response."],
  status: ["Kaydın durumu. API şemasındaki izin verilen değerlerden birini seçin.", "Resource status. Choose a value allowed by the API schema."],
  mode: ["Çalıştırma modu. İşlem için şemada tanımlanan değerleri kullanın.", "Execution mode. Use one of the values defined for this operation."],
  target: ["Seçilen kanalın desteklediği hedef adresi veya alıcı kimliği.", "Destination address or recipient identifier supported by the selected channel."],
  channel: ["İşlemin yürütüleceği iletişim kanalı.", "Communication channel used for this operation."],
  telephony_configuration_id: ["Arama için kullanılacak telefon yapılandırmasının ID değeri.", "ID of the telephony configuration to use for the call."],
  channel_configuration_id: ["Kullanılacak kanal bağlantısının yapılandırma ID değeri.", "ID of the channel connection configuration to use."],
  source_type: ["Kampanya kişi kaynağının türü; izin verilen değerlerden seçin.", "Type of campaign contact source; choose an allowed value."],
  source_id: ["Seçilen kişi kaynağının kimliği.", "Identifier of the selected contact source."],
  retry_config: ["Başarısız aramaların yeniden denenmesine ilişkin kurallar.", "Retry rules for unsuccessful calls."],
  schedule_config: ["Kampanyanın çalışma zamanlarını ve zamanlamasını belirleyen yapılandırma.", "Configuration controlling the campaign schedule and execution windows."],
  circuit_breaker: ["Ardışık başarısızlık durumunda kampanyayı durdurma kuralları.", "Rules for stopping a campaign after repeated failures."],
  max_concurrency: ["Aynı anda yürütülebilecek en fazla işlem sayısı.", "Maximum number of operations allowed to run concurrently."],
  completion_timeout_seconds: ["Tamamlanma için beklenecek süre; saniye cinsinden.", "Time to wait for completion, in seconds."],
  country_code: ["Telefon numaraları işlenirken kullanılacak ülke kodu.", "Country code used when processing phone numbers."],
  token: ["İndirme bağlantısında verilen erişim token’ı; API anahtarı değildir.", "Access token from the download link, not an API key."],
  artifact_type: ["İndirilecek çıktı türü; şemadaki seçeneklerden birini seçin.", "Artifact type to download; choose an option from the schema."],
  config: ["Telefon sağlayıcısının beklediği yapılandırma ve kimlik bilgileri. Sağlayıcı metadata yanıtındaki alanları kullanın.", "Provider configuration and credentials. Use the fields returned by provider metadata."],
  is_default_outbound: ["Bu yapılandırmayı varsayılan giden arama yapılandırması yapar.", "Makes this the default configuration for outbound calls."],
  address: ["Telefon sağlayıcısındaki numara veya adres.", "Phone number or address registered with the telephony provider."],
  label: ["Numarayı panelde tanımak için kullanılacak etiket.", "Label used to identify the number in the dashboard."],
  inbound_workflow_id: ["Gelen çağrıları karşılayacak workflow’un sayısal ID değeri.", "Numeric workflow ID that should handle inbound calls."],
  is_active: ["Kaydın etkin olup olmadığını belirler.", "Whether this record is active."],
  is_default_caller_id: ["Bu numarayı varsayılan arayan numarası olarak seçer.", "Selects this number as the default caller ID."],
  extra_metadata: ["Sağlayıcıya ait ek bilgileri JSON nesnesi olarak girin.", "Additional provider-specific information as a JSON object."],
  clear_inbound_workflow: ["Etkinleştirildiğinde mevcut gelen çağrı workflow atamasını kaldırır.", "When enabled, removes the existing inbound-workflow assignment."],
};

export function fieldHint(name, schema, required, lang, description) {
  const tr = lang === "tr";
  const semantic = description || schema.description || descriptions[name]?.[tr ? 0 : 1] || (tr ? `${name} alanının değerini girin.` : `Enter the value for ${name}.`);
  const details = [semantic, `${tr ? "Tür" : "Type"}: ${schema.type || (schema.properties ? "object" : "JSON")}.`, required ? (tr ? "Zorunlu alan." : "Required field.") : (tr ? "İsteğe bağlı; kullanılmazsa isteğe eklenmez." : "Optional; omitted when not enabled.")];
  if (schema.enum) details.push(`${tr ? "Seçenekler" : "Allowed values"}: ${schema.enum.join(", ")}.`);
  for (const [key, label] of [["minimum", "Min"], ["maximum", "Max"], ["minLength", tr ? "En az karakter" : "Min characters"], ["maxLength", tr ? "En fazla karakter" : "Max characters"], ["format", tr ? "Biçim" : "Format"], ["pattern", tr ? "Desen" : "Pattern"]]) {
    if (schema[key] !== undefined) details.push(`${label}: ${schema[key]}.`);
  }
  if (schema.default !== undefined) details.push(`${tr ? "Varsayılan" : "Default"}: ${JSON.stringify(schema.default)}.`);
  if (schema.nullable) details.push(tr ? "null kabul edilir." : "Accepts null.");
  return details.join(" ");
}
