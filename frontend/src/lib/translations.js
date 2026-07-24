/**
 * Tab and section name translations.
 * Maps MongoDB slugs to display names in Turkish and English.
 */

const TAB_NAMES = {
  tr: {
    rehberler: "Rehberler",
    gelistirici: "Geliştirici",
    "api-referansi": "API Referansı",
  },
  en: {
    rehberler: "Guides",
    gelistirici: "Developer",
    "api-referansi": "API Reference",
  },
};

const SECTION_NAMES = {
  tr: {
    "getting-started": "Başlangıç",
    "core-concepts": "Temel Kavramlar",
    configurations: "Yapılandırma",
    "voice-agent": "Sesli Asistan",
    "voice-agent-tools": "Araçlar",
    "voice-agent-nodes": "Düğümler",
    telephony: "Telefon",
    channels: "Kanallar",
    "other-integrations": "Diğer Entegrasyonlar",
    contribution: "Katkı",
    "developer-guides": "Geliştirici Rehberleri",
    sdks: "SDK'lar",
    deployment: "Dağıtım",
    "api-resources": "Kaynaklar",
    "api-keys": "API Anahtarları",
    agents: "Ajanlar",
    runs: "Çalıştırmalar",
    campaigns: "Kampanyalar",
    "telephony-configs": "Telefon Yapılandırmaları",
    "api-auth-errors": "Kimlik Doğrulama ve Hatalar",
  },
  en: {
    "getting-started": "Getting Started",
    "core-concepts": "Core Concepts",
    configurations: "Configurations",
    "voice-agent": "Voice Agent Builder",
    "voice-agent-tools": "Tools",
    "voice-agent-nodes": "Nodes",
    telephony: "Telephony",
    channels: "Channels",
    "other-integrations": "Other Integrations",
    contribution: "Contribution",
    "developer-guides": "Guides",
    sdks: "SDKs",
    deployment: "Deployment",
    "api-resources": "Resources",
    "api-keys": "API Keys",
    agents: "Agents",
    runs: "Runs",
    campaigns: "Campaigns",
    "telephony-configs": "Telephony Configurations",
    "api-auth-errors": "Authentication & Errors",
  },
};

/**
 * Translate a tab object's title based on current language.
 * Usage: translateTab(tab, lang).title
 */
export function translateTab(tab, lang) {
  if (!tab) return tab;
  const translated = TAB_NAMES[lang]?.[tab.slug];
  if (translated) return { ...tab, title: translated };
  return tab;
}

/**
 * Translate a section object's title based on current language.
 * Usage: translateSection(section, lang).title
 */
export function translateSection(section, lang) {
  if (!section) return section;
  const translated = SECTION_NAMES[lang]?.[section.slug];
  if (translated) return { ...section, title: translated };
  return section;
}

/**
 * Get tab display name by slug and language.
 */
export function getTabName(slug, lang) {
  return TAB_NAMES[lang]?.[slug] || slug;
}

/**
 * Get section display name by slug and language.
 */
export function getSectionName(slug, lang) {
  return SECTION_NAMES[lang]?.[slug] || slug;
}

// ---------------------------------------------------------------------------
// UI / Static text translations (Header, HomePage, etc.)
// ---------------------------------------------------------------------------

const UI = {
  tr: {
    "header.brand": "Verasist Dökümantasyon",
    "header.tagline": "Yazılım Rehberi",
    "hero.badge": "Türkçe geliştirici dokümantasyonu",
    "hero.heading.openSource": "açık kaynak",
    "hero.heading.prefix": "Sesli yapay zekâ ajanları için",
    "hero.heading.suffix": "rehber.",
    "hero.description":
      "Kurulumdan dağıtıma kadar tüm adımları içeren, takım üyelerinin ortak hafızası haline gelen Türkçe dokümantasyon platformu.",
    "hero.cta.quickStart": "Hızlı başlangıç",
    "hero.cta.browseDocs": "Tüm dokümanlar",
    "features.setup.title": "2 dakikada kurulum",
    "features.setup.desc":
      "Docker ile sıfırdan çalışan sesli bota dakikalar içinde ulaşın.",
    "features.control.title": "Tam kontrol",
    "features.control.desc":
      "Açık kaynak. Kendi sunucunuzda barındırın, kodu özelleştirin.",
    "features.developer.title": "Geliştirici dostu",
    "features.developer.desc":
      "REST API, webhook'lar ve modüler eklenti sistemi.",
    "sections.heading": "Dokümantasyon bölümleri",
    "sections.subtitle": "Konuya göre düzenlenmiş kapsamlı rehberler",
    "docsIndex.breadcrumb": "Dokümantasyon",
    "docsIndex.heading": "Tüm dokümanlar",
    "docsIndex.description":
      "Konularına göre düzenlenmiş, sürekli güncellenen Türkçe rehberler.",
    "search.placeholder": "Dökümanlarda ara...",
    "search.noResults": "Sonuç bulunamadı",
    "search.shortcut": "Ctrl+K",
    "sidebar.onThisPage": "Bu sayfada",
    "sidebar.noHeadings": "",
  },
  en: {
    "header.brand": "Verasist Documentation",
    "header.tagline": "Software Guide",
    "hero.badge": "Developer documentation",
    "hero.heading.openSource": "open source",
    "hero.heading.prefix": "",
    "hero.heading.suffix": "guide for voice AI agents.",
    "hero.description":
      "A documentation platform covering everything from setup to deployment, serving as your team's shared knowledge base.",
    "hero.cta.quickStart": "Quick start",
    "hero.cta.browseDocs": "Browse docs",
    "features.setup.title": "2-minute setup",
    "features.setup.desc":
      "Go from zero to a working voice bot in minutes with Docker.",
    "features.control.title": "Full control",
    "features.control.desc":
      "Open source. Host on your own server, customize the code.",
    "features.developer.title": "Developer friendly",
    "features.developer.desc":
      "REST API, webhooks, and a modular plugin system.",
    "sections.heading": "Documentation sections",
    "sections.subtitle": "Comprehensive guides organized by topic",
    "docsIndex.breadcrumb": "Documentation",
    "docsIndex.heading": "All documents",
    "docsIndex.description":
      "Comprehensive, continuously updated guides organized by topic.",
    "search.placeholder": "Search docs...",
    "search.noResults": "No results found",
    "search.shortcut": "Ctrl+K",
    "sidebar.onThisPage": "On this page",
    "sidebar.noHeadings": "",
  },
};

/**
 * Get a UI text string for the current language.
 * Usage: t("hero.cta.quickStart", lang)
 */
export function t(key, lang) {
  return UI[lang]?.[key] ?? UI.tr?.[key] ?? key;
}
