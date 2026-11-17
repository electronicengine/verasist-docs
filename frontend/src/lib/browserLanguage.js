// Use the first supported browser language; unsupported languages fall back to English.
export function resolveBrowserLanguage(languages = [], saved) {
  if (saved === "tr" || saved === "en") return saved;
  for (const language of languages) {
    const base = String(language).toLowerCase().split(/[-_]/)[0];
    if (base === "tr" || base === "en") return base;
  }
  return "en";
}

export function getPreferredLanguage() {
  let saved;
  try {
    saved = localStorage.getItem("dokuman_lang");
  } catch {}
  const languages =
    typeof navigator === "undefined"
      ? []
      : [...(navigator.languages || []), navigator.language];
  return resolveBrowserLanguage(languages, saved);
}
