import { getPreferredLanguage, resolveBrowserLanguage } from "./browserLanguage";

test.each([
  [["tr-TR"], undefined, "tr"],
  [["en-GB"], undefined, "en"],
  [["de-DE", "tr-TR", "en-US"], undefined, "tr"],
  [["en-US", "tr-TR"], undefined, "en"],
  [["fr-FR"], undefined, "en"],
  [[], undefined, "en"],
  [["TR_tr"], undefined, "tr"],
  [["tr-TR"], "en", "en"],
  [["en-US"], "tr", "tr"],
  [["en-US"], "invalid", "en"],
])("resolves browser languages %j with saved %s to %s", (languages, saved, expected) => {
  expect(resolveBrowserLanguage(languages, saved)).toBe(expected);
});

test("browser preference still works when storage is unavailable", () => {
  const storage = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Storage blocked"); });
  const languages = jest.spyOn(window.navigator, "languages", "get").mockReturnValue(["tr-TR"]);
  expect(getPreferredLanguage()).toBe("tr");
  languages.mockRestore();
  storage.mockRestore();
});
