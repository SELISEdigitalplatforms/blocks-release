import useLanguage from "@/hooks/use-language-switcher";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui-kits/dropdown-menu/dropdown-menu";

const languages = [
  { key: "en", title: "English" },
  { key: "de", title: "German" },
  { key: "fr", title: "French" },
];

export function LanguageSelector() {
  const { changeLanguage, language } = useLanguage();

  return (
     <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative z-50 inline-flex h-9 items-center justify-center gap-1 rounded-full border border-transparent px-2.5 text-sm font-medium uppercase text-muted-foreground transition-all hover:border-input hover:bg-accent hover:text-accent-foreground hover:shadow-sm"
        >
          <span>{language}</span>
          <ChevronDown className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang, index) => (
          <div key={lang.key}>
            <DropdownMenuItem
              className={lang.key === language ? "font-semibold" : ""}
              onClick={() => changeLanguage(lang.key)}
              disabled={lang.key !== "en"}
            >
              {lang.title}
            </DropdownMenuItem>
            {index !== languages.length - 1 && <DropdownMenuSeparator />}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSelector;
