import { beforeEach, describe, expect, it } from "vitest";
import { useLanguageViewStore } from "./use-language-view.store";

describe("useLanguageViewStore", () => {
  beforeEach(() => {
    useLanguageViewStore.getState().resetSelectedLanguages();
  });

  it("sets and toggles selected languages", () => {
    const store = useLanguageViewStore.getState();
    store.setSelectedLanguages(["en", "de"]);
    expect(useLanguageViewStore.getState().selectedLanguages).toEqual([
      "en",
      "de",
    ]);
    store.toggleLanguage("fr");
    expect(useLanguageViewStore.getState().selectedLanguages).toContain("fr");
    store.toggleLanguage("en");
    expect(useLanguageViewStore.getState().selectedLanguages).not.toContain(
      "en",
    );
  });

  it("sets and toggles optional columns", () => {
    const store = useLanguageViewStore.getState();
    store.setSelectedOptionalColumns(["a"]);
    expect(useLanguageViewStore.getState().selectedOptionalColumns).toEqual([
      "a",
    ]);
    store.toggleOptionalColumn("b");
    expect(useLanguageViewStore.getState().selectedOptionalColumns).toContain(
      "b",
    );
    store.toggleOptionalColumn("a");
    expect(
      useLanguageViewStore.getState().selectedOptionalColumns,
    ).not.toContain("a");
  });

  it("resets both languages and optional columns", () => {
    const store = useLanguageViewStore.getState();
    store.setSelectedLanguages(["en"]);
    store.setSelectedOptionalColumns(["a"]);
    store.resetSelectedLanguages();
    expect(useLanguageViewStore.getState().selectedLanguages).toEqual([]);
    expect(useLanguageViewStore.getState().selectedOptionalColumns).toEqual([]);
  });
});
