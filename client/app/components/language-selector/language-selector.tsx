import { useEffect } from "react";
import { ChevronDown } from "lucide-react";
import {
  SUPPORTED_LANGUAGES,
  resolveLanguage,
} from "@seliseblocks/genesis-os";
import { useLanguageSwitcher } from "@seliseblocks/genesis-os/hooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui-kits/dropdown-menu/dropdown-menu";

export function LanguageSelector() {
  const { changeLanguage, language: storedLanguage } = useLanguageSwitcher();
  const language = resolveLanguage(storedLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative z-50 inline-flex h-9 items-center justify-center gap-1 rounded-full border border-transparent px-2.5 text-sm font-medium uppercase text-muted-foreground transition-all hover:border-input hover:bg-accent hover:text-accent-foreground hover:shadow-xs"
        >
          <span>{language}</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGUAGES.map((lang, index) => (
          <div key={lang.code}>
            <DropdownMenuItem
              lang={lang.code}
              className={lang.code === language ? "font-semibold" : ""}
              onClick={() => changeLanguage(lang.code)}
            >
              {lang.title}
            </DropdownMenuItem>
            {index !== SUPPORTED_LANGUAGES.length - 1 && (
              <DropdownMenuSeparator />
            )}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSelector;
