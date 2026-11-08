/**
 * Test double for the i18n runtime of `@seliseblocks/genesis-os`.
 *
 * Same behaviour as the real runtime for bundled English and for other-language
 * dictionaries (other languages come from the localization service) set with `useI18nStore.getState().setRemote(...)`, without the
 * network loader. Language comes from the shared app-settings store.
 */
import { create } from "zustand";
import { useAppSettingsStore } from "./blocks-kit-stores";
import common from "./common.en.json";

type Dictionary = Readonly<Record<string, string>>;
type TranslateValues = Readonly<Record<string, string | number>>;

export const DEFAULT_LANGUAGE = "en";
export const SUPPORTED_LANGUAGES = [
  { code: "en", title: "English" },
  { code: "xx", title: "Test language" },
] as const;

export const resolveLanguage = (language?: string | null): string => {
  const code = language?.toLowerCase().split("-")[0];
  return SUPPORTED_LANGUAGES.some((item) => item.code === code)
    ? (code as string)
    : DEFAULT_LANGUAGE;
};

interface I18nState {
  bundled: Record<string, Dictionary>;
  remote: Record<string, Dictionary>;
  registerBundle: (module: string, dictionary: Dictionary) => void;
  setRemote: (language: string, module: string, dictionary: Dictionary) => void;
}

export const useI18nStore = create<I18nState>()((set) => ({
  bundled: { common },
  remote: {},
  registerBundle: (module, dictionary) =>
    set((state) => ({
      bundled: {
        ...state.bundled,
        [module]: { ...state.bundled[module], ...dictionary },
      },
    })),
  setRemote: (language, module, dictionary) =>
    set((state) => ({
      remote: { ...state.remote, [`${language}:${module}`]: dictionary },
    })),
}));

export const registerTranslations = (module: string, dictionary: Dictionary) => {
  useI18nStore.getState().registerBundle(module, dictionary);
};

const fill = (template: string, values?: TranslateValues) =>
  values
    ? template.replaceAll(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
        Object.hasOwn(values, name) ? String(values[name]) : match,
      )
    : template;

const lookup = (
  language: string,
  module: string,
  key: string,
  values?: TranslateValues,
): string => {
  const at = key.indexOf(":");
  const target =
    at > 0
      ? { module: key.slice(0, at), key: key.slice(at + 1) }
      : { module, key };
  const { bundled, remote } = useI18nStore.getState();
  const sources = [
    language === DEFAULT_LANGUAGE
      ? undefined
      : remote[`${language}:${target.module}`],
    bundled[target.module],
  ];
  const count = values?.count;
  const candidates =
    typeof count === "number"
      ? [
          `${target.key}_${new Intl.PluralRules(language).select(count)}`,
          `${target.key}_other`,
          target.key,
        ]
      : [target.key];
  for (const dictionary of sources) {
    for (const candidate of candidates) {
      const value = dictionary?.[candidate];
      if (value) return fill(value, values);
    }
  }
  return target.key;
};

export const useT = (module: string) => {
  const language = resolveLanguage(
    useAppSettingsStore((state) => state.settings.language as string | undefined),
  );
  // Subscribe so a component re-renders when dictionaries change.
  useI18nStore((state) => state.remote);
  useI18nStore((state) => state.bundled);
  const t = (key: string, values?: TranslateValues) =>
    lookup(language, module, key, values);
  return { t, language };
};

export const tStatic = (
  module: string,
  key: string,
  values?: TranslateValues,
): string =>
  lookup(
    resolveLanguage(
      useAppSettingsStore.getState().settings.language as string | undefined,
    ),
    module,
    key,
    values,
  );

export function useLanguageSwitcher() {
  const language = useAppSettingsStore(
    (state) => state.settings.language as string | undefined,
  );
  const setSettings = useAppSettingsStore((state) => state.setSettings);
  return {
    language,
    changeLanguage: (next: string) => setSettings({ language: next }),
  };
}
