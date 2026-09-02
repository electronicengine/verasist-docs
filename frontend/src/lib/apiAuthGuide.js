/**
 * Static guide content for the "Authentication & Errors" API reference
 * group — ported from docs/api-reference/{overview,authentication,errors}.mdx.
 * No try-it panel here; this group has no operations of its own.
 */

export const API_AUTH_GUIDE = {
  tr: {
    baseUrlHeading: "Temel URL",
    baseUrlBody:
      "Tüm istekler https://verasist.ai/api/v1 adresine yapılır. Barındırılan (hosted) sürümü kullanıyorsanız temel URL https://app.verasist.ai/api/v1 olur.",
    authHeading: "API anahtarı ile kimlik doğrulama",
    authBody:
      "API anahtarları, programatik isteklerde önerilen kimlik doğrulama yöntemidir. Anahtarınızı X-API-Key başlığında gönderin. Anahtarlar bir organizasyona bağlıdır; bir anahtarla oluşturulan veya erişilen tüm kaynaklar o organizasyona aittir. Anahtarları panelde Ayarlar → API Anahtarları altında oluşturun.",
    curlExample: `curl https://verasist.ai/api/v1/workflow/fetch \\\n  -H "X-API-Key: vrs_api_anahtarınız"`,
    errorsHeading: "Hata yanıtları",
    errorsBody: "Hata yanıtları tutarlı bir JSON şeklini takip eder:",
    errorExample: `{\n  "detail": "İsteğin neden başarısız olduğunu açıklayan mesaj"\n}`,
    errorTable: [
      { status: "401 Unauthorized", cause: "Eksik, geçersiz veya süresi dolmuş kimlik bilgileri" },
      { status: "403 Forbidden", cause: "Kimlik bilgileri geçerli ama kaynak için yetki yetersiz" },
      { status: "422 Unprocessable Entity", cause: "Doğrulama hatası; detail bir liste olabilir" },
    ],
  },
  en: {
    baseUrlHeading: "Base URL",
    baseUrlBody:
      "All requests are made to https://verasist.ai/api/v1. If you are using the hosted version, the base URL is https://app.verasist.ai/api/v1.",
    authHeading: "API key authentication",
    authBody:
      "API keys are the recommended way to authenticate programmatic requests. Pass your key in the X-API-Key header. Keys are scoped to an organization — all resources created or accessed using a key belong to that organization. Create keys in the dashboard under Settings → API Keys.",
    curlExample: `curl https://verasist.ai/api/v1/workflow/fetch \\\n  -H "X-API-Key: vrs_your_api_key"`,
    errorsHeading: "Error responses",
    errorsBody: "Error responses follow a consistent JSON shape:",
    errorExample: `{\n  "detail": "Error message describing what went wrong"\n}`,
    errorTable: [
      { status: "401 Unauthorized", cause: "Missing, invalid, or expired credentials" },
      { status: "403 Forbidden", cause: "Valid credentials but insufficient permissions for the resource" },
      { status: "422 Unprocessable Entity", cause: "Validation error; detail may be a list" },
    ],
  },
};
